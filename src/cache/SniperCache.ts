import WebSocket from 'ws';
import fs from 'fs';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, VersionedTransaction } from '@solana/web3.js';
import { MongoClient, Db } from 'mongodb';
import bs58 from 'bs58';

// Type for a user eligible for sniping
interface SniperUser {
  _id: string;
  walletSecret: Uint8Array;
  sniper: { enabled: boolean; amount: number };
}

const HELIUS_WS_URL = `wss://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export class SniperCache {
  private ws: WebSocket | null = null;
  private retryCount = 0;
  private db!: Db;
  private retryTimeout: NodeJS.Timeout | null = null;
  private subscriptionId: number | null = null;
  private connection: Connection
  private client: MongoClient;
  constructor() {
    this.connection = new Connection(process.env.RPC_URL || '');
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not defined');
    this.client = new MongoClient(uri);
    this.db = this.client.db(process.env.DB_NAME || 'leveledup');
    console.log('SniperCache connected to MongoDB');
  }
  public start() {
    this.connect();
    process.on('SIGINT', () => this.cleanup());
  }

  private connect() {
    this.ws = new WebSocket(HELIUS_WS_URL);

    this.ws.on('open', () => {
      this.retryCount = 0;
      this.sendLogsSubscribe();
      this.startPing();
      console.log('WebSocket is open and subscription request sent.');
    });

    this.ws.on('message', async (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.method === 'logsNotification') {
        const logs = parsed.params.result.value.logs;

        const logStr = logs.join(" ").toLowerCase();
        const isMintInit = logStr.includes("initializemint");
        if (isMintInit) {
          const tx = await this.connection.getTransaction(parsed.params.result.value.signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });

          if (tx === null) return
          const tokenAddress = tx.meta?.postTokenBalances?.[0]?.mint;
          if (tokenAddress === undefined || tokenAddress === null || tokenAddress === "So11111111111111111111111111111111111111112") return
          fs.writeFileSync(`tx/${parsed.params.result.value.signature}.json`, JSON.stringify(tx, null, 2));
          this.initiateSnipe(tokenAddress);
        }

      }
    });

    this.ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });

    this.ws.on('close', () => {
      console.log('WebSocket is closed');
      if (this.subscriptionId) {
        console.log('Last subscription ID was:', this.subscriptionId);
      }
      this.reconnect();
    });
  }

  private sendLogsSubscribe() {
    // Example: Listen to Raydium, Pump AMM, or Token program for new mints
    // Replace with the program(s) you want to monitor
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'logsSubscribe',
      params: [
        {
          mentions: [
            '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
          ]
        },
        { commitment: 'confirmed' }
      ]
    };
    this.ws?.send(JSON.stringify(request));
  }

  private startPing() {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private reconnect() {
    if (this.retryCount >= MAX_RETRIES) {
      console.error('Max retry attempts reached. Please check your connection and try again.');
      return;
    }
    const delay = INITIAL_RETRY_DELAY * Math.pow(2, this.retryCount);
    console.log(`Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${this.retryCount + 1}/${MAX_RETRIES})`);
    this.retryTimeout = setTimeout(() => {
      this.retryCount++;
      this.connect();
    }, delay);
  }

  private cleanup() {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    if (this.ws) this.ws.close();
    process.exit();
  }

  // Fetch users with sniper enabled (replace with your DB logic)
  private async getEnabledSniperUsers(): Promise<any[]> {
    // Example: return await User.find({ 'sniper.enabled': true });
    return await this.db.collection('users').find({ 'sniper.enabled': true }).toArray();
  }

  // Execute the snipe for a user (replace with your swap logic)
  private async snipeTokenForUser(user: any, tokenMint: string) {
    // Use user's wallet and Jupiter API to buy the token
    // See: https://docs.jup.ag/
    const wallet = Keypair.fromSecretKey(bs58.decode(user.builtin_wallet.private_key));
    const feeWallet = Keypair.fromSecretKey(bs58.decode(process.env.FEE_PRIVATE_KEY || ''));
    var balance = await this.connection.getBalance(wallet.publicKey) / LAMPORTS_PER_SOL - 0.01;
    if (balance < 0) balance = 0;
    // take 5% of snipe amount to send to fee wallet
    const feeAmount = user.sniper.amount * 0.05;
    const snipeAmount = user.sniper.amount - feeAmount;
    if (balance <= user.sniper.amount) return console.log(`[SNIPER] @${user.username} - Not enough balance (${balance} SOL) to snipe ${user.sniper.amount} SOL`);
    // swap fro token
    const params = new URLSearchParams({
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: tokenMint as string,
      amount: (snipeAmount * 10 ** 9).toFixed(0).toString(),
      swapMode: 'ExactIn',
      taker: wallet.publicKey.toBase58()
    });
    // Get quote from Jupiter
    const quote = await fetch(
      `https://ultra-api.jup.ag/order?${params.toString()}`
    );

    const order = await quote.json();
    if (order.transaction) {
      
      // Decode and deserialize the transaction
      const transaction = VersionedTransaction.deserialize(Buffer.from(order.transaction, 'base64'));

      // Sign the transaction
      transaction.sign([wallet]);

      // Send the transaction directly
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        { 
          skipPreflight: true,
          maxRetries: 3,
          preflightCommitment: 'confirmed'
        }
      );

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        console.error('Snipe failed:', confirmation.value.err);
      } else {
        console.log('Snipe successful! - token address: ' + tokenMint + ' - signature: ' + signature);
        console.log(`https://solscan.io/tx/${signature}`);
      }

      // Send fee transaction
      const feeTransaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: feeWallet.publicKey,
          lamports: feeAmount * LAMPORTS_PER_SOL,
        })
      );

      const feeSignature = await sendAndConfirmTransaction(
        this.connection,
        feeTransaction,
        [wallet],
        { skipPreflight: true, maxRetries: 3 }
      );
      console.log(`[SNIPER] ${user.username} - Snipe transaction sent: ${signature}`);
      console.log(`[SNIPER] ${user.username} - Fee transaction sent: ${feeSignature}`);
      console.log(`[SNIPER] ${user.username} - Amount: ${snipeAmount} SOL`);
      console.log(`[SNIPER] ${user.username} - Fee: ${feeAmount} SOL`);
      return;
    }
    console.log(`[SNIPER] ${user.username} - No transaction in quote response`);
    return;
  }

  private async initiateSnipe(tokenMint: string) {
    const users = await this.getEnabledSniperUsers();
    for (const user of users) {
      this.snipeTokenForUser(user, tokenMint);
    }
  }
}

