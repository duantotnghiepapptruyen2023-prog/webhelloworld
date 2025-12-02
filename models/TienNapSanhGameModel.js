const mongoose = require('mongoose')

const tiennapsanhgameSchema = new mongoose.Schema({
  tiengioihan: { type: String }
})

const TienNapSanhGame = mongoose.model('tiennapsanhgame', tiennapsanhgameSchema)
module.exports = TienNapSanhGame
