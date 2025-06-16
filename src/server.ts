import dotenv from 'dotenv';
import app from './app';
import { dbService } from './services/db';
import { OTCProcessor } from './services/OTC';
import { LeaderboardCacheService } from './cache/LeaderboardCache';
import { WalletTrackerCacheService } from './cache/WalletTrackerCache';
import { SniperCache } from './cache/SniperCache';
// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3910;

async function startServer() {
  try {
    // Connect to MongoDB
    await dbService.connect();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server is running on ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
      const sniperCache = new SniperCache();  
      sniperCache.start();
      if (process.env.NODE_ENV !== 'development') {
        setTimeout(() => {
          
          OTCProcessor.getInstance().startProcessing();
          LeaderboardCacheService.getInstance().startProcess();
          WalletTrackerCacheService.getInstance().startProcess();
        }, 5000);
      }

      else {
          console.log('Development mode');
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer(); 