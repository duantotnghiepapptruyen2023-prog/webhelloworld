const mongoose = require('mongoose')

const userbonusSchema = new mongoose.Schema({
  id: { type: Number },
  user_id: { type: Number },
  type: { type: String },
  target: { type: String },
  action: { type: String },
  bonus: { type: Number, default: 0 },
  description: { type: String },
  referrer_id: { type: Number },
  level: { type: Number },
  created: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  status: { type: Number, default: 1 }
})

const UserBonus = mongoose.model('userbonus', userbonusSchema)
module.exports = UserBonus
