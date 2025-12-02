const mongoose = require('mongoose')

const soccerbetSchema = new mongoose.Schema({
  id: { type: Number },
  gameId: { type: Number },
  type: { type: String },
  data: [
    {
      keo: { type: String },
      profit: { type: Number }
    }
  ],
  created: { type: Number },
  updated: { type: Number },
  status: { type: Number, default: 1 }
})

const Soccerbet = mongoose.model('soccerbet', soccerbetSchema)
module.exports = Soccerbet
