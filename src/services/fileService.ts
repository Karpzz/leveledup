import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Db, MongoClient, ObjectId } from 'mongodb';
import sharp from 'sharp';


export class FileController {
    private client: MongoClient;
    private db!: Db;
    private collection: string = 'files';
    constructor() {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI is not defined');
        this.client = new MongoClient(uri || '');
        this.client.connect().then(() => {
            this.db = this.client.db(process.env.DB_NAME || 'leveledup');
            console.log('FileService connected to MongoDB');
        });
    }

   
    handleFileUpload = async (req: Request, res: Response) => {
        try {
            const { file } = req;
            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }   

            console.log('Uploading file:', {
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                bufferType: file.buffer ? file.buffer.constructor.name : 'none'
            });

            // Ensure we have a valid buffer
            if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
                return res.status(400).json({ error: 'Invalid file buffer' });
            }

            const file_id = uuidv4();
            const new_file = {
                file_id: file_id,
                name: file.originalname,
                type: file.mimetype,
                size: file.size,
                buffer: file.buffer,  // MongoDB will automatically convert this to its Binary type
                createdAt: new Date()
            }

            await this.db.collection(this.collection).insertOne(new_file);
            console.log('File saved successfully with ID:', file_id);

            res.status(200).json({
                status: 'success',
                file_id: file_id,
                name: file.originalname,
                type: file.mimetype,
                size: file.size
            });
        } catch (error) {
            console.error('Error uploading file:', error);
            res.status(500).json({ error: 'Error uploading file' });
        }
    }

    serveFile = async (req: Request, res: Response) => {
        try {
            const { file_id } = req.params;
            const { size } = req.query;
            console.log('Serving file with ID:', file_id);
            
            const file = await this.db.collection(this.collection).findOne({ _id: new ObjectId(file_id) });
            console.log('File metadata:', {
                found: !!file,
                type: file?.mimetype,
                name: file?.filename,
                bufferType: file?.buffer ? file.buffer.constructor.name : 'none'
            });

            if (!file) {
                return res.status(404).json({ error: 'File not found' });
            }

            // Set proper headers
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            res.setHeader('Content-Type', file.mimetype);

            // Handle MongoDB Binary object
            let buffer: Buffer;
            if (file.buffer && typeof file.buffer === 'object' && file.buffer.buffer) {
                buffer = Buffer.from(file.buffer.buffer);
            } else {
                return res.status(404).json({ error: 'File content not found' });
            }

            // Process image if thumbnail requested and it's an image
            if (size === 'thumbnail' && file.mimetype.startsWith('image/')) {
                try {
                    const thumbnail = await sharp(buffer)
                        .resize(200, 200, {
                            fit: 'inside',
                            withoutEnlargement: true
                        })
                        .toBuffer();
                    return res.send(thumbnail);
                } catch (err) {
                    console.error('Error creating thumbnail:', err);
                    return res.send(buffer); // Fall back to original if thumbnail fails
                }
            }

            return res.send(buffer);
        } catch (error) {
            console.error('Error serving file:', error);
            res.status(500).json({ error: 'Error serving file' });
        }
    }
    
} 