import express from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Generate 2FA secret and QR code
router.post('/setup', authenticate, async (req, res) => {
    try {
        const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });
        
        if (user?.twoFactor?.enabled) {
            return res.status(400).json({
                success: false,
                message: '2FA is already enabled'
            });
        }

        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `Leveled Up - ${user?.username}`,
            length: 16
        });

        // Generate QR code
        const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

        // Store temporary secret
        await dbService.db?.collection('users').updateOne(
            { _id: new ObjectId(req.user?.id) },
            { 
                $set: { 
                    'twoFactorTemp': {
                        secret: secret.base32,
                        verified: false,
                        createdAt: new Date()
                    }
                } 
            }
        );

        // Create notification
        await dbService.createNotification({
            id: uuidv4(),
            user_id: req.user?.id as string,
            type: 'info',
            title: '2FA Setup Initiated',
            message: 'Two-factor authentication setup has been initiated. Please complete the verification process.',
            time: new Date(),
            read: false
        });

        res.json({
            success: true,
            qrCode,
            secret: secret.base32 // Backup key for manual entry
        });
    } catch (error) {
        console.error('2FA setup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to setup 2FA'
        });
    }
});

// Verify and enable 2FA
router.post('/verify', authenticate, async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }

        const user = await dbService.db?.collection('users').findOne({
            _id: new ObjectId(req.user?.id)
        });

        if (!user?.twoFactorTemp?.secret) {
            return res.status(400).json({
                success: false,
                message: '2FA setup not initiated'
            });
        }

        // Check if temp secret is not too old (15 minutes)
        const tempSecretAge = new Date().getTime() - new Date(user.twoFactorTemp.createdAt).getTime();
        if (tempSecretAge > 15 * 60 * 1000) {
            await dbService.db?.collection('users').updateOne(
                { _id: new ObjectId(req.user?.id) },
                { $unset: { twoFactorTemp: "" } }
            );
            return res.status(400).json({
                success: false,
                message: '2FA setup expired, please start over'
            });
        }

        // Verify token
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorTemp.secret,
            encoding: 'base32',
            token: token
        });

        if (!verified) {
            return res.status(400).json({
                success: false,
                message: 'Invalid token'
            });
        }

        // Enable 2FA
        await dbService.db?.collection('users').updateOne(
            { _id: new ObjectId(req.user?.id) },
            {
                $set: {
                    twoFactor: {
                        secret: user.twoFactorTemp.secret,
                        enabled: true,
                        enabledAt: new Date()
                    }
                },
                $unset: { twoFactorTemp: "" }
            }
        );

        // Create notification
        await dbService.createNotification({
            id: uuidv4(),
            user_id: req.user?.id as string,
            type: 'success',
            title: '2FA Enabled',
            message: 'Two-factor authentication has been successfully enabled for your account.',
            time: new Date(),
            read: false
        });

        res.json({
            success: true,
            message: '2FA enabled successfully'
        });
    } catch (error) {
        console.error('2FA verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify 2FA'
        });
    }
});

// Validate 2FA token (for login)
router.post('/validate', authenticate, async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }

        const user = await dbService.db?.collection('users').findOne({
            _id: new ObjectId(req.user?.id)
        });

        if (!user?.twoFactor?.enabled) {
            return res.status(400).json({
                success: false,
                message: '2FA not enabled for this user'
            });
        }

        // Verify token with a window of 1 to allow for time drift
        const verified = speakeasy.totp.verify({
            secret: user.twoFactor.secret,
            encoding: 'base32',
            token: token,
            window: 1 // Allow 30 seconds clock skew
        });

        if (verified) {
            await dbService.createNotification({
                id: uuidv4(),
                user_id: req.user?.id as string,
                type: 'info',
                title: 'New Login',
                message: 'A new login was authenticated using 2FA.',
                time: new Date(),
                read: false
            });
        }

        res.json({
            success: verified,
            message: verified ? 'Token valid' : 'Invalid 6 digit code'
        });
    } catch (error) {
        console.error('2FA validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate 2FA token'
        });
    }
});

// Disable 2FA
router.post('/disable', authenticate, async (req, res) => {
    try {
        const { token } = req.body;

        const user = await dbService.db?.collection('users').findOne({
            _id: new ObjectId(req.user?.id)
        });

        if (!user?.twoFactor?.enabled) {
            return res.status(400).json({
                success: false,
                message: '2FA not enabled'
            });
        }

        // Verify token one last time
        const verified = speakeasy.totp.verify({
            secret: user.twoFactor.secret,
            encoding: 'base32',
            token: token
        });

        if (!verified) {
            return res.status(400).json({
                success: false,
                message: 'Invalid token'
            });
        }

        // Disable 2FA
        await dbService.db?.collection('users').updateOne(
            { _id: new ObjectId(req.user?.id) },
            { $unset: { twoFactor: "" } }
        );

        // Create notification
        await dbService.createNotification({
            id: uuidv4(),
            user_id: req.user?.id as string,
            type: 'warning',
            title: '2FA Disabled',
            message: 'Two-factor authentication has been disabled for your account.',
            time: new Date(),
            read: false
        });

        res.json({
            success: true,
            message: '2FA disabled successfully'
        });
    } catch (error) {
        console.error('2FA disable error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to disable 2FA'
        });
    }
});

// Get 2FA Status
router.get('/status', authenticate, async (req, res) => {
    try {
        const user = await dbService.db?.collection('users').findOne({
            _id: new ObjectId(req.user?.id)
        });

        res.json({
            success: true,
            enabled: !!user?.twoFactor?.enabled,
            setupInProgress: !!user?.twoFactorTemp
        });
    } catch (error) {
        console.error('2FA status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get 2FA status'
        });
    }
});

export default router; 