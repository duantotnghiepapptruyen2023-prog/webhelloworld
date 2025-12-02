const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: { type: String },
  username: { type: String, required: true },
  password: { type: String, required: true },
  withdrawal_password: { type: Number, default: 0 },
  country: { type: String },
  code: { type: String },
  email: { type: String },
  email_verified: { type: Number, default: 0 },
  phone: { type: String },
  phone_verified: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  bonus: { type: Number, default: 0 },
  has_bank: { type: Number, default: 0 },
  bin_bank: { type: String },
  bank_name: { type: String },
  bank_account_name: { type: String },
  bank_account_number: { type: String },
  bank_swift_code: { type: String },
  bank_notes: { type: String },
  cryto_wallet: { type: String },
  vip: { type: Number, default: 0 },
  lv1: [{ type: Number }],
  lv2: [{ type: Number }],
  lv3: [{ type: Number }],
  created: { type: Number, default: 0 },
  updated: { type: Number, default: 0 },
  status: { type: Number, default: 1 },
  last_login: { type: Number, default: 0 },
  last_ip: { type: String },
  luotquay: { type: Number, default: 0 },
  diemthuong: { type: Number, default: 0 },
  dacong: { type: Boolean, default: false }
})

const User = mongoose.model('user', userSchema)
module.exports = User
