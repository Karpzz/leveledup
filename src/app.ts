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
import rugcheckRoutes from './routes/rugcheck';
import otcRoutes from './routes/otc';
import supportRoutes from './routes/support';
import featuresRoutes from './routes/features';
import journalRoutes from './routes/journal';
import calculatorsRoutes from './routes/calculators';
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

// Auth routes
app.use('/auth', authRoutes);

// Prices routes
app.use('/prices', pricesRoutes);

// News routes
app.use('/news', newsRoutes);

// Portfolio routes
app.use('/portfolio', portfolioRoutes);

// Rugcheck routes
app.use('/rugcheck', rugcheckRoutes);

// OTC routes
app.use('/otc', otcRoutes);

// Support routes
app.use('/support', supportRoutes);

// Features routes
app.use('/features', featuresRoutes);

// Journal routes
app.use('/journal', journalRoutes);

// Calculators routes
app.use('/calculators', calculatorsRoutes);

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

export default app; 