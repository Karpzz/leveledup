import express from 'express';
import { dbService } from '../services/db';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { authenticate } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58'
import nacl from 'tweetnacl';
import { decodeUTF8 } from 'tweetnacl-util';
import bcrypt from 'bcrypt';
dotenv.config();

const router = express.Router();

const SALT_ROUNDS = 10;

router.post('/register', async (req: any, res: any) => {
  const { username, password, email } = req.body;
  
  try {
    const user = await dbService.db?.collection('users').findOne({ username: username });
    if (user) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await dbService.db?.collection('users').insertOne({
      username: username,
      password: hashedPassword,
      email: email,
      wallet_address: null,
      profile_image_url: '682a42b348d504eb68828fbb',
      name: '$UP User',
      bio: 'Bio here',
      created_at: new Date(),
      notifications: { 
        price_alerts: false,
        transaction_updates: false,
        security_alerts: false
      }, 
      type: 'user',
      twoFactor: { 
        secret: null, 
        enabled: false
      } 
    });

    const newUser = await dbService.db?.collection('users').findOne({ username: username });
    const token = jwt.sign({ id: newUser?._id, username: newUser?.username, name: newUser?.name, profile_image_url: newUser?.profile_image_url, wallet_address: newUser?.wallet_address, type: newUser?.type, twoFactor: newUser?.twoFactor.enabled }, process.env.JWT_SECRET || 'secret-key-here');
    res.json({ token, user: { _id: newUser?._id, username: newUser?.username, name: newUser?.name, profile_image_url: newUser?.profile_image_url, wallet_address: newUser?.wallet_address, notifications: newUser?.notifications, type: newUser?.type, twoFactor: newUser?.twoFactor.enabled } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/login', async (req: any, res: any) => {
  const { username, password } = req.body;
  try {
    const user = await dbService.db?.collection('users').findOne({ username: username });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    await dbService.createNotification({
      id: uuidv4(), 
      user_id: user._id.toString(),
      type: 'warning',
      title: 'Login Detected',
      message: 'A user has logged into your account.',
      time: new Date(),
      read: false
    });

    const token = jwt.sign({ id: user._id, username: user.username, name: user.name, profile_image_url: user.profile_image_url, wallet_address: user.wallet_address, type: user.type, twoFactor: user.twoFactor.enabled }, process.env.JWT_SECRET || 'secret-key-here');
    res.json({ token, user: { _id: user._id, username: user.username, name: user.name, profile_image_url: user.profile_image_url, wallet_address: user.wallet_address, notifications: user.notifications, type: user.type, twoFactor: user.twoFactor.enabled } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/wallet/connect', authenticate, async (req: any, res: any) => {
  const { wallet_address, signature } = req.body;
  try {
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
 
    if (user.wallet_address !== wallet_address) {
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
    
    // Update user with wallet address
    await dbService.db?.collection('users').updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: { wallet_address } }
    );

    const updatedUser = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    
    const token = jwt.sign(
      { 
        id: updatedUser?._id, 
        username: updatedUser?.username, 
        name: updatedUser?.name, 
        profile_image_url: updatedUser?.profile_image_url,
        wallet_address: updatedUser?.wallet_address,
        twitter_id: updatedUser?.id,
        type: updatedUser?.type,
        twoFactor: updatedUser?.twoFactor.enabled
      }, 
      process.env.JWT_SECRET || 'secret-key-here'
    );

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
        twoFactor: updatedUser?.twoFactor.enabled
      } 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

async function verifyMessage({ message, signature, publicKey }: { message: string, signature: string, publicKey: PublicKey }) {
    try {
        const messageBytes = decodeUTF8(message);
        const signatureBytes = bs58.decode(signature);
        const publicKeyBytes = publicKey.toBytes();

        return nacl.sign.detached.verify(
            messageBytes,
            signatureBytes,
            publicKeyBytes
        );
    } catch (error) {
        console.error('Error verifying message:', error);
        return false;
    }
}

export default router;  