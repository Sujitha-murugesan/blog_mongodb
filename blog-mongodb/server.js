require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');

if (!process.env.JWT_SECRET) {
  console.error('Missing JWT_SECRET. Copy .env.example to .env and set it.');
  process.exit(1);
}

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Limit brute-force attempts on login/register
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' } }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/blogs', require('./routes/blogs'));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found.' }));

app.use(express.static(path.join(__dirname, 'public')));

// Central error handler: turns Mongoose/JSON errors into friendly messages
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON in request body.' });
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(' ') });
  }
  if (err.code === 11000) return res.status(409).json({ message: 'Duplicate value: that record already exists.' });
  console.error(err);
  res.status(500).json({ message: 'Something went wrong.' });
});

const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    console.error('Check MONGODB_URI in .env and that MongoDB is running.');
    process.exit(1);
  });
