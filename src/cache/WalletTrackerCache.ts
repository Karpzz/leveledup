import axios from 'axios';
import { MongoClient, Collection, Db, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { PortfolioService } from '../services/portfolioService';
import { LeaderboardCacheService } from './LeaderboardCache';

dotenv.config();

export class WalletTrackerCacheService {
    private static instance: WalletTrackerCacheService;
    private client: MongoClient;
    private db!: Db;
    private connected: boolean = false;
    private updateInterval: number;
    constructor() {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI is not defined');
        this.client = new MongoClient(uri);
        this.updateInterval = 10 * 60 * 1000; // 10 minutes
    }
    static getInstance(): WalletTrackerCacheService {
        if (!WalletTrackerCacheService.instance) {
            WalletTrackerCacheService.instance = new WalletTrackerCacheService();
        }
        return WalletTrackerCacheService.instance;
    }
    async walletTrackerPrint(text: string) {
        console.log(`[WALLET TRACKER CACHE] ${text}`);
    }
    async connect() {
        if (!this.connected) {
            await this.client.connect();
            this.db = this.client.db(process.env.DB_NAME || 'leveledup');
            this.connected = true;
            this.walletTrackerPrint('WalletTrackerCache connected to MongoDB');
        }
    }

    async updateWalletTracker() {
        const walletsCollection = this.db.collection('wallet-tracker');
        const usersCollection = this.db.collection('users');
        const wallets = await walletsCollection.find({}).toArray();
        const portfolioService = new PortfolioService();
        this.walletTrackerPrint(`Found ${wallets.length} wallets`);
        const addresses = wallets.map(wallet => wallet.address); // get rid of duplicates
        const uniqueAddresses = [...new Set(addresses)];
        const walletTrades: Record<string, any> = {};
        this.walletTrackerPrint(`Found ${uniqueAddresses.length} unique addresses`);
        for (let index = 0; index < uniqueAddresses.length; index++) {
            const address = uniqueAddresses[index];
            try {
                const trades = await portfolioService.getWalletTrades(address);
                walletTrades[address] = trades.trades;
            } catch (error) {
                console.error(`Error updating trades for wallet ${address}: ${error}`);    
            }
        }
        for (const address of Object.keys(walletTrades)) {
            const tradeData = walletTrades[address];
            const db_wallets = await walletsCollection.find({ address: address }).toArray();
            if (db_wallets.length > 0) {
                for (const  wallet of db_wallets) {
                    const existingTxs = wallet.trades.map((trade: any) => trade.tx);
                    // check to see if there are any new trades that arent in wallet.trades by trade.tx (wallet.trades can be undefined, and if it is itll just update the wallet)
                    const newTrades = tradeData.filter((trade: any) => !existingTxs.includes(trade.tx));
                    
                    try {
                        if (newTrades.length > 0) {
                            this.walletTrackerPrint(`Found ${newTrades.length} new trades for address ${address}`);
                            await walletsCollection.updateOne({ _id: wallet._id }, { $push: { trades: { $each: newTrades } } });
                            // set alert with trades and user_id
                            const user = await usersCollection.findOne({ _id: new ObjectId(wallet.user_id) });
                            if (user && user.telegram_id && user.notifications.wallet_tracker) {
                                const dict = {
                                    user_id: wallet.user_id,
                                    alert_type: "wallet-tracker",
                                    wallet_address: address,
                                    trades: newTrades,
                                    created_at: new Date(),
                                    sent: false
                                }
                                await this.db.collection('alerts').insertOne(dict)
                                this.walletTrackerPrint(`Alert set for user ${user.telegram_id} with ${newTrades.length} new trades`);
                            }
                        }
                    } catch (error) {
                        this.walletTrackerPrint(`Error updating trades for wallet ${address}: ${error}`);
                    }
                }
            }
        }
    }

    async startProcess() {
        await this.connect();
        await this.updateWalletTracker();
        setInterval(async () => {
            await this.updateWalletTracker();
        }, this.updateInterval);
    }

} 