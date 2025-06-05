import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import dotenv from 'dotenv';
import { dbService } from '../services/db';
import { v4 as uuidv4 } from 'uuid';
import { getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import { ObjectId } from 'mongodb';
dotenv.config();

const router = Router();

interface SwapExecuteBody {
  signedTransaction: string;
  fromToken: string;
  toToken: string;
  amount: string;
  walletType: string;
}

router.post('/execute', authenticate, async (req, res) => {
  try {
    const { signedTransaction, fromToken, toToken, amount, walletType }: SwapExecuteBody = req.body;

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
        message: `A new swap has been executed. ${fromToken} -> ${toToken} ${walletType === 'builtin' ? 'using your built-in wallet' : 'using your connected wallet'}`,
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
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id as string) });
    if (user?.transactions.transaction_updates) {
      await dbService.createNotification({
        id: uuidv4(),
        user_id: req.user?.id as string,
        type: 'success',
        title: 'Swap Confirmed',
        message: 'A new swap has been confirmed.',
        time: new Date(),
        read: false
    });
    }

  } catch (error) {
    console.error('Swap execution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute swap',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/quote', authenticate, async (req, res) => {
  try {
    const { inputMint, outputMint, amount, wallet_address, includeSwap, slippageBps } = req.query;
    const params = new URLSearchParams({
      inputMint: inputMint as string,
      outputMint: outputMint as string,
      amount: amount as string,
      slippageBps: slippageBps as string,
      restrictIntermediateTokens: 'true',
      platformFeeBps: `${req.user?.swap_fees * 100}`,
      swapMode: 'ExactIn'
    });

    // Get quote from Jupiter
    const quote = await fetch(
      `https://quote-api.jup.ag/v6/quote?${params.toString()}`
    );
    const quoteResponse = await quote.json();

    // Initialize connection and fee wallet
    const connection = new Connection(process.env.RPC_URL || '', 'confirmed');
    const feeWallet = Keypair.fromSecretKey(
      bs58.decode(process.env.FEE_PRIVATE_KEY || '')
    );
    const returnJson = {
      success: true,
      quote: quoteResponse,
      swapData: null
    }
    if (includeSwap === "yes") {
      const mintPubkey = new PublicKey(
        outputMint as string
      );
      // Get or create ATA for fee account
      const feeTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        feeWallet,
        mintPubkey, // The token being received
        new PublicKey(process.env.FEE_PUBLIC_KEY || ''),
      );
  
      const swapBody = JSON.stringify({
        // Send the raw quote response
        quoteResponse,
        // Add user and fee information
        userPublicKey: wallet_address,
        feeAccount: feeTokenAccount.address.toBase58()
      })
      // Get swap transaction data
      returnJson.swapData = await (
        await fetch('https://lite-api.jup.ag/swap/v1/swap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: swapBody
        })
      ).json();
    }


    res.status(200).json(returnJson);
  } catch (error) {
    console.error('Error in swap quote:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get swap quote'
    });
  }
  
});

router.get('/builtin-buy', authenticate, async (req, res) => {
  try {
    const { inputMint, outputMint, amount, slippageBps, walletType, fromTokenSymbol, toTokenSymbol } = req.query;
    const params = new URLSearchParams({
      inputMint: inputMint as string,
      outputMint: outputMint as string,
      amount: amount as string,
      slippageBps: slippageBps as string,
      restrictIntermediateTokens: 'true',
      platformFeeBps: `${req.user?.swap_fees * 100}`,
      swapMode: 'ExactIn'
    });

    // Get quote from Jupiter
    const quote = await fetch(
      `https://quote-api.jup.ag/v6/quote?${params.toString()}`
    );
    const quoteResponse = await quote.json();

    // Initialize connection and fee wallet
    const connection = new Connection(process.env.RPC_URL || '', 'confirmed');
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id as string) });
    const feeWallet = Keypair.fromSecretKey(
      bs58.decode(process.env.FEE_PRIVATE_KEY || '')
    );
    const builtinWallet = Keypair.fromSecretKey(
      bs58.decode(user?.builtin_wallet.private_key || '')
    );
    const wallet_address: string = builtinWallet.publicKey.toBase58();
    console.log(wallet_address);
    const mintPubkey = new PublicKey(
      outputMint as string
    );
    // Get or create ATA for fee account
    const feeTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      feeWallet,
      mintPubkey, // The token being received
      new PublicKey(process.env.FEE_PUBLIC_KEY || ''),
    );

    const swapBody = JSON.stringify({
      // Send the raw quote response
      quoteResponse,
      // Add user and fee information
      userPublicKey: wallet_address,
      feeAccount: feeTokenAccount.address.toBase58()
    });

    // Get swap transaction data
    const swapData = await (
      await fetch('https://lite-api.jup.ag/swap/v1/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: swapBody
      })
    ).json();
    // Deserialize the transaction
    const transaction = VersionedTransaction.deserialize(
      Buffer.from(swapData.swapTransaction, 'base64')
    );

    // Sign transaction with the builtin wallet
    transaction.sign([builtinWallet]);

    // Send and confirm transaction
    const signature = await connection.sendTransaction(transaction);
    
    // Wait for confirmation
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
      signature
    });
    if (user?.notifications.transaction_updates) {
      await dbService.createNotification({
        id: uuidv4(),
        user_id: req.user?.id as string,
        type: 'success',
        title: 'Swap Confirmed',
        message: `A new swap has been confirmed. ${fromTokenSymbol} -> ${toTokenSymbol} ${walletType === 'builtin' ? 'using your built-in wallet' : 'using your connected wallet'}`,
        time: new Date(),
        read: false
      });
    }
    
  } catch (error) {
    console.error('Error in swap quote:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute swap'
    });
  }
});

export default router;
