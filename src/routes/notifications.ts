import express from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
const router = express.Router();

// Get all notifications for a user
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await dbService.db?.collection('notifications')
      .find({ user_id: req.user?.id })
      .sort({ time: -1 })
      .toArray();
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });

    res.status(200).json({
      success: true,
      notifications,
      settings: user?.notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.post('/mark-all-read', authenticate, async (req, res) => {
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
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
})

router.post('/clear-all', authenticate, async (req, res) => {
    try {
        await dbService.db?.collection('notifications').deleteMany({ user_id: req.user?.id });
        res.status(200).json({
            success: true,
            message: 'All notifications cleared'
        });
    }    catch (error) {
        console.error('Error clearing all notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
})

// Mark notification as read
router.post('/:id/read', authenticate, async (req, res) => {
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

router.post('/:type/toggle', authenticate, async (req, res) => {
    try {
        const { type } = req.params;
        const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        await dbService.db?.collection('users').updateOne(
            { _id: user._id },
            { $set: { [`notifications.${type}`]: !user.notifications[type] } }
        );
        var title;
        var description;
        if (type === 'price_alerts') {
            title = user.notifications[type] ? 'Price Alert Disabled' : 'Price Alert Enabled';
            description = user.notifications[type] ? 'You will no longer receive price alerts.' : 'You will now receive price alerts.';
        } else if (type === 'transaction_updates') {
            title = user.notifications[type] ? 'Transaction Updates Disabled' : 'Transaction Updates Enabled';
            description = user.notifications[type] ? 'You will no longer receive transaction updates.' : 'You will now receive transaction updates.';
        } else {
            title = user.notifications[type] ? 'Security Alerts Disabled' : 'Security Alerts Enabled';
            description = user.notifications[type] ? 'You will no longer receive security alerts.' : 'You will now receive security alerts.';
        }
        await dbService.createNotification({
            id: uuidv4(),
            user_id: user._id.toString(),
            type: 'success',
            title: title,
            message: description,
            time: new Date(),
            read: false
        });
        const updatedUser = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });
        res.status(200).json({
            success: true,
            message: 'Notification type toggled',
            notifications: updatedUser?.notifications
        });
    } catch (error) {
        console.error('Error toggling notification type:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
})
export default router; 