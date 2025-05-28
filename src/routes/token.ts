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



router.get('/details/:token', authenticate, async (req: any, res: any) => {
    try {
        const { token } = req.params;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token address is required'
            });
        }

        const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user.id) });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const [holders, topTraders, userTradesResult] = await Promise.all([
            portfolioService.getHolders(token),
            portfolioService.getTopTraders(token),
            portfolioService.getWalletTradesByToken(user.wallet_address, token)
        ]);

        return res.json({
            success: true,
            data: {
                holders: holders || { accounts: [], total: 0 },
                top_traders: topTraders || [],
                trades: userTradesResult?.trades || []
            }
        });
    } catch (error: any) {
        console.error('Token details error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch token details'
        });
    }
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
