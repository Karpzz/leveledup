import express from 'express';
import session from 'express-session';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import newsRoutes from './routes/news';   
import pricesRoutes from './routes/prices';
import portfolioRoutes from './routes/portfolio';
import otcRoutes from './routes/otc';
import supportRoutes from './routes/support';
import featuresRoutes from './routes/features';
import journalRoutes from './routes/journal';
import calculatorsRoutes from './routes/calculators';
import notificationsRoutes from './routes/notifications';
import filesRoutes from './routes/files';
import swapRoutes from './routes/swap';
import twoFactorRouter from './routes/2fa';
import trackerRoutes from './routes/tracker';
import userRoutes from './routes/user';
import tokenRoutes from './routes/token';
import leaderboardRoutes from './routes/leaderboard';
dotenv.config();
const app = express();

// Configure CORS
app.use(cors());

app.use(express.json());
// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'super-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 10, // 10 minutes
    },
  })
);

// API Routes - Define these BEFORE the catch-all route
const apiRoutes = express.Router();
apiRoutes.use('/prices', pricesRoutes);
apiRoutes.use('/news', newsRoutes);
apiRoutes.use('/portfolio', portfolioRoutes);
apiRoutes.use('/otc', otcRoutes);
apiRoutes.use('/notifications', notificationsRoutes);
apiRoutes.use('/support', supportRoutes);
apiRoutes.use('/features', featuresRoutes);
apiRoutes.use('/calculators', calculatorsRoutes);
apiRoutes.use('/journal', journalRoutes);
apiRoutes.use('/tracker', trackerRoutes);
apiRoutes.use('/user', userRoutes);
apiRoutes.use('/token', tokenRoutes);
apiRoutes.use('/leaderboard', leaderboardRoutes);
app.use('/api', apiRoutes);

// Auth routes
app.use('/auth', authRoutes);

// Swap routes
app.use('/swap', swapRoutes);

// Files routes
app.use('/files', filesRoutes);

// 2FA routes
app.use('/2fa', twoFactorRouter);

// Static and catch-all routes should be LAST
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

export default app; 