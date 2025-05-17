import express from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import { ObjectId } from 'mongodb';
import { CalculationData } from '../types';

const router = express.Router();

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

    const result = await dbService.db?.collection('calculations').insertOne(calculation);
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
    const calculations = await dbService.db?.collection('calculations').find({ user_id: id }).toArray()
    res.status(200).json({  
      success: true,    
      calculations: calculations?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    });
  } catch (error) {
    console.error('Error getting calculations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, data } = req.body;
    const result = await dbService.db?.collection('calculations').updateOne({ _id: new ObjectId(id) }, { $set: { name, type, data } });
    const calculation = await dbService.db?.collection('calculations').findOne({ _id: new ObjectId(id) });
    res.status(200).json({
      success: true,
      message: 'Calculation updated successfully',
      calculation: calculation
    });
  } catch (error) {
    console.error('Error updating calculation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;  
    const result = await dbService.db?.collection('calculations').deleteOne({ _id: new ObjectId(id) });
    res.status(200).json({
      success: true,
      message: 'Calculation deleted successfully',
      calculation: result
    });
  } catch (error) {
    console.error('Error deleting calculation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router; 