import express from 'express';
import session from 'express-session';
import passport from './config/passport';
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

dotenv.config();
const app = express();

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);
app.use(cors());
app.use(express.json());
// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

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

app.use('/api', apiRoutes);

// Auth routes
app.use('/auth', authRoutes);

// Swap routes
app.use('/swap', swapRoutes);

// Files routes
app.use('/files', filesRoutes);

// 2FA routes
app.use('/2fa', twoFactorRouter);

// Home page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

export default app; 