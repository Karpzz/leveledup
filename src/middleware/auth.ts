import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { dbService } from '../services/db';
import { ObjectId } from 'mongodb';

dotenv.config();

interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: 'No authorization header' });
    }

    // Check if the header follows Bearer scheme
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ message: 'Invalid authorization format' });
    }

    const token = parts[1];

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key-here') as any;
    
    // Check if user exists in database
    const user = await dbService.db?.collection('users').findOne({ 
      _id: new ObjectId(decoded.id)
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Attach the decoded user to the request object
    req.user = {
      ...decoded,
      type: user.type,
      swap_fees: user.swap_fees
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}; 