import { LAMPORTS_PER_SOL, PublicKey, Connection } from '@solana/web3.js';
import axios from 'axios';
import { PriceCacheService } from '../cache/PriceCache';
import { get_token_balance } from '../utils/get_token_balances';
export class PortfolioService {
    private connection: Connection;
    private priceCache: PriceCacheService;

    constructor() {
        this.connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com');
        this.priceCache = PriceCacheService.getInstance();
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

    getWalletTradesByToken = async (wallet_address: string, token: string) => {
        if (!wallet_address || !token) {
            return []
        }
        const response = await axios.get(`https://data.solanatracker.io/trades/${token}/by-wallet/${wallet_address}`, {
            headers: {
                'x-api-key': process.env.SOLANA_TRACKER_API_KEY
            }
        });
        return response.data;
    }
    getWalletTrades = async (wallet_address: string) => {
        const response = await axios.get(`https://data.solanatracker.io/wallet/${wallet_address}/trades`, {
            headers: {
                'x-api-key': process.env.SOLANA_TRACKER_API_KEY
            }
        });
        return response.data;
    }
    getTokenMetadata = async (mint: string) => {
        const response = await axios.get(`https://api.jup.ag/tokens/v1/token/${mint}`);
        return response.data;
    }
    
    getTokenDetails = async (mint: string) => {
        const response = await axios.get(`https://data.solanatracker.io/tokens/${mint}`, {
            headers: {
                'x-api-key': process.env.SOLANA_TRACKER_API_KEY
            }
        });
        return response.data;
    }

    getAllTokenDetails = async (tokens: string[]) => {
        const results = []
        for (const token of tokens) {
            console.log(`Fetching token details for ${token} ${results.length}/${tokens.length}`);
            const result = await this.getTokenDetails(token);
            results.push(result);
        }
        const tokenDetails = []
        for (const result of results) {
            tokenDetails.push(result);
        }
        return tokenDetails;
    }

    getAllTokenDetailsJup = async (tokens: string[]) => {
        const promises = tokens.map(token => this.getTokenDetailsJup(token));
        const results = await Promise.all(promises);
        return results;
    }
    getTokenDetailsJup = async (token: string) => {
        const response = await axios.get(`https://datapi.jup.ag/v1/assets/search?query=${token}`);
        return response.data[0];
    }
    getTokenSearchQuery = async (token: string) => {
        const result = await axios.get(`https://data.solanatracker.io/search?query=${token}&limit=10`, {
            headers: {
                'x-api-key': process.env.SOLANA_TRACKER_API_KEY
            }
        });
        if (result.data.data.length > 0) {
            return result.data.data[0];
        }
        return null;
    }
    getAllTokenSearchQueries = async (tokens: string[]) => {
        const results: any = {}
        for (const token of tokens) {
            console.log(`Fetching search query for ${token} ${Object.keys(results).length}/${tokens.length}`);
            const result = await this.getTokenSearchQuery(token);
            results[token] = result;
        }
        return results;
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
            const balance = await get_token_balance(new PublicKey(wallet_address), this.connection);
            const prices = await this.priceCache.getPrices();
            const solBalance = balance.sol;
            const balanceInUSD = solBalance * prices.solana.usd;
            const tokenDetails = await this.getTokens(wallet_address);
            const pnlDetails = await this.getPortfolioPNL(wallet_address);
            const trades = await this.getWalletTrades(wallet_address);
            const tokensList = []
            for (const tokenInformation of tokenDetails) {
                const highestLiquidityPool = tokenInformation.pools.find((solToken: any) => solToken.liquidity.usd === Math.max(...tokenInformation.pools.map((t: any) => t.liquidity.usd)));
                const highestPricePool = tokenInformation.pools.find((solToken: any) => solToken.price.usd === Math.max(...tokenInformation.pools.map((t: any) => t.price.usd)));
                const highestMarketCapPool = tokenInformation.pools.find((solToken: any) => solToken.marketCap.usd === Math.max(...tokenInformation.pools.map((t: any) => t.marketCap.usd)));
                const pnlKey = Object.keys(pnlDetails.tokens).find(key => key === tokenInformation.token.mint);
                const pnlValue = pnlKey ? pnlDetails.tokens[pnlKey] : null;
                const historicPnl = pnlKey ? pnlDetails.historic.tokens[pnlKey] : null;
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
                tokensList.push({
                    name: tokenInformation.token.name,
                    address: tokenInformation.token.mint,
                    symbol: tokenInformation.token.symbol,
                    amount: tokenInformation.balance,
                    image: tokenInformation.token.image,
                    decimals: tokenInformation.token.decimals,
                    price: highestPricePool.price.usd,
                    usdValue: tokenInformation.value,
                    market_cap: highestMarketCapPool.marketCap.usd,
                    liquidity: highestLiquidityPool.liquidity.usd,
                    volume: 0,
                    change: tokenInformation.events['24h'].priceChangePercentage,
                    instant_change: tokenInformation.events['1h'].priceChangePercentage,
                    pnl: pnlValue ? pnlValue : null,
                    risk: tokenInformation.risk
                })
            }
            return {
                success: true,
                balances: {
                    sol: solBalance / LAMPORTS_PER_SOL,
                    usd: balanceInUSD
                },
                tokens: tokensList,
                trades: trades.trades
            };
        }).catch(error => {
            console.error('All retry attempts failed:', error);
            return { 
                success: false, 
                error: 'Failed to fetch token portfolio after multiple attempts' 
            };
        });
    };

    getTopTraders = async (token: string) => {
        const response = await axios.get(`https://data.solanatracker.io/top-traders/${token}?page=`, {
            headers: {
                'x-api-key': process.env.SOLANA_TRACKER_API_KEY
            }
        });
        return response.data;
    }
    getHolders = async (token: string) => {
        const response = await axios.get(`https://data.solanatracker.io/tokens/${token}/holders?page=&token=${token}`, {
            headers: {
                'x-api-key': process.env.SOLANA_TRACKER_API_KEY
            }
        });
        return response.data;
    }
} 