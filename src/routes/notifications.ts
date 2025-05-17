import express from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';

const router = express.Router();

// Get all notifications for a user
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await dbService.db?.collection('notifications')
      .find({ user_id: req.user?.id })
      .sort({ time: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await dbService.db?.collection('notifications').updateOne(
      { id, user_id: req.user?.id },
      { $set: { read: true } }
    );

    if (!result?.matchedCount) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Mark all notifications as read
router.post('/read-all', authenticate, async (req, res) => {
  try {
    await dbService.db?.collection('notifications').updateMany(
      { user_id: req.user?.id },
      { $set: { read: true } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error updating notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete a notification
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await dbService.db?.collection('notifications').deleteOne({
      id,
      user_id: req.user?.id
    });

    if (!result?.deletedCount) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router; 