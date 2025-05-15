import axios from 'axios';
import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

export class NewsCacheService {
  private static instance: NewsCacheService;
  private client: MongoClient;
  private db!: Db;
  private connected: boolean = false;
  private updateInterval: number;

  constructor() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not defined');
    this.client = new MongoClient(uri);
    this.updateInterval = 5 * 60 * 1000; // 5 minutes
    this.connect().then(() => this.updateNews());
  }

  static getInstance(): NewsCacheService {
    if (!NewsCacheService.instance) {
      NewsCacheService.instance = new NewsCacheService();
    }
    return NewsCacheService.instance;
  }

  async connect() {
    if (!this.connected) {
      await this.client.connect();
      this.db = this.client.db(process.env.DB_NAME || 'leveledup');
      this.connected = true;
      console.log('NewsCache connected to MongoDB');
    }
  }

  async updateNews() {
    try {
      const response = await axios.get('https://crypto-news51.p.rapidapi.com/api/v1/crypto/articles', {
        method: 'GET',
        params: {
          page: '1',
          limit: '10',
          time_frame: '24h',
          format: 'json'
        },
        headers: {
          'x-rapidapi-key': process.env.RAPID_API_KEY,
          'x-rapidapi-host': 'crypto-news51.p.rapidapi.com'
        }
      });

      await this.db.collection('cache').updateOne(
        { type: 'news' },
        { 
          $set: {
            news: response.data,
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );

      console.log('News updated in cache');
    } catch (error) {
      console.error('Error updating news:', error);
    }

    // Schedule next update
    setTimeout(() => this.updateNews(), this.updateInterval);
  }

  async getNews(limit: number = 10) {
    const cacheData = await this.db.collection('cache').findOne({ type: 'news' });
    if (!cacheData) {
      return [];
    }
    return cacheData.news?.slice(0, limit) || [];
  }
} 