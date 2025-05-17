import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import { TradeData } from '../types';
const router = express.Router();

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// POST endpoint to create a trade journal entry
router.post('/', authenticate, async (req, res) => {
  try {
    const { pair, type, entry, exit, amount, notes, status } = req.body;

    // Validate required fields
    if (!pair || !type || !entry || !exit || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Create trade entry object
    const trade: TradeData = {
      user_id: req.user?.id,
      pair,
      type,
      entry,
      exit,
      amount,
      status,
      notes,
      date: new Date().toISOString()
    };

    // Save to database
    const result = await dbService.db?.collection('journal').insertOne(trade);

    res.status(201).json({
      success: true,
      message: 'Trade entry created successfully',
      trade: trade
    });

  } catch (error) {
    console.error('Error creating trade entry:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { id } = req.user as any;
    const trades = await dbService.db?.collection('journal').find({ user_id: id }).toArray()
    res.status(200).json({  
      success: true,    
      trades: trades?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    });
  } catch (error) {
    console.error('Error getting trades:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router; 