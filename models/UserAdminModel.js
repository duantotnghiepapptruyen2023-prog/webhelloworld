const mongoose = require('mongoose')

const useradminSchema = new mongoose.Schema({
  id: { type: Number },
  name: { type: String, default: null },
  username: { type: String, default: null },
  role: { type: String, default: null },
  password: { type: String, default: null },
  email: { type: String, default: null },
  birthday: { type: String, default: null },
  gender: { type: String, default: null },
  address: { type: String, default: null },
  phone: { type: String, default: null },
  avatar: { type: String, default: null },
  reset_token: { type: String, default: null },
  reset_expiration: { type: Number, default: null },
  created: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  status: { type: Number, default: 1 },
  last_login: { type: Number, default: 0 },
  last_ip: { type: String, default: null }
})

const Useradmin = mongoose.model('useradmin', useradminSchema)
module.exports = Useradmin
