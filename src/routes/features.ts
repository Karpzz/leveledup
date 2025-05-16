import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';

const router = express.Router();

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

interface AttachmentData {
  filename: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

interface Feature {
  user_id: any;
  email: string;
  subject: string;
  message: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  attachments?: AttachmentData[];
  createdAt: Date;
  status: 'open' | 'in-progress' | 'closed';
  response?: string | null;
}

// POST endpoint to create a support ticket
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate priority
    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority level'
      });
    }

    // Create support ticket object
    const feature: Feature = {
      user_id: req.user?.id,
      email,
      subject,
      message,
      category,
      priority,
      createdAt: new Date(),
      status: 'open',
      response: null
    };

    // Add attachments if present
    var file_ids: any[] = []
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
       const attachments = (req.files as Express.Multer.File[]).map(file => ({
        filename: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
        size: file.size
      }));
      const result = await dbService.db?.collection('files').insertMany(attachments)
      file_ids = result?.insertedIds as any[]
    }
    feature.attachments = file_ids
    // Save to database
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

export default router; 