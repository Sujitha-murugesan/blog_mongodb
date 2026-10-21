const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 60 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    },
    // select:false => the hash is never returned unless explicitly requested
    password: { type: String, required: true, minlength: 6, select: false },
  },
  { timestamps: true }
);

// Hash the password before saving (only when it changed)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toPublic = function () {
  return { id: this._id.toString(), name: this.name, email: this.email };
};

module.exports = mongoose.model('User', userSchema);
