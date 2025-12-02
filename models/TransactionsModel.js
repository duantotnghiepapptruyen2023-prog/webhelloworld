const mongoose = require('mongoose')

const transactionsSchema = new mongoose.Schema({
  id: { type: Number },
  code: { type: String, default: null },
  user_id: { type: Number, default: null },
  type: { type: String, default: null },
  amount: { type: Number, default: null },
  bank_name: { type: String, default: null },
  bank_account: { type: String, default: null },
  bank_account_name: { type: String, default: null },
  transaction_code: { type: String, default: null },
  transaction_time: { type: String, default: null },
  data: [{ type: String }],
  description: { type: String, default: null },
  message: {
    type: String,
    default: null
  },
  ip_address: {
    type: String,
    default: null
  },
  logs: {
    type: String,
    default: null
  },
  created: { type: Number, default: null },
  updated: { type: Number, default: null },
  status: { type: Number, default: 0 }
})

transactionsSchema.index({
  type: 1,
  created: 1,
  user_id: 1,
  status: 1,
  amount: 1
})

const Transactions = mongoose.model('transactions', transactionsSchema)
module.exports = Transactions
