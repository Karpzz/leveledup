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
    this.updateInterval = 60 * 60 * 1000; // 1 hour
    this.connect().then(() => {
      this.updateWhaleTransactions();
      this.updateNews();
    });
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

  async updateWhaleTransactions() {
    axios.get('https://crypto-news51.p.rapidapi.com/api/v1/crypto/transactions', {
      method: 'GET',
      headers: {
        'x-rapidapi-key': process.env.RAPID_API_KEY,
        'x-rapidapi-host': 'crypto-news51.p.rapidapi.com'
      }
    })
    .then(async response => {
      await this.db.collection('cache').updateOne(
        { type: 'whale-transactions' },
        { $set: { transactions: response.data } },
        { upsert: true }
      );
      console.log('Whale transactions updated in cache');
    })
    .catch(error => {
      console.error('Error fetching whale transactions:', error);
    });
    setTimeout(() => this.updateWhaleTransactions(), this.updateInterval);
  }
  async updateNews() {
    try {
      const sources = [
        "coindesk",
        "cointelegraph",
        "decrypt",
        "bitcoinmagazine",
        "cryptobriefing",
        "cryptoslate",
        "dailyhodl",
        "ambcrypto",
        "cryptopotato",
        "newsbtc",
        "zycrypto",
        "bravenewcoin"
      ];

      const newsPromises = sources.map(source => 
        axios.get('https://crypto-news51.p.rapidapi.com/api/v1/crypto/articles', {
          method: 'GET',
          params: {
            page: '1',
            limit: '100',
            time_frame: '24h',
            format: 'json',
            source: source
          },
          headers: {
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': 'crypto-news51.p.rapidapi.com'
          }
        })
        .then(response => ({
          source,
          articles: response.data.filter((news: any) => news && news.summary !== null)
        }))
        .catch(error => {
          console.error(`Error fetching news from ${source}:`, error);
          return {
            source,
            articles: []
          };
        })
      );

      const allNewsResults = await Promise.all(newsPromises);
      
      // Convert array to object with sources as keys
      const newsBySource = allNewsResults.reduce((acc, { source, articles }) => {
        acc[source] = articles;
        return acc;
      }, {} as Record<string, any[]>);

      await this.db.collection('cache').updateOne(
        { type: 'news' },
        { 
          $set: {
            news: newsBySource,
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

  async getNews() {
    const cacheData = await this.db.collection('cache').findOne({ type: 'news' });
    if (!cacheData) {
      return [];
    }
    return cacheData.news
  }
} 