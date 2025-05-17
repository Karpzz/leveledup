import express from 'express';
import passport from '../config/passport';
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
dotenv.config();

const router = express.Router();

router.get('/twitter', (req, res, next) => {
  passport.authenticate('twitter', {
    scope: ['tweet.read', 'users.read', 'offline.access'],
  })(req, res, next);
});

router.get(
  '/twitter/callback',
  passport.authenticate('twitter'),
  async function (req: any, res: any) {
    const userMongo = await dbService.getUser(req.user.id);
    // add userData to the redirect url as a base64 string
    const redirectUrl = '/' as string;
    const base64UserData = Buffer.from(JSON.stringify({ _id: userMongo?._id, name: userMongo?.name, username: userMongo?.username, profile_image_url: userMongo?.profile_image_url, twitter_id: userMongo?.id })).toString('base64');
    const redirectUrlWithUserData = `${redirectUrl}?user=${base64UserData}`;
    res.redirect(redirectUrlWithUserData);
  }
);

router.post('/login', async (req: any, res: any) => {
  const { id } = req.body;
  try {
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(id) });
    if (!user) {
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

    const token = jwt.sign({ id: user._id, username: user.username, name: user.name, profile_image_url: user.profile_image_url, twitter_id: user.id , wallet_address: user.wallet_address, type: user.type, twoFactor: user.twoFactor.enabled }, process.env.JWT_SECRET || 'secret-key-here');
    res.json({ token, user: { _id: user._id, username: user.username, name: user.name, profile_image_url: user.profile_image_url, twitter_id: user.id , wallet_address: user.wallet_address, notifications: user.notifications, type: user.type, twoFactor: user.twoFactor.enabled } });
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