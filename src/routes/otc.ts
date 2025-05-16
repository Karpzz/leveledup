import express from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';
dotenv.config();
const router = express.Router();

async function getTokenMetadata(mint: string) {
    const response = await axios.get(`https://api.jup.ag/tokens/v1/token/${mint}`);
    return response.data;
}

async function createOTCTrade(data: {
    creator: {
      userId: string;
      walletAddress: string;
    };
    token: {
      address: string;
      amount: string;
      recipient: string;
      metadata: any;
    };
    solana: {
      amount: string;
      recipient: string;
    };
    escrowWallet: string;
  }) {
    const collection = dbService.db?.collection('otc');
    const trade = {
      ...data,
      status: 'awaiting_token',
      status_message: "Waiting for tokens...",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 5 minutes from now
      tokenReceived: false,
      solReceived: false
    };
  
    const result = await collection?.insertOne(trade);
    return result;
  }
router.post('/create', authenticate, async (req: any, res: any) => {
    try {
        const {
            tokenAddress,
            tokenAmount,
            solAmount,
            tokenRecipientAddress,
            solanaRecipientAddress,
        } = req.body;

        const id = req.user?.id;

        // Get user details
        const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(id) });
        if (!user) {
            return res.status(401).json({
                error: 'User not found'
            });
        }
        
        // get token price
        // Generate escrow wallet
        const escrowKeypair = Keypair.generate();
        const escrowPublicKey = escrowKeypair.publicKey.toString();
        const escrowPrivateKey = escrowKeypair.secretKey.toString();
        // Create OTC trade record
        var jsonRes = {
            creator: {
                userId: id,
                walletAddress: user.publicKey
            },
            token: {
                address: tokenAddress,
                amount: tokenAmount,
                recipient: tokenRecipientAddress,
                metadata: await getTokenMetadata(tokenAddress)
            },
            solana: {
                amount: solAmount,
                recipient: solanaRecipientAddress
            },
            escrowWallet: escrowPublicKey,
            wallet_details: {
                publicKey: escrowPublicKey,
                privateKey: escrowPrivateKey,
            }
        }
        const result = await createOTCTrade(jsonRes);
        res.json({
            success: true,
            tradeId: result?.insertedId,
            escrowWallet: escrowPublicKey,
            trade: {
                creator: {
                    userId: id,
                    walletAddress: user.publicKey
                },
                token: {
                    address: tokenAddress,
                    amount: tokenAmount,
                    recipient: tokenRecipientAddress,
                    metadata: await getTokenMetadata(tokenAddress)
                },
                solana: {
                    amount: solAmount,
                    recipient: solanaRecipientAddress
                },
                escrowWallet: escrowPublicKey
            }
        });

    } catch (error) {
        console.error('Error creating OTC trade:', error);
        res.status(500).json({
            error: 'Failed to create trade'
        });
    }
});

router.get('/', authenticate, async (req: any, res: any) => {
    const id = req.user?.id;
    if (!dbService.db) {
        throw new Error('Database not connected');
    }
    const trades = await dbService.db.collection('otc').find({ 'creator.userId': id }).toArray();
    // filter trade so theres no wallet_details
    const filteredTrades = trades?.map((trade: any) => {
        return {
            ...trade,
            wallet_details: undefined
        }
    });
    res.json({
        success: true,
        trades: filteredTrades
    });
});
router.get('/trades/:tradeId', authenticate, async (req: any, res: any) => {
    const { tradeId } = req.params;
    if (!dbService.db) {
        throw new Error('Database not connected');
    }
    const trade = await dbService.db.collection('otc').findOne({ _id: new ObjectId(tradeId) });
    // filter trade so theres no wallet_details
    const filteredTrade = {
        ...trade,
        completedAt: trade?.updatedAt,
        wallet_details: undefined
    }
    res.json({
        success: true,
        trade: filteredTrade
    });
});

router.get('/validate/:walletAddress', async (req: any, res: any) => {
    const { walletAddress } = req.params;
    const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com');
    try {
        const balance = await connection.getBalance(new PublicKey(walletAddress));
        res.json({
            success: true,
            balance: balance / LAMPORTS_PER_SOL
        });
    } catch (error) {
        console.error('Error validating wallet address:', error);
        res.status(500).json({
            error: 'Failed to validate wallet address'
        });
    }
});

export default router;