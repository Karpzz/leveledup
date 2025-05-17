import express from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import { SupportTicket, SupportMessage, AttachmentData } from '../types';
import { ObjectId } from 'mongodb';

const router = express.Router();

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});


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
    const supportTicket: SupportTicket = {
      user_id: req.user?.id,
      email,
      subject,
      category,
      priority,
      createdAt: new Date(),
      status: 'open',
      messages: []
    };
    var firstMessage: SupportMessage = {
      from: 'user',
      message: message,
      time: new Date(),
      read: false,
      attachments: []
    }
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
      for (const fileId of Object.values(result?.insertedIds as any[])) {
        file_ids.push(fileId.toString())
      }
    }
    firstMessage.attachments = file_ids
    supportTicket.messages.push(firstMessage)
    // Save to database
    const result = await dbService.db?.collection('support_tickets').insertOne(supportTicket);

    res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      ticketId: result?.insertedId
    });

  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { id } = req.user as any;
    const tickets = await dbService.db?.collection('support_tickets').find({ user_id: id }).toArray()
    res.status(200).json({
        success: true,
        tickets
    });
  } catch (error) {
    console.error('Error getting support tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

router.post('/:support_ticket_id/reply', upload.array('attachments'), authenticate, async (req, res) => {
  try {
    const { support_ticket_id } = req.params;
    const { message } = req.body;
    const { id } = req.user as any;
    const ticket = await dbService.db?.collection('support_tickets').findOne({ _id: new ObjectId(support_ticket_id) });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    
    console.log(req.user?.type)
    const reply: SupportMessage = {
      from: req.user?.type,
      message: message,
      time: new Date(),
      read: false,
      attachments: []
    }
    var file_ids: any[] = []
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const attachments = (req.files as Express.Multer.File[]).map(file => ({
        filename: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
        size: file.size
      }));
      const result = await dbService.db?.collection('files').insertMany(attachments)
      for (const fileId of Object.values(result?.insertedIds as any[])) {
        file_ids.push(fileId.toString())
      }
    }
    reply.attachments = file_ids

    await dbService.db?.collection('support_tickets').updateOne({ _id: new ObjectId(support_ticket_id) }, { $push: { messages: reply } });
    res.status(200).json({ success: true, message: 'Reply added successfully' });
  } catch (error) {
    console.error('Error replying to support ticket:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/:support_ticket_id', authenticate, async (req, res) => {
  try {
    const { support_ticket_id } = req.params;
    if (support_ticket_id === 'admin') {
      if (req.user?.type !== 'admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }
      const tickets = await dbService.db?.collection('support_tickets').find({}).toArray()
      if (!tickets) {
        return res.status(404).json({ success: false, message: 'No tickets found' });
      }
      console.log(tickets)
      const ticketswithusernameandavatars = await Promise.all(tickets.map(async (ticket) => {
        console.log(ticket.user_id)
        const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(ticket.user_id) })
        return { ...ticket, ticket_user_username: user?.username, ticket_user_avatar: user?.avatar }
      }))
      return res.status(200).json({ success: true, tickets: ticketswithusernameandavatars });
    }
    const { id } = req.user as any;
    const ticket = await dbService.db?.collection('support_tickets').findOne({ _id: new ObjectId(support_ticket_id) });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    if (ticket.user_id !== id && req.user?.type !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    } 
    res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error('Error getting support ticket:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});   



export default router; 