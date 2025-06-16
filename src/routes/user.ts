import express from 'express';
import { authenticate } from '../middleware/auth';
import { dbService } from '../services/db';
import { ObjectId } from 'mongodb';
import multer from 'multer';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
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

router.post('/sniper-bot', authenticate, async (req, res) => {
    const { enabled, amount } = req.body;
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    user.sniper.enabled = enabled;
    user.sniper.amount = amount;
    await dbService.db?.collection('users').updateOne({ _id: new ObjectId(req.user?.id) }, { $set: { sniper: user.sniper } });
    res.json({ success: true, message: 'Sniper bot updated' });
});

router.post('/builtin_wallet/withdraw', authenticate, async (req, res) => {
   try {
    const { amount, wallet_address } = req.body;
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    // create transaction using user.builtin_wallet.private_key
    const senderKeypair = Keypair.fromSecretKey(
        bs58.decode(user.builtin_wallet.private_key)
    );
    const transaction = new Transaction();
    transaction.add(SystemProgram.transfer({
        fromPubkey: new PublicKey(user.builtin_wallet.public_key),
        toPubkey: new PublicKey(wallet_address),
        lamports: amount * LAMPORTS_PER_SOL,
    }));
    const connection = new Connection(process.env.RPC_URL || '', 'confirmed');
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(user.builtin_wallet.public_key);
    const signature = await sendAndConfirmTransaction(connection, transaction, [senderKeypair]);
    res.json({ success: true, message: 'Transaction sent', signature: signature });
   } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Transaction failed', error: error });
   }
});

router.get('/builtin_wallet/private_key', authenticate, async (req, res) => {
    const user = await dbService.db?.collection('users').findOne({ _id: new ObjectId(req.user?.id) });
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    res.json({ success: true, private_key: user.builtin_wallet.private_key });
});
export default router;
