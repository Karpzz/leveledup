import express from 'express';
import { authenticate } from '../middleware/auth';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import dotenv from 'dotenv';
import { dbService } from '../services/db';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

const router = express.Router();

interface SwapExecuteBody {
  signedTransaction: string;
  fromToken: string;
  toToken: string;
  amount: string;
}

router.post('/execute', authenticate, async (req, res) => {
  try {
    const { signedTransaction, fromToken, toToken, amount }: SwapExecuteBody = req.body;

    if (!signedTransaction || !fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }

    const connection = new Connection(process.env.RPC_URL || '', 'confirmed');
    
    // Deserialize the transaction
    const transaction = VersionedTransaction.deserialize(Buffer.from(signedTransaction, 'base64'));
    await dbService.createNotification({
        id: uuidv4(),
        user_id: req.user?.id as string,
        type: 'success',
        title: 'Swap Executed',
        message: 'A new swap has been executed.',
        time: new Date(),
        read: false
    });
    // Send and confirm transaction
    const signature = await connection.sendTransaction(transaction);
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      return res.status(400).json({
        success: false,
        message: 'Transaction failed',
        error: confirmation.value.err
      });
    }

    res.status(200).json({
      success: true,
      signature,
      fromToken,
      toToken,
      amount
    });

    await dbService.createNotification({
        id: uuidv4(),
        user_id: req.user?.id as string,
        type: 'success',
        title: 'Swap Confirmed',
        message: 'A new swap has been confirmed.',
        time: new Date(),
        read: false
    });

  } catch (error) {
    console.error('Swap execution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute swap',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
