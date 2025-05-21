import { Request, Response } from 'express';
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

    serveFile = async (req: Request, res: Response) => {
        try {
            const { file_id } = req.params;
            const { size } = req.query;
            
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