import express from 'express';
import { NewsCacheService } from '../cache/NewsCache'
import { authenticate } from '../middleware/auth';
const router = express.Router();
const newsCache = new NewsCacheService();
// Get all prices
router.get('/', authenticate, async (req, res) => {
    try {
        const news = await newsCache.getNews();
        if (!news) {
            return res.status(404).json({ message: 'News not available' });
        }
        res.json(news);
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
