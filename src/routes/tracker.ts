import { Router } from 'express';
import { TwitterCache } from '../cache/TwitterCache';
import dotenv from 'dotenv';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import { ObjectId } from 'mongodb';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Connection } from '@solana/web3.js';
import { PriceCacheService } from '../cache/PriceCache';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { get_token_balance } from '../utils/get_token_balances';
import { PortfolioService } from '../services/portfolioService';
import fs from 'fs';
dotenv.config();

const router = Router();
const priceCache = PriceCacheService.getInstance();
const portfolioService = new PortfolioService();
// Initialize TwitterCache with environment variables
const twitterCache = new TwitterCache();
var idlist =['1805761824140218368', '1923865234558812160']

router.get('/twitter', authenticate, async (req, res) => {
    const { withTweets } = req.query;
    // check if withTweets is a "yes" or "no"
    const withTweetsBool = withTweets === "yes" ? true : false;

    // return all users where users array has req.user.id
    const users = await twitterCache.getAllTrackedUsers(withTweetsBool);
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

// update tracked wallet    
router.put('/wallets/:walletAddress', authenticate, async (req: any, res: any) => {
    const { walletAddress } = req.params;
    const { name } = req.body;
    await dbService.updateWallet(walletAddress, req.user?.id, name);
    res.json({
        success: true
    });
})
// get tracked wallets
router.get('/wallets', authenticate, async (req: any, res: any) => {
    const wallets = await dbService.getWallets(req.user?.id);
    res.json(wallets);
})
// create tracked wallet
router.post('/wallets', authenticate, async (req: any, res: any) => {
    const { walletAddress } = req.body;
    try {
        const wallet = await dbService.createWallet({ address: walletAddress, name: "Wallet", user_id: req.user?.id });
        res.json({
            success: true,
            wallet: wallet
        });
    } catch (error) {
        console.error('Failed to create wallet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create wallet'
        });
    }
})

// delete wallet tracked 
router.delete('/wallets/:walletAddress', authenticate, async (req: any, res: any) => {   
    const { walletAddress } = req.params;
    await dbService.deleteWallet(walletAddress, req.user?.id);
    res.json({
        success: true
    });
})
// validate wallet address
router.get('/wallets/validate/:walletAddress', async (req: any, res: any) => {
    const { walletAddress } = req.params;
    const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com');
    try {
        const balance = await get_token_balance(new PublicKey(walletAddress), connection);
        console.log(balance);
        const prices = await priceCache.getPrices();
        const solBalance = balance.sol;
        const balanceInUSD = solBalance * prices.solana.usd;
        res.json({
            success: true,
            balance: parseFloat(solBalance.toFixed(6)),
            balanceInUSD: parseFloat(balanceInUSD.toFixed(2)),
            tokens: balance.tokens
        });
    } catch (error) {
        console.error('Error validating wallet address:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate wallet address'
        });
    }
});

// get wallet details
router.get('/wallets/details/:walletAddress', async (req: any, res: any) => {
    const { walletAddress } = req.params;
    const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com');
    try {
        const balance = await get_token_balance(new PublicKey(walletAddress), connection);
        const prices = await priceCache.getPrices();
        const solBalance = balance.sol;
        const balanceInUSD = solBalance * prices.solana.usd;
        const tokenDetails = await portfolioService.getTokens(walletAddress);
        const trades = await portfolioService.getWalletTrades(walletAddress);
        const tokensList = []
        fs.writeFileSync('tokenDetails.json', JSON.stringify(tokenDetails, null, 2));
        for (const tokenInformation of tokenDetails) {
            const liquiditySum = tokenInformation.pools.reduce((sum: number, pool: any) => sum + pool.liquidity.usd, 0);
            const highestPricePool = tokenInformation.pools[0];
            const marketCapSum = tokenInformation.pools.reduce((sum: number, pool: any) => sum + pool.marketCap.usd, 0);
            const highestMarketCapPool = tokenInformation.pools.find((solToken: any) => solToken.marketCap.usd === Math.max(...tokenInformation.pools.map((t: any) => t.marketCap.usd)));
            console.log(tokenInformation.token.mint);
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
                instant_change: tokenInformation.events['1h'].priceChangePercentage,
                risk: tokenInformation.risk
            })
        }
        res.json({
            success: true,
            balance: parseFloat(solBalance.toFixed(6)),
            balanceInUSD: parseFloat(balanceInUSD.toFixed(2)),
            tokens: tokensList,
            trades: trades.trades
        });
    } catch (error) {
        console.error('Error validating wallet address:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate wallet address'
        });
    }
});

router.get('/token/details/:token', async (req: any, res: any) => {
    const { token } = req.params;
    const tokenDetails = await portfolioService.getTokenDetails(token);
    res.json(tokenDetails);
});

export default router;
