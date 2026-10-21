const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const sign = (user) =>
  jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// Coerce to string so objects like {"$ne": ""} can't be injected into queries
const str = (v) => (typeof v === 'string' ? v : '');

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const name = str(req.body.name).trim();
    const email = str(req.body.email).trim().toLowerCase();
    const password = str(req.body.password);

    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists.' });

    const user = await User.create({ name, email, password });
    res.status(201).json({ message: 'Registration successful.', token: sign(user), user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const email = str(req.body.email).trim().toLowerCase();
    const password = str(req.body.password);
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    res.json({ message: 'Login successful.', token: sign(user), user: user.toPublic() });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me  (protected)
router.get('/me', auth, (req, res) => res.json({ user: req.user.toPublic() }));

module.exports = router;
