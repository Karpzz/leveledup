import express from 'express';
import { FileController } from '../services/fileService';
import multer from 'multer';

const router = express.Router();
const fileController = new FileController();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB limit
        fieldSize: 25 * 1024 * 1024 // 25MB limit for fields
    }
});

// Increase payload size limit for this route
router.use(express.json({ limit: '25mb' }));
router.use(express.urlencoded({ limit: '25mb', extended: true }));

// /api/files
router.get('/:file_id', fileController.serveFile);

export default router; 