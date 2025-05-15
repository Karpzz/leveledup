import express from 'express';
import session from 'express-session';
import passport from './config/passport';
import authRoutes from './routes/auth';
import newsRoutes from './routes/news';   
import pricesRoutes from './routes/prices';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';

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

// // Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

export default app; 