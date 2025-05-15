import express from 'express';
import passport from '../config/passport';
import { dbService } from '../services/db';


const router = express.Router();

router.get('/twitter', (req, res, next) => {
  passport.authenticate('twitter', {
    scope: ['tweet.read', 'users.read', 'offline.access'],
  })(req, res, next);
});

router.get(
    '/twitter/callback',
    passport.authenticate('twitter'),
    async function(req: any, res: any) {
        const userMongo = await dbService.getUser(req.user.id);
       // add userData to the redirect url as a base64 string
        const redirectUrl = '/' as string;
        const base64UserData = Buffer.from(JSON.stringify({_id: userMongo?._id, name: userMongo?.name, username: userMongo?.username, profile_image_url: userMongo?.profile_image_url})).toString('base64');
        const redirectUrlWithUserData = `${redirectUrl}?user=${base64UserData}`;
        res.redirect(redirectUrlWithUserData);
    }
);

export default router;  