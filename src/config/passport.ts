import passport from 'passport';
import { Strategy } from '@superfaceai/passport-twitter-oauth2';
import { dbService } from '../services/db';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

passport.serializeUser((user: any, done: any) => {
  done(null, user);
});

passport.deserializeUser((obj: any, done: any) => {
  done(null, obj);
});

passport.use(
  new Strategy(
    {
      clientID: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      clientType: 'confidential',
      callbackURL: `${process.env.BASE_URL}/auth/twitter/callback`,
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      try {
        const userData = {
          id: profile._json.id,
          name: profile._json.name,
          username: profile._json.username,
          profile_image_url: profile._json.profile_image_url,
          accessToken,
          refreshToken,
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
        };
        
        await dbService.upsertUser(userData);
        await dbService.createNotification({
          id: uuidv4(),
          user_id: userData.id,
          type: 'success',
          title: 'Welcome to the app',
          message: 'You have successfully signed up for the app',
          time: new Date(),
          read: false
        });
        return done(null, userData);
      } catch (err) {
        console.error('Error storing user data:', err);
        return done(err as Error);
      }
    }
  )
);

export default passport; 