/**
 * Features Router
 * Handles feature requests and support ticket management.
 * Provides endpoints for creating and retrieving feature requests with file attachment support.
 */

import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import { Feature } from '../types';

const router = express.Router();

/**
 * Multer Configuration
 * Configure file upload handling with memory storage
 */
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

/**
 * Create feature request
 * 
 * @route   POST /features
 * @desc    Create a new feature request or support ticket with optional file attachments
 * @access  Private
 * @param   {string} email - User's email address
 * @param   {string} subject - Feature request subject
 * @param   {string} message - Detailed feature description
 * @param   {string} category - Feature category
 * @param   {string} priority - Priority level (low/medium/high)
 * @param   {File[]} attachments - Optional file attachments (max 10MB each)
 */
router.post('/', upload.array('attachments'), authenticate, async (req, res) => {
  try {
    const { email, subject, message, category, priority } = req.body;

    // Validate required fields
    if (!email || !subject || !message || !category || !priority) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate email format using regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate priority level
    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority level'
      });
    }

    // Create feature request object with default values
    const feature: Feature = {
      user_id: req.user?.id,
      email,
      subject,
      message,
      category,
      priority,
      createdAt: new Date(),
      status: 'open',
      response: null,
      votes: {
        up: 0,
        down: 0
      }
    };

    // Process and store file attachments if present
    var file_ids: any[] = []
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
       // Map uploaded files to storage format
       const attachments = (req.files as Express.Multer.File[]).map(file => ({
        filename: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
        size: file.size
      }));

      // Store attachments and collect file IDs
      const result = await dbService.db?.collection('files').insertMany(attachments)
      if (result?.insertedIds) {
        for (const file of Object.values(result.insertedIds)) {
          file_ids.push(file.toString())
        }
      }
    }

    // Add attachment IDs to feature request
    feature.attachments = file_ids

    // Save feature request to database
    const result = await dbService.db?.collection('features').insertOne(feature);

    res.status(201).json({
      success: true,
      message: 'Feature created successfully',
      featureId: result?.insertedId
    });

  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get user's feature requests
 * 
 * @route   GET /features
 * @desc    Retrieve all feature requests for the authenticated user
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { id } = req.user as any;
    // Fetch all features for the user
    const features = await dbService.db?.collection('features').find({ user_id: id }).toArray()
    res.status(200).json({  
      success: true,    
      features
    });
  } catch (error) {
    console.error('Error getting features:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router; 