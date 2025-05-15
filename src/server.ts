import dotenv from 'dotenv';
import app from './app';
import { dbService } from './services/db';
import { OTCProcessor } from './services/OTC';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Connect to MongoDB
    await dbService.connect();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server is running on ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
      setTimeout(() => {
        OTCProcessor.getInstance().startProcessing();
      }, 5000);

    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer(); 