import { Router } from 'express';
import dotenv from 'dotenv';
import { PortfolioService } from '../services/portfolioService';
import { authenticate } from '../middleware/auth';
import { Connection, PublicKey } from '@solana/web3.js';
import { get_token_balance } from '../utils/get_token_balances';
import { PriceCacheService } from '../cache/PriceCache';
import { dbService } from '../services/db';
import { ObjectId } from 'mongodb';
dotenv.config();

const router = Router();
const portfolioService = new PortfolioService();
// Initialize TwitterCache with environment variables



router.get('/details/:token',  authenticate, async (req: any, res: any) => {
    const { token } = req.params;
    let holders, topTraders, userTrades;
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    try {
        holders = await portfolioService.getHolders(token);
        topTraders = await portfolioService.getTopTraders(token);
        userTrades = await portfolioService.getWalletTradesByToken(user?.wallet_address, token);
    } catch (error) {
        console.error(error);
    }
    res.json({
        holders: holders,
        top_traders: topTraders,
        trades: userTrades.trades
    });
});

router.get('/balances/:token',  authenticate, async (req: any, res: any) => {
    const { token } = req.params;
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com');
    const token_account = await get_token_balance(new PublicKey(user?.wallet_address), connection);
    const solPrice = await PriceCacheService.getInstance().getPrices();
    const tokenFound = token_account.tokens.find((t: any) => t.tokenAddress === token);
    res.json({
        solana: {
            sol: token_account.sol,
            usd: token_account.sol * solPrice.solana.usd,
            sol_price_usd: solPrice.solana.usd
        },
        token: tokenFound
    });
});

export default router;
