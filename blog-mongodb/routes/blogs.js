const express = require('express');
const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const auth = require('../middleware/auth');

const router = express.Router();
const str = (v) => (typeof v === 'string' ? v : '');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Reject malformed ids with a clean 400 instead of a Mongoose CastError
function validId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid blog id.' });
  next();
}

// GET /api/blogs?search=&category=&page=1&limit=9  (public)
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 9, 1), 50);
    const search = str(req.query.search).trim();
    const category = str(req.query.category).trim();

    const filter = {};
    if (category && Blog.CATEGORIES.includes(category)) filter.category = category;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: rx }, { content: rx }];
    }

    const [total, blogs] = await Promise.all([
      Blog.countDocuments(filter),
      Blog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('author', 'name'),
    ]);

    res.json({ blogs: blogs.map((b) => b.toPublic()), page, pages: Math.max(Math.ceil(total / limit), 1), total });
  } catch (err) {
    next(err);
  }
});

// GET /api/blogs/mine  (protected) - must be declared before /:id
router.get('/mine', auth, async (req, res, next) => {
  try {
    const blogs = await Blog.find({ author: req.user._id }).sort({ createdAt: -1 }).populate('author', 'name');
    res.json({ blogs: blogs.map((b) => b.toPublic()) });
  } catch (err) {
    next(err);
  }
});

// GET /api/blogs/:id  (public) - single blog details
router.get('/:id', validId, async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id).populate('author', 'name');
    if (!blog) return res.status(404).json({ message: 'Blog not found.' });
    res.json({ blog: blog.toPublic() });
  } catch (err) {
    next(err);
  }
});

// POST /api/blogs  (protected)
router.post('/', auth, async (req, res, next) => {
  try {
    const blog = await Blog.create({
      title: str(req.body.title),
      content: str(req.body.content),
      category: str(req.body.category) || 'General',
      author: req.user._id,
    });
    await blog.populate('author', 'name');
    res.status(201).json({ message: 'Blog created successfully.', blog: blog.toPublic() });
  } catch (err) {
    next(err);
  }
});

// PUT /api/blogs/:id  (protected, owner only)
router.put('/:id', auth, validId, async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found.' });
    if (!blog.author.equals(req.user._id)) return res.status(403).json({ message: 'You can only edit your own posts.' });

    if (req.body.title !== undefined) blog.title = str(req.body.title);
    if (req.body.content !== undefined) blog.content = str(req.body.content);
    if (req.body.category !== undefined) blog.category = str(req.body.category);
    await blog.save();
    await blog.populate('author', 'name');
    res.json({ message: 'Blog updated.', blog: blog.toPublic() });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/blogs/:id  (protected, owner only)
router.delete('/:id', auth, validId, async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found.' });
    if (!blog.author.equals(req.user._id)) return res.status(403).json({ message: 'You can only delete your own posts.' });
    await blog.deleteOne();
    res.json({ message: 'Blog deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
