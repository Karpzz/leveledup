/**
 * Calculators Router
 * Handles CRUD operations for user calculations and trade journal entries.
 * Provides endpoints for managing calculation history and trade analysis.
 */

import express from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import { ObjectId } from 'mongodb';
import { CalculationData } from '../types';

const router = express.Router();

/**
 * Create calculation entry
 * 
 * @route   POST /calculators
 * @desc    Create a new calculation or trade journal entry
 * @access  Private
 */
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

    // Create calculation entry object with current timestamp
    const calculation: CalculationData = {
      user_id: req.user?.id,
      name,
      type,
      data,
      date: new Date().toISOString()
    };

    // Save calculation to database
    const result = await dbService.db?.collection('calculations').insertOne(calculation);

    res.status(201).json({
      success: true,
      message: 'Calculation created successfully',
      calculation: calculation
    });

  } catch (error) {
    console.error('Error creating calculation entry:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get all calculations
 * 
 * @route   GET /calculators
 * @desc    Retrieve all calculations for the authenticated user
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { id } = req.user as any;

    // Fetch all calculations for the user
    const calculations = await dbService.db?.collection('calculations')
      .find({ user_id: id })
      .toArray();

    // Sort calculations by date in descending order (newest first)
    res.status(200).json({  
      success: true,    
      calculations: calculations?.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    });
  } catch (error) {
    console.error('Error retrieving calculations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Update calculation
 * 
 * @route   PUT /calculators/:id
 * @desc    Update an existing calculation entry
 * @access  Private
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, data } = req.body;

    // Update calculation in database
    const result = await dbService.db?.collection('calculations').updateOne(
      { _id: new ObjectId(id) },
      { $set: { name, type, data } }
    );

    // Fetch updated calculation
    const calculation = await dbService.db?.collection('calculations').findOne(
      { _id: new ObjectId(id) }
    );

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

/**
 * Delete calculation
 * 
 * @route   DELETE /calculators/:id
 * @desc    Delete a specific calculation entry
 * @access  Private
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;  

    // Remove calculation from database
    const result = await dbService.db?.collection('calculations').deleteOne(
      { _id: new ObjectId(id) }
    );

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