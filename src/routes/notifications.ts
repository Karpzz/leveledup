import express from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * GET /notifications
 * Retrieves all notifications for the authenticated user
 * Returns notifications sorted by time in descending order (newest first)
 * Also returns the user's notification settings
 * 
 * @requires authentication
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await dbService.db?.collection('notifications')
      .find({ user_id: req.user?.id })
      .sort({ time: -1 })
      .toArray();

    const user = await dbService.db?.collection('users')
      .findOne({ _id: new ObjectId(req.user?.id) });

    res.status(200).json({
      success: true,
      notifications,
      settings: user?.notifications,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /notifications/mark-all-read
 * Marks all notifications as read for the authenticated user
 * 
 * @requires authentication
 */
router.post('/mark-all-read', authenticate, async (req, res) => {
  try {
    await dbService.db?.collection('notifications').updateMany(
      { user_id: req.user?.id },
      { $set: { read: true } },
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /notifications/clear-all
 * Deletes all notifications for the authenticated user
 * 
 * @requires authentication
 */
router.post('/clear-all', authenticate, async (req, res) => {
  try {
    await dbService.db?.collection('notifications')
      .deleteMany({ user_id: req.user?.id });

    res.status(200).json({
      success: true,
      message: 'All notifications cleared',
    });
  } catch (error) {
    console.error('Error clearing all notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /notifications/:id/read
 * Marks a specific notification as read
 * 
 * @param {string} id - The ID of the notification to mark as read
 * @requires authentication
 */
router.post('/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await dbService.db?.collection('notifications').updateOne(
      { id, user_id: req.user?.id },
      { $set: { read: true } },
    );

    if (!result?.matchedCount) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * DELETE /notifications/:id
 * Deletes a specific notification
 * 
 * @param {string} id - The ID of the notification to delete
 * @requires authentication
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await dbService.db?.collection('notifications').deleteOne({
      id,
      user_id: req.user?.id,
    });

    if (!result?.deletedCount) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

/**
 * POST /notifications/:type/toggle
 * Toggles notification settings for a specific type
 * 
 * @param {string} type - The type of notification to toggle
 *                     - Possible values: 'price_alerts', 'transaction_updates', 
 *                                      'all_notifications', 'security_alerts'
 * @requires authentication
 */
router.post('/:type/toggle', authenticate, async (req, res) => {
  try {
    const { type } = req.params;
    const user = await dbService.db?.collection('users')
      .findOne({ _id: new ObjectId(req.user?.id) });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Determine notification title and description based on type
    let title;
    let description;
    switch (type) {
      case 'price_alerts':
        title = user.notifications[type] ? 'Price Alert Disabled' : 'Price Alert Enabled';
        description = user.notifications[type] 
          ? 'You will no longer receive price alerts.' 
          : 'You will now receive price alerts.';
        break;
      case 'transaction_updates':
        title = user.notifications[type] ? 'Transaction Updates Disabled' : 'Transaction Updates Enabled';
        description = user.notifications[type]
          ? 'You will no longer receive transaction updates.'
          : 'You will now receive transaction updates.';
        break;
      case 'all_notifications':
        title = user.notifications[type] ? 'All Notifications Disabled' : 'All Notifications Enabled';
        description = user.notifications[type]
          ? 'You will no longer receive any notifications.'
          : 'You will now receive all notifications.';
        break;
      default:
        title = user.notifications[type] ? 'Security Alerts Disabled' : 'Security Alerts Enabled';
        description = user.notifications[type]
          ? 'You will no longer receive security alerts.'
          : 'You will now receive security alerts.';
        break;
      case 'wallet_tracker':
        title = user.notifications[type] ? 'Wallet Tracker Disabled' : 'Wallet Tracker Enabled';
        description = user.notifications[type]
          ? 'You will no longer receive wallet tracker alerts.'
          : 'You will now receive wallet tracker alerts.';  
        break;
    }

    // Update notification settings
    if (type === 'all_notifications' && title === 'All Notifications Disabled') {
      // Disable all notification types when all_notifications is turned off
      await dbService.db?.collection('users').updateOne(
        { _id: user._id },
        {
          $set: {
            'notifications.all_notifications': false,
            'notifications.price_alerts': false,
            'notifications.transaction_updates': false,
            'notifications.security_alerts': false,
            'notifications.wallet_tracker': false,
          },
        },
      );
    } else {
      // Toggle single notification type
      await dbService.db?.collection('users').updateOne(
        { _id: user._id },
        { $set: { [`notifications.${type}`]: !user.notifications[type] } },
      );
    }

    // Create a notification to confirm the setting change
    await dbService.createNotification({
      id: uuidv4(),
      user_id: user._id.toString(),
      type: 'success',
      title: title,
      message: description,
      time: new Date(),
      read: false,
    });

    // Return updated notification settings
    const updatedUser = await dbService.db?.collection('users')
      .findOne({ _id: new ObjectId(req.user?.id) });

    res.status(200).json({
      success: true,
      message: 'Notification type toggled',
      notifications: updatedUser?.notifications,
    });
  } catch (error) {
    console.error('Error toggling notification type:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router; 