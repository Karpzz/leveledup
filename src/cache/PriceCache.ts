import axios from 'axios';
import { MongoClient, Collection, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

export class PriceCacheService {
    private static instance: PriceCacheService;
    private client: MongoClient;
    private db!: Db;
    private connected: boolean = false;
    private updateInterval: number;

    constructor() {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI is not defined');
        this.client = new MongoClient(uri);
        this.updateInterval = 60 * 60 * 1000; // 1 hour
        this.connect().then(() => this.updatePrices());
    }
    async pricePrint(text: string) {
        console.log(`[PRICE CACHE] ${text}`);
    }
    static getInstance(): PriceCacheService {
        if (!PriceCacheService.instance) {
            PriceCacheService.instance = new PriceCacheService();
        }
        return PriceCacheService.instance;
    }

    async connect() {
        if (!this.connected) {
            await this.client.connect();
            this.db = this.client.db(process.env.DB_NAME || 'leveledup');
            this.connected = true;
            this.pricePrint('PriceCache connected to MongoDB');
        }
    }
    async updatePrices() {
        try {
            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                params: {
                    ids: 'bitcoin,ethereum,solana,raydium,bonk,jupiter,litecoin,monero',
                    vs_currencies: 'usd,eur,gbp,cad',
                    include_24hr_change: true,
                    include_24hr_vol: true,
                    include_market_cap: true
                },
                headers: {
                    'x-cg-demo-api-key': process.env.COINGECKO_API_KEY
                }
            });

            // update cache collection with "type": "prices" and "data": response.data
            await this.db.collection('cache').updateOne(
                { type: 'prices' },
                { $set: {
                    prices: response.data, 
                    lastUpdated: new Date() 
                } },
                { upsert: true }
            );


        } catch (error) {
            this.pricePrint(`Error updating prices: ${error}`);
        }

        // Schedule next update
        setTimeout(() => this.updatePrices(), this.updateInterval);
    }

    async getPrices() {
        const prices = await this.db.collection('cache').findOne({ type: 'prices' });
        return prices?.prices || null;
    }


    async getSolPrice() {
        const prices = await this.getPrices();
        return prices?.solana || null;
    }

    getPricesFromCache() {
        return this.getPrices();
    }

} 