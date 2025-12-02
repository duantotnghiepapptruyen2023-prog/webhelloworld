const mongoose = require('mongoose')

const lichsugiaodichSchema = new mongoose.Schema({
  id: { type: Number },
  code: { type: String },
  user_id: { type: Number },
  type: { type: String },
  amount: { type: Number },
  bank_name: { type: String },
  bank_account: { type: String },
  bank_account_name: { type: String },
  transaction_code: { type: String },
  transaction_time: { type: String },
  data: { type: String },
  description: { type: String },
  message: { type: String },
  ip_address: { type: String },
  logs: { type: String },
  check: { type: String },
  created: { type: Number, default: null },
  updated: { type: Number, default: null },
  status: { type: Number, default: 1 }
})

const lichsugiaodich = mongoose.model('lichsugiaodich', lichsugiaodichSchema)
module.exports = lichsugiaodich
