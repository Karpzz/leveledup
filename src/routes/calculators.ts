import express from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';

const router = express.Router();


interface CalculationData {
  user_id: any;
  name: string;
  type: string;
  data: {
    entryPrice: string;
    stopLoss: string;
    takeProfit: string;
    positionSize: string;
    result: {
      riskPercent: number;
      riskAmount: number;
      gainAmount: number;
      ratio: number;
      breakeven: number;
    };
  };
  date: string;
}

// POST endpoint to create a trade journal entry
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, type, data } = req.body;

    // Validate required fields
    if (!name || !type || !data) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Create trade entry object
    const calculation: CalculationData = {
      user_id: req.user?.id,
      name,
      type,
      data,
      date: new Date().toISOString()
    };

    // Save to database
    res.status(201).json({
      success: true,
      message: 'Calculation created successfully',
      calculation: calculation
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
    const trades = await dbService.db?.collection('calculations').find({ user_id: id }).toArray()
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