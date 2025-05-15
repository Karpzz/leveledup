import express from 'express';

const router = express.Router();

// Get specific token price
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        if (!token) {
            return res.status(400).json({ message: 'Token is required' });
        }

        const response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${token}/report`)
        const data = await response.json()
        res.json(data)
    } catch (error) {
        console.error('Error fetching token price:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
