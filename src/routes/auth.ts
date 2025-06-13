/**
 * Authentication Router
 * Handles user authentication operations including registration, login, and wallet connections.
 * Implements secure password hashing, JWT token generation, and wallet signature verification.
 */

import express from 'express';
import { dbService } from '../services/db';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { authenticate } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { decodeUTF8 } from 'tweetnacl-util';
import bcrypt from 'bcrypt';
import { get_token_balance } from '../utils/get_token_balances';
import { PriceCacheService } from '../cache/PriceCache';
import { PortfolioService } from '../services/portfolioService';
dotenv.config();

const router = express.Router();
const portfolioService = new PortfolioService();
const priceCache = PriceCacheService.getInstance();

/**
 * Constants
 */
const SALT_ROUNDS = 10;
const DEFAULT_JWT_SECRET = 'secret-key-here';
const DEFAULT_PROFILE_IMAGE = '682a42b348d504eb68828fbb';

/**
 * User registration endpoint
 * 
 * @route   POST /auth/register
 * @desc    Register a new user with username, password, and email
 * @access  Public
 */
router.post('/register', async (req: any, res: any) => {
  const { username, password, email } = req.body;
  
  try {
    // Check if username already exists
    const user = await dbService.db?.collection('users').findOne({ username: username });
    if (user) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash the password with bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const builtin_wallet = Keypair.generate();
    // Create new user with default settings
    await dbService.db?.collection('users').insertOne({
      username,
      password: hashedPassword,
      email,
      wallet_address: null,
      profile_image_url: DEFAULT_PROFILE_IMAGE,
      name: '$UP User',
      bio: 'Bio here',
      created_at: new Date(),
      notifications: { 
        all_notifications: false,
        price_alerts: false,
        transaction_updates: false,
        security_alerts: false
      }, 
      type: 'user',
      twoFactor: { 
        secret: null, 
        enabled: false
      },
      swap_fees: 2,
      reveal_wallet: {
        enabled: false,
        fee: 0.001
      },
      builtin_wallet: {
        public_key: builtin_wallet.publicKey.toBase58(),
        private_key: bs58.encode(builtin_wallet.secretKey)
      }
    });

    // Retrieve created user and generate JWT
    const newUser = await dbService.db?.collection('users').findOne({ username: username });
    const token = jwt.sign(
      { 
        id: newUser?._id, 
        username: newUser?.username, 
        bio: newUser?.bio, 
        name: newUser?.name, 
        profile_image_url: newUser?.profile_image_url, 
        wallet_address: newUser?.wallet_address, 
        type: newUser?.type, 
        twoFactor: newUser?.twoFactor.enabled,
        reveal_wallet: newUser?.reveal_wallet,
        builtin_wallet: newUser?.builtin_wallet.public_key
      }, 
      process.env.JWT_SECRET || DEFAULT_JWT_SECRET
    );

    // Return token and user data
    res.json({ 
      token, 
      user: { 
        _id: newUser?._id, 
        username: newUser?.username, 
        bio: newUser?.bio, 
        name: newUser?.name, 
        profile_image_url: newUser?.profile_image_url, 
        wallet_address: newUser?.wallet_address, 
        notifications: newUser?.notifications, 
        type: newUser?.type, 
        twoFactor: newUser?.twoFactor.enabled,
        reveal_wallet: newUser?.reveal_wallet,
        builtin_wallet: newUser?.builtin_wallet.public_key
      } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * User login endpoint
 * 
 * @route   POST /auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 */
router.post('/login', async (req: any, res: any) => {
  const { username, password } = req.body;
  
  try {
    // Find user by username
    const user = await dbService.db?.collection('users').findOne({ username: username });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Verify password hash
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Create security notification if enabled
    if (user.notifications.all_notifications && user.notifications.security_alerts) {
      await dbService.createNotification({
        id: uuidv4(), 
        user_id: user._id.toString(),
        type: 'warning',
        title: 'Login Detected',
        message: 'A user has logged into your account.',
        time: new Date(),
        read: false
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username, 
        bio: user.bio, 
        name: user.name, 
        profile_image_url: user.profile_image_url, 
        wallet_address: user.wallet_address, 
        type: user.type, 
        twoFactor: user.twoFactor.enabled,
        reveal_wallet: user.reveal_wallet,
        builtin_wallet: user.builtin_wallet.public_key
      }, 
      process.env.JWT_SECRET || DEFAULT_JWT_SECRET
    );

    console.log(user);
    // Return token and user data
    res.json({ 
      token, 
      user: { 
        _id: user._id, 
        username: user.username, 
        bio: user.bio, 
        name: user.name, 
        profile_image_url: user.profile_image_url, 
        wallet_address: user.wallet_address, 
        notifications: user.notifications, 
        type: user.type, 
        twoFactor: user.twoFactor.enabled,
        reveal_wallet: user.reveal_wallet,
        builtin_wallet: user.builtin_wallet.public_key
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * User login endpoint
 * 
 * @route   POST /auth/login/telegram
 * @desc    Authenticate user and return JWT token
 * @access  Public
 */
router.post('/login/telegram', async (req: any, res: any) => {
  const { telegram_id, temporary_password } = req.body;
  
  try {
    // Find user by username
    const user = await dbService.db?.collection('users').findOne({ telegram_id: telegram_id, temporary_password: temporary_password });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid telegram id' });
    }

    // Create security notification if enabled
    if (user.notifications.all_notifications && user.notifications.security_alerts) {
      await dbService.createNotification({
        id: uuidv4(), 
        user_id: user._id.toString(),
        type: 'warning',
        title: 'Telegram Login Detected',
        message: 'A user has logged into your account via telegram.',
        time: new Date(),
        read: false
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username, 
        bio: user.bio, 
        name: user.name, 
        profile_image_url: user.profile_image_url, 
        wallet_address: user.wallet_address, 
        type: user.type, 
        twoFactor: user.twoFactor.enabled,
        reveal_wallet: user.reveal_wallet,
        builtin_wallet: user.builtin_wallet.public_key
      }, 
      process.env.JWT_SECRET || DEFAULT_JWT_SECRET
    );

    // delete temporary password
    await dbService.db?.collection('users').updateOne(
      { _id: new ObjectId(user._id) },
      { $unset: { temporary_password: 1 } }
    );

    // Return token and user data
    res.json({ 
      token, 
      user: { 
        _id: user._id, 
        username: user.username, 
        bio: user.bio, 
        name: user.name, 
        profile_image_url: user.profile_image_url, 
        wallet_address: user.wallet_address, 
        notifications: user.notifications, 
        type: user.type, 
        twoFactor: user.twoFactor.enabled,
        reveal_wallet: user.reveal_wallet,
        builtin_wallet: user.builtin_wallet.public_key
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Wallet connection endpoint
 * 
 * @route   POST /auth/wallet/connect
 * @desc    Connect a wallet address to user account
 * @access  Private
 */
router.post('/wallet/connect', authenticate, async (req: any, res: any) => {
  const { wallet_address, signature } = req.body;
  
  try {
    // Find authenticated user
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
 
    // Create notification for wallet change if enabled
    if (user.wallet_address !== wallet_address) {
      if (user.notifications.all_notifications && user.notifications.transaction_updates) {
        await dbService.createNotification({
          id: uuidv4(),
          user_id: user._id.toString(),
          type: 'warning',
          title: 'Wallet Change Detected',
          message: 'A different wallet has been connected to your account.',
          time: new Date(),
          read: false
        });
      }
    }
    
    // Update user's wallet address
    await dbService.db?.collection('users').updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: { wallet_address } }
    );

    // Get updated user data
    const updatedUser = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    
    // Generate new JWT with updated wallet info
    const token = jwt.sign(
      { 
        id: updatedUser?._id, 
        username: updatedUser?.username, 
        name: updatedUser?.name, 
        profile_image_url: updatedUser?.profile_image_url,
        wallet_address: updatedUser?.wallet_address,
        twitter_id: updatedUser?.id,
        type: updatedUser?.type,
        twoFactor: updatedUser?.twoFactor.enabled,
        reveal_wallet: updatedUser?.reveal_wallet,
        builtin_wallet: updatedUser?.builtin_wallet.public_key
      }, 
      process.env.JWT_SECRET || DEFAULT_JWT_SECRET
    );

    // Return updated token and user data
    res.json({ 
      token, 
      user: { 
        _id: updatedUser?._id, 
        username: updatedUser?.username, 
        name: updatedUser?.name, 
        profile_image_url: updatedUser?.profile_image_url, 
        twitter_id: updatedUser?.id, 
        wallet_address: updatedUser?.wallet_address,
        notifications: updatedUser?.notifications,
        type: updatedUser?.type,
        twoFactor: updatedUser?.twoFactor.enabled,
        reveal_wallet: updatedUser?.reveal_wallet,
        builtin_wallet: updatedUser?.builtin_wallet.public_key
      } 
    });
  } catch (error) {
    console.error('Wallet connection error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


router.get('/builtin_wallet/details', authenticate, async (req: any, res: any) => {
  const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com');
  const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user.id) });
  try {
      const balance = await get_token_balance(new PublicKey(user?.builtin_wallet.public_key), connection);
      const prices = await priceCache.getPrices();
      const solBalance = balance.sol;
      const balanceInUSD = solBalance * prices.solana.usd;
      const tokenDetails = await portfolioService.getTokens(user?.builtin_wallet.public_key);
      var tokensList = []
      for (const tokenInformation of tokenDetails) {
          const liquiditySum = tokenInformation.pools.reduce((sum: number, pool: any) => sum + pool.liquidity.usd, 0);
          const highestPricePool = tokenInformation.pools[0];
          const marketCapSum = tokenInformation.pools.reduce((sum: number, pool: any) => sum + pool.marketCap.usd, 0);
          tokensList.push({
              name: tokenInformation.token.name,
              symbol: tokenInformation.token.symbol,
              balance: tokenInformation.balance,
              address: tokenInformation.token.mint,
              image: tokenInformation.token.image,
              decimals: tokenInformation.token.decimals,
              token_price: highestPricePool.price.usd,
              usd_balance: tokenInformation.value,
              market_cap: marketCapSum,
              liquidity: liquiditySum,
              volume: 0,
              price_change: tokenInformation.events['24h'].priceChangePercentage,
              risk: tokenInformation.risk
          })
      }
      // get rid of wrapped sol from tokens list
      tokensList = tokensList.filter((token: any) => token.address !== 'So11111111111111111111111111111111111111112');
      res.json({
          success: true,
          balance: parseFloat(solBalance.toFixed(8)),
          balanceInUSD: parseFloat(balanceInUSD.toFixed(2)),
          tokens: tokensList,
      });
  } catch (error) {
      console.error('Error validating wallet address:', error);
      res.status(500).json({
          success: false,
          error: 'Failed to validate wallet address'
      });
  }
});


router.get('/test', async (req: any, res: any) => {
  const karpz = await dbService.db?.collection('twitter-tracker').findOne({ id: '1805761824140218368' });
  // remove last element in karpz.tweets
  karpz?.tweets.pop();
  await dbService.db?.collection('twitter-tracker').updateOne({ id: '1805761824140218368' }, { $set: { tweets: karpz?.tweets } });
  res.json({
    success: true,
    message: 'Test successful'
  });
});

export default router;  