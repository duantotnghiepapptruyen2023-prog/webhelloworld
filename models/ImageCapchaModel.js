const mongoose = require('mongoose')

const imagecapchaSchema = new mongoose.Schema({
  image: { type: String },
  value: { type: Number }
})

const Imagecapcha = mongoose.model('imagecapcha', imagecapchaSchema)
module.exports = Imagecapcha
