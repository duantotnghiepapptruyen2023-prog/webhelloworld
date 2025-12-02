const mongoose = require('mongoose')

const lichsuquaythuongSchema = new mongoose.Schema({
  id: { type: Number },
  user_id: { type: Number },
  amount: { type: Number },
  created: { type: Number },
  updated: { type: Number }
})

const lichsuquaythuong = mongoose.model(
  'lichsuquaythuong',
  lichsuquaythuongSchema
)
module.exports = lichsuquaythuong
