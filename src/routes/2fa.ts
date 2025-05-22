/**
 * Two-Factor Authentication (2FA) Router
 * Handles all 2FA-related operations including setup, verification, validation, and management.
 */

import express from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * Constants
 */
const TEMP_SECRET_EXPIRY = 15 * 60 * 1000; // 15 minutes in milliseconds
const TOTP_WINDOW = 1; // Allow 30 seconds clock skew

/**
 * @route   POST /2fa/setup
 * @desc    Initialize 2FA setup by generating secret and QR code
 * @access  Private
 */
router.post('/setup', authenticate, async (req, res) => {
    try {
        const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });
        
        // Check if 2FA is already enabled
        if (user?.twoFactor?.enabled) {
            return res.status(400).json({
                success: false,
                message: '2FA is already enabled'
            });
        }

        // Generate new secret for 2FA
        const secret = speakeasy.generateSecret({
            name: `Leveled Up - ${user?.username}`,
            length: 16
        });

        // Generate QR code for easy secret sharing
        const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

        // Store temporary secret with timestamp
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

        // Notify user about 2FA setup initiation
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
            secret: secret.base32 // Provided as backup for manual entry
        });
    } catch (error) {
        console.error('2FA setup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to setup 2FA'
        });
    }
});

/**
 * @route   POST /2fa/verify
 * @desc    Verify and enable 2FA after initial setup
 * @access  Private
 */
router.post('/verify', authenticate, async (req, res) => {
    try {
        const { token } = req.body;

        // Validate input
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }

        const user = await dbService.db?.collection('users').findOne({
            _id: new ObjectId(req.user?.id)
        });

        // Verify setup was initiated
        if (!user?.twoFactorTemp?.secret) {
            return res.status(400).json({
                success: false,
                message: '2FA setup not initiated'
            });
        }

        // Check if temporary secret hasn't expired
        const tempSecretAge = new Date().getTime() - new Date(user.twoFactorTemp.createdAt).getTime();
        if (tempSecretAge > TEMP_SECRET_EXPIRY) {
            await dbService.db?.collection('users').updateOne(
                { _id: new ObjectId(req.user?.id) },
                { $unset: { twoFactorTemp: "" } }
            );
            return res.status(400).json({
                success: false,
                message: '2FA setup expired, please start over'
            });
        }

        // Verify provided token
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

        // Enable 2FA and remove temporary secret
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

        // Notify user about successful 2FA enablement
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

/**
 * @route   POST /2fa/validate
 * @desc    Validate 2FA token during login
 * @access  Private
 */
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

        // Verify token with time window allowance
        const verified = speakeasy.totp.verify({
            secret: user.twoFactor.secret,
            encoding: 'base32',
            token: token,
            window: TOTP_WINDOW
        });

        if (verified) {
            // Log successful 2FA login
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

/**
 * @route   POST /2fa/disable
 * @desc    Disable 2FA for user account
 * @access  Private
 */
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

        // Final verification before disabling
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

        // Remove 2FA configuration
        await dbService.db?.collection('users').updateOne(
            { _id: new ObjectId(req.user?.id) },
            { $unset: { twoFactor: "" } }
        );

        // Notify user about 2FA disablement
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

/**
 * @route   GET /2fa/status
 * @desc    Get current 2FA status for user
 * @access  Private
 */
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