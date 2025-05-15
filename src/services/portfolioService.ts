import { Request, Response } from 'express';
import { LAMPORTS_PER_SOL, PublicKey, Connection } from '@solana/web3.js';
import axios from 'axios';
import { PriceCacheService } from '../cache/PriceCache';
import fs from 'fs';
import path from 'path';

export class PortfolioService {
    private connection: Connection;
    private priceCache: PriceCacheService;
    private uploadsDir: string;

    constructor() {
        this.connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com');
        this.priceCache = PriceCacheService.getInstance();
        this.uploadsDir = path.join(__dirname, '../uploads/avatars');
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
    }


    /**
     * Fetch the price of a given token quoted in USDC using Jupiter API
     * @param tokenId The token mint address
     * @returns The price of the token quoted in USDC
     */
    fetchPrice = async (tokenId: PublicKey): Promise<string> => {
        try {
            const response = await fetch(`https://api.jup.ag/price/v2?ids=${tokenId}`);
        
            if (!response.ok) {
                throw new Error(`Failed to fetch price: ${response.statusText}`);
            }
        
            const data = await response.json();
        
            const price = data.data[tokenId.toBase58()]?.price;
        
            if (!price) {
                throw new Error("Price data not available for the given token.");
            }
        
            return price;
            } catch (error: any) {
            throw new Error(`Price fetch failed: ${error.message}`);
        }
    }

    getTokenMetadata = async (mint: string) => {
        const response = await axios.get(`https://api.jup.ag/tokens/v1/token/${mint}`);
        return response.data;
    }

    getAllTokenSearchQueries = async (tokens: string[]) => {
        const searchPromises = tokens.map(token => 
            axios.get(`https://data.solanatracker.io/search?query=${token}&limit=10`, {
                headers: {
                    'x-api-key': process.env.SOLANA_TRACKER_API_KEY
                }
            })
            .then(response => {
                if (response.status === 200 && response.data.data.length > 0) {
                    return {
                        mint: token,
                        data: response.data.data[0]
                    };
                }
                return null;
            })
            .catch(error => {
                console.error(`Error fetching data for token ${token}:`, error);
                return null;
            })
        );

        const results = await Promise.all(searchPromises);
        return results.reduce((acc, result) => {
            if (result) {
                acc[result.mint] = result.data;
            }
            return acc;
        }, {} as Record<string, any>);
    }
    /**
     * Fetch the token data from Solana Tracker API
     * @param tokenInformation The token information
     * @returns The token data
     */
    getTokenDataSolana = async (tokenInformation: any) => {
        return {
            ...tokenInformation.token,
            'change' : tokenInformation.events['24h'].priceChangePercentage,
            'price' : tokenInformation.pools[0].price.usd
        }
    }
    getTokens = async (wallet_address: string) => {
        const response = await axios.get(`https://data.solanatracker.io/wallet/${wallet_address}`, {
            headers: {
                'x-api-key': process.env.SOLANA_TRACKER_API_KEY
            }
        });
        return response.data.tokens;
    }

    getPortfolioPNL = async (wallet_address: string) => {
        const response = await axios.get(`https://data.solanatracker.io/pnl/${wallet_address}?owner=${wallet_address}&showHistoricPnL=showHistoricPnL`, {
            headers: {
                'x-api-key': process.env.SOLANA_TRACKER_API_KEY
            }
        });
        return response.data;
    }
    private async retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 5): Promise<T> {
        let lastError: any;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.error(`Attempt ${attempt + 1}/${maxRetries} failed:`, error);
                if (attempt < maxRetries - 1) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10s delay
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError;
    }

    getTokenPortfolio = async (wallet_address: string): Promise<any> => {
        return this.retryOperation(async () => {
            // Get token balances using connection
            const publicKey = new PublicKey(wallet_address);
            const solBalance = await this.connection.getBalance(publicKey);
            const tokenList = await this.getTokens(wallet_address);
            const tokenSearchQueries = await this.getAllTokenSearchQueries(tokenList.map((token: any) => token.token.mint));
            // Get SOL price
            const solPrice = await this.priceCache.getPrices();
            const portfolioPNL = await this.getPortfolioPNL(wallet_address);
            // Format tokens and get their prices
            const formattedTokens = await Promise.all(tokenList.map(async (token: any) => {
                try {
                    const tokenData = await this.getTokenDataSolana(token);
                    const amount = token.balance;
                    const pnlKey = Object.keys(portfolioPNL.tokens).find(key => key === token.token.mint);
                    const pnlValue = pnlKey ? portfolioPNL.tokens[pnlKey] : null;
                    const historicPnl = pnlKey ? portfolioPNL.historic.tokens[pnlKey] : null;
                    // work out amount in percentage that has been gained or lost
                   if (pnlValue) {
                        // Token amount percentage gain/loss
                        const tokenPnlPercentage = (pnlValue.total / pnlValue.held) * 100;
                        
                        // USD value percentage gain/loss
                        const usdPnlPercentage = ((pnlValue.current_value - pnlValue.total_invested) / pnlValue.total_invested) * 100;
                        
                        pnlValue.percentages = {
                            token: tokenPnlPercentage.toFixed(2),
                            usd: usdPnlPercentage.toFixed(2)
                        }
                        if (historicPnl) {
                            pnlValue.historic = {
                                ...historicPnl,
                                percentages: {
                                    token: (historicPnl.total / historicPnl.held) * 100,
                                    usd: ((historicPnl.current_value - historicPnl.total_invested) / historicPnl.total_invested) * 100
                                }
                            }
                        }
                    }

                    const tokenSearchQuery = tokenSearchQueries[token.token.mint];
                    return {
                        ...tokenData,
                        ...tokenSearchQuery,
                        mint: token.token.mint,
                        amount,
                        usdValue: token.value,
                        pnl: pnlValue ? pnlValue : null
                    };
                } catch (error) {
                    console.error(`Error processing token ${token.token.mint}:`, error);
                    return null;
                }
            }));

            // Calculate total balance in USD
            const validTokens = formattedTokens.filter((token: any) => token !== null);
            const solBalanceUsd = (solBalance / LAMPORTS_PER_SOL) * solPrice['solana']['usd'];

            return {
                success: true,
                balances: {
                    sol: solBalance / LAMPORTS_PER_SOL,
                    usd: solBalanceUsd
                },
                tokens: validTokens
            };
        }).catch(error => {
            console.error('All retry attempts failed:', error);
            return { 
                success: false, 
                error: 'Failed to fetch token portfolio after multiple attempts' 
            };
        });
    };
} 