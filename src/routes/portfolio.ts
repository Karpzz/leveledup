import express from 'express';
import { authenticate } from '../middleware/auth';
import { PortfolioService } from '../services/portfolioService';

const router = express.Router();
const portfolioService = new PortfolioService();
router.get('/', authenticate, async (req, res) => {
    try {
        const portfolio = await portfolioService.getTokenPortfolio(req.user?.wallet_address || '');
        if (!portfolio) {
            return res.status(404).json({ message: 'Portfolio not available' });
        }
        res.json(portfolio);
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// Get all prices
router.get('/:wallet_address', authenticate, async (req, res) => {
    var { wallet_address } = req.params;
    if (!wallet_address) {
        wallet_address = req.user?.wallet_address;
    }
    try {
        const portfolio = await portfolioService.getTokenPortfolio(wallet_address);
        if (!portfolio) {
            return res.status(404).json({ message: 'Portfolio not available' });
        }
        res.json(portfolio);
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
