import axios from 'axios';
import { MongoClient, Collection, Db } from 'mongodb';
import dotenv from 'dotenv';
import { PortfolioService } from '../services/portfolioService';

dotenv.config();

export class LeaderboardCacheService {
    private static instance: LeaderboardCacheService;
    private client: MongoClient;
    private db!: Db;
    private connected: boolean = false;
    private updateInterval: number;
    constructor() {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI is not defined');
        this.client = new MongoClient(uri);
        this.updateInterval = 60 * 60 * 1000; // 1 hour
    }
    static getInstance(): LeaderboardCacheService {
        if (!LeaderboardCacheService.instance) {
            LeaderboardCacheService.instance = new LeaderboardCacheService();
        }
        return LeaderboardCacheService.instance;
    }

    async leaderboardPrint(text: string) {
        console.log(`[LEADERBOARD CACHE] ${text}`);
    }
    async connect() {
        if (!this.connected) {
            await this.client.connect();
            this.db = this.client.db(process.env.DB_NAME || 'leveledup');
            this.connected = true;
            console.log('LeaderboardCache connected to MongoDB');
        }
    }

    async updateLeaderboard() {
        const usersCollection = this.db.collection('users');
        const users = await usersCollection.find(
          { wallet_address: { $ne: null } },
          {
            projection: {
              _id: 1,
              wallet_address: 1
            }
          }
        ).toArray();
        const portfolioService = new PortfolioService();
        this.leaderboardPrint(`Updating ${users.length} users`);
        for (let index = 0; index < users.length; index++) {
            const user = users[index];
            try {
                const portfolioPnl = await portfolioService.getPortfolioPNL(user.wallet_address);
                await usersCollection.updateOne({ _id: user._id }, { $set: { portfolioPnl } });
                this.leaderboardPrint(`Updated portfolio PNL for user ${user.wallet_address} ${index + 1} of ${users.length}`);
            } catch (error) {
                this.leaderboardPrint(`Error updating portfolio PNL for user ${user.wallet_address}: ${error}`);    
            }
        }
    }

    async startProcess() {
        await this.connect();
        await this.updateLeaderboard();
        setInterval(async () => {
            await this.updateLeaderboard();
        }, this.updateInterval);
    }

} 