const mongoose = require('mongoose')

const configSchema = new mongoose.Schema({
  id: { type: Number },
  type: { type: String, default: null },
  name: { type: String, default: null },
  description: { type: String, default: null },
  data: { type: String, default: null },
  created: { type: Number, default: null },
  updated: { type: Number, default: null },
  status: { type: Number, default: 1 }
})

const config = mongoose.model('config', configSchema)
module.exports = config
