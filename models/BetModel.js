const mongoose = require('mongoose')

const betSchema = new mongoose.Schema({
  id: { type: Number },
  code: { type: String },
  gameId: { type: Number },
  user_id: { type: Number },
  betType: { type: String },
  gameKey: { type: String },
  amount: { type: Number, default: 0 },
  profit: { type: Number },
  result: { type: Number, default: 0 },
  created: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  status: { type: Number, default: 1 },
  check: { type: String },
  check1: { type: String }
})

betSchema.index({ result: 1, status: 1, created: -1,user_id: 1, gameId: 1 })

const Bet = mongoose.model('bet', betSchema)
module.exports = Bet
