/**
 *   Router
 * Handles leaderboard data.
 * Provides endpoints for retrieving leaderboard data.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';

const router = Router();

/**
 * Get global leaderboard
 * 
 * @route   GET /leaderboard
 * @desc    Retrieve global leaderboard data ranked by performance
 * @access  Private
 */
router.get('/all', authenticate, async (req, res) => {
  try {
    const users = await dbService.db?.collection('users')
      .find(
        { 'portfolioPnl.historic.summary': { $exists: true, $ne: null } },
        {
          projection: {
            username: 1,
            wallet_address: 1,
            'portfolioPnl.historic.summary': 1,
            
            profile_image_url: 1
          }
        }
      )
      .toArray();

    // Map users to ensure consistent data structure
    const leaderboard = users?.map(user => ({
      username: user.username || 'Anonymous',
      wallet_address: user.wallet_address ? `${user.wallet_address.slice(0, 4)}...${user.wallet_address.slice(-4)}` : '',
      portfolioPnl: user.portfolioPnl?.historic?.summary || 0   ,
      pnlUpdatedAt: user.portfolioPnl?.pnl_since || 0,
      profile_image_url: user.profile_image_url || ''
    })) || [];

    // CHECK TO SEE IF THE USER IS IN THE LEADERBOARD
    const user = await dbService.db?.collection('users').findOne({ wallet_address: req.user?.wallet_address });
    const isInLeaderboard = leaderboard.some(user => user.wallet_address === req.user?.wallet_address);

    res.status(200).json({
      success: true,
      leaderboard,
      isInLeaderboard
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard data'
    });
  }
});

export default router; 