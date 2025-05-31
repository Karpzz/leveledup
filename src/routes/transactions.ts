import express from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import { ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, PublicKey } from '@solana/web3.js';
import { Connection } from '@solana/web3.js';
import bs58 from 'bs58';
dotenv.config();
const router = express.Router();

router.post('/reveal', authenticate, async (req, res) => {
    const { userId } = req.body;
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(userId) });
    const currentUser = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (!currentUser || !currentUser.wallet_address) {
        return res.status(400).json({ message: 'Current user wallet not found' });
    }

    try {
        const connection = new Connection(process.env.RPC_URL || '', 'confirmed');
        const feeWallet = Keypair.fromSecretKey(
            bs58.decode(process.env.FEE_PRIVATE_KEY || '')
        );

        // Create a new transaction with the blockhash
        const transaction = new Transaction();

        // Calculate the fee splits
        const totalFee = user.reveal_wallet.fee * LAMPORTS_PER_SOL;
        const userShare = Math.floor(totalFee * 0.8); // 80% to user
        const feeShare = Math.floor(totalFee * 0.2);  // 20% to fee wallet

        // Add instruction to send 80% to user
        transaction.add(SystemProgram.transfer({
            fromPubkey: new PublicKey(currentUser.wallet_address),
            toPubkey: new PublicKey(user.wallet_address),
            lamports: userShare,
        }));
        // Add instruction to send 20% to fee wallet
        transaction.add(SystemProgram.transfer({
            fromPubkey: new PublicKey(currentUser.wallet_address),
            toPubkey: feeWallet.publicKey,
            lamports: feeShare,
        }));

        // Add both instructions to the transaction

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = new PublicKey(currentUser.wallet_address);

        // Serialize the transaction
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        }).toString('base64');

        res.json({ 
            success: true, 
            transaction: serializedTransaction,
            userShare,
            feeShare,
        });
    } catch (error: any) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create transaction',
            error: error.message 
        });
    }
});

router.post('/reveal/complete', authenticate, async (req, res) => {
    const { userId, signedTransaction } = req.body;
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(userId) });
    const currentUser = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    if (!currentUser || !currentUser.wallet_address) {
        return res.status(400).json({ message: 'Current user wallet not found' });
    }       

    try {
        const connection = new Connection(process.env.RPC_URL || '', 'confirmed');
        
        // Convert base64 string back to transaction
        const decodedTransaction = Buffer.from(signedTransaction, 'base64');
        
        // Send and get the signature
        const signature = await connection.sendRawTransaction(decodedTransaction);
        
        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(signature);
        
        if (confirmation.value.err) {
            throw new Error('Transaction failed to confirm');
        }

        res.json({
            success: true,
            signature,
            wallet_address: user.wallet_address,
            confirmed: true
        });
    } catch (error: any) {
        console.error('Error confirming transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm transaction',
            error: error.message
        });
    }
});


export default router;
