import express from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import { ObjectId } from 'mongodb';
import multer from 'multer';
const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB limit
        fieldSize: 25 * 1024 * 1024 // 25MB limit for fields
    }
});
// Get all prices
router.post('/profile', authenticate, async (req, res) => {
    const { name, bio} = req.body;
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    user.name = name;
    user.bio = bio;
    await dbService.db?.collection('users').updateOne({ _id: new ObjectId(req.user?.id) }, { $set: user });
    res.json({ success: true, message: 'Profile updated' });
});

router.post('/avatar', authenticate, upload.single('avatar'), async (req, res) => {
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    const file = req.file;
    if (!file) {
        console.log('No file uploaded');
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const file_id = await dbService.db?.collection('files').insertOne({
        filename: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
        size: file.size
    });
    user.profile_image_url = file_id?.insertedId.toString();
    await dbService.db?.collection('users').updateOne({ _id: new ObjectId(req.user?.id) }, { $set: user });
    res.json({ success: true, message: 'Avatar updated', profile_image_url: file_id?.insertedId.toString() });
});

router.post('/wallet-reveal', authenticate, async (req, res) => {
    const { enabled, fee } = req.body;
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    user.reveal_wallet.enabled = enabled;
    user.reveal_wallet.fee = fee;
    await dbService.db?.collection('users').updateOne({ _id: new ObjectId(req.user?.id) }, { $set: user });
    res.json({ success: true, message: 'Wallet reveal updated' });
});

export default router;
