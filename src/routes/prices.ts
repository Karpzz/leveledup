import express from 'express';
import { PriceCacheService } from '../cache/PriceCache';
import { authenticate } from '../middleware/auth';
const router = express.Router();
const priceCache = PriceCacheService.getInstance();

// Get all prices
router.get('/', authenticate, async (req, res) => {
    try {
        const prices = await priceCache.getPrices();
        if (!prices) {
            return res.status(404).json({ message: 'Prices not available' });
        }
        res.json({ prices });
    } catch (error) {
        console.error('Error fetching prices:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get specific token price
router.get('/:token', authenticate, async (req, res) => {
    try {
        const { token } = req.params;
        const prices = await priceCache.getPrices();
        
        if (!prices) {
            return res.status(404).json({ message: 'Prices not available' });
        }

        const tokenPrice = prices[token.toLowerCase()];
        if (!tokenPrice) {
            return res.status(404).json({ message: `Price for ${token} not found` });
        }

        res.json({ 
            token,
            price: tokenPrice
        });
    } catch (error) {
        console.error('Error fetching token price:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
