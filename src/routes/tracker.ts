import { Router } from 'express';
import { TwitterCache } from '../cache/TwitterCache';
import dotenv from 'dotenv';
import { authenticate } from '../middleware/auth';
dotenv.config();

const router = Router();

// Initialize TwitterCache with environment variables
const twitterCache = new TwitterCache();

async () => {
    await twitterCache.run();
}

var idlist =['1805761824140218368', '1923865234558812160']

router.get('/twitter', authenticate, async (req, res) => {
    const { withTweets } = req.query;
    // check if withTweets is a "yes" or "no"
    const withTweetsBool = withTweets === "yes" ? true : false;

    // return all users where users array has req.user.id
    const users = await twitterCache.getAllTrackedUsers(withTweetsBool);
    console.log(users);
    const usersFiltered = users.filter((user) => user.users.includes(req.user?.id) || idlist.includes(user.user_id));
    // remove users array from each user before sending response
    var userData = usersFiltered.map((user) => {
        const { users: _, ...userData } = user;
        return userData;
    });

    res.json(userData);
});

router.get('/twitter/alltweets', authenticate, async (req, res) => {
    const users = await twitterCache.getAllTrackedUsers(true);
    const usersFiltered = users.filter((user) => user.users.includes(req.user?.id) || idlist.includes(user.user_id));
    const allTweets = usersFiltered.map((user) => user.tweets).flat();
    res.json(allTweets);
});
router.get('/twitter/user/:userId', authenticate, async (req, res) => {
    const { userId } = req.params;
    const user = await twitterCache.getTrackedUser(userId);
    // remove users array from user before sending response
    const { users, ...userData } = user || { users: [] };

    res.json(userData);
});

router.delete('/twitter/user/:userId', authenticate, async (req, res) => {
    const { userId } = req.params;
    const user = await twitterCache.getTrackedUser(userId);
    // remove the req.user.id from teh users array and check if its empty after, if so remove the user from the database
    if (user) {
        user.users = user.users.filter((id: string) => id !== req.user?.id);
        await twitterCache.updateTrackerUsersList(userId, user.users);
    }
    // remove users array from user before sending response
    const { users, ...userData } = user || { users: [] };

    res.json(userData);
});
router.get('/twitter/search/:query', authenticate, async (req, res) => {
    const { query } = req.params;
    const users = await twitterCache.getUserDetails(query, null);
    res.json(users);
});
// Add user to tracking
router.post('/twitter', authenticate, async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await twitterCache.getTrackedUser(userId);
    if (user) {
        // check if user is already in the users array
        if (user.users.includes(req.user?.id)) {
            return res.status(400).json({ error: 'User already in tracking' });
        }
        // add user to the users array
        user.users.push(req.user?.id);
        await twitterCache.updateTrackerUsersList(userId, user.users);
    } else {
        // create new user
        await twitterCache.updateUser(userId, req.user?.id);
    }
    res.json({ message: 'User added to tracking successfully' });
  } catch (error) {
    console.error('Failed to add user to tracking:', error);
    res.status(500).json({ error: 'Failed to add user to tracking' });
  }
});
export default router;
