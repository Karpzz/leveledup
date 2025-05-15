import { MongoClient, Db } from 'mongodb';
import { TwitterUser } from '../types';
import dotenv from 'dotenv';

dotenv.config();

class DatabaseService {
  private client: MongoClient;
  public db: Db | null = null;

  constructor() {
    this.client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db('leveledup');
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('MongoDB connection error:', err);
      throw err;
    }
  }

  async upsertUser(userData: Partial<TwitterUser>): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    await this.db.collection('users').updateOne(
      { id: userData.id },
      { $set: { ...userData, updated_at: new Date() } },
      { upsert: true }
    );
  }

  async getUser(id: string): Promise<TwitterUser | null> {
    if (!this.db) throw new Error('Database not connected');
    
    return this.db.collection('users').findOne<TwitterUser>({ id });
  }

  async getAllUsers(): Promise<TwitterUser[]> {
    if (!this.db) throw new Error('Database not connected');
    
    return this.db.collection('users').find<TwitterUser>({}).toArray();
  }
}

export const dbService = new DatabaseService(); 