import { MongoClient, Db, ObjectId } from 'mongodb';
import { TwitterUser, Wallet } from '../types';
import dotenv from 'dotenv';
import { Notification} from '../types';
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

  async createNotification(notification: Notification): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    await this.db.collection('notifications').insertOne(notification);
  }
  
  async getWallets(user_id: string): Promise<Wallet[]> {
    if (!this.db) throw new Error('Database not connected');
    
    return this.db.collection('wallet-tracker').find<Wallet>({ user_id }).toArray();
  }

  async createWallet(wallet: Wallet): Promise<Wallet> {
    if (!this.db) throw new Error('Database not connected');
    
    await this.db.collection('wallet-tracker').insertOne(wallet);
    return wallet;
  }
  
  async deleteWallet(walletAddress: string, user_id: string): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    await this.db.collection('wallet-tracker').deleteOne({ address: walletAddress, user_id });
  }

  async updateWallet(walletAddress: string, user_id: string, name: string): Promise<void> {
    if (!this.db) throw new Error('Database not connected');
    
    await this.db.collection('wallet-tracker').updateOne({ address: walletAddress, user_id }, { $set: { name } });
  }
}

export const dbService = new DatabaseService(); 