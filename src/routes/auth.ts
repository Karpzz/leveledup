import express from 'express';
import passport from '../config/passport';
import { dbService } from '../services/db';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import dotenv from 'dotenv';

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

router.post('/auth/login', async (req: any, res: any) => {
  const { id } = req.body;
  try {
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(id) });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    const token = jwt.sign({ id: user._id, username: user.username, name: user.name, profile_image_url: user.profile_image_url }, process.env.JWT_SECRET || 'secret-key-here');
    res.json({ token, user: { _id: user._id, username: user.username, name: user.name, profile_image_url: user.profile_image_url, twitter_id: user.id , wallet_address: user.wallet_address } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;  