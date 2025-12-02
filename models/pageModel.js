const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  id: {
    type: Number,
  },
  type: {
    type: String,
    default: 'page'
  },
  parent_id: {
    type: Number,
    default: 0
  },
  slug: {
    type: String,
    unique: true
  },
  title: {
    type: String,
  },
  description: {
    type: String,
    default: ''
  },
  photo: {
    type: String,
    default: null
  },
  content: {
    type: String,
  },
  tags: {
    type: String,
    default: ''
  },
  created: {
    type: Number,
    default: () => Math.floor(Date.now() / 1000).toString()
  },
  updated: {
    type: Number,
    default: null
  },
  status: { type: Number, default: 1 },

}, { versionKey: false });

pageSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updated: Math.floor(Date.now() / 1000).toString() });
  next();
});

const Page = mongoose.model('Page', pageSchema);

module.exports = Page;