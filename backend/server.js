require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const analyzeRoutes = require('./routes/analyze');
const billingRoutes = require('./routes/billing');

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// We need raw body for Stripe webhook, so we define it before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// Parse JSON bodies for other routes
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/billing', billingRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

app.listen(PORT, () => {
  console.log(`ContextBot production backend running on port ${PORT}`);
});
