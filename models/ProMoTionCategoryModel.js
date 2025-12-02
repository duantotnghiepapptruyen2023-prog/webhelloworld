const mongoose = require('mongoose')

const PromotionCategorySchema = new mongoose.Schema({
  id: { type: Number },
  name: { type: String },
  status: { type: Number, default: 1 },
  created: { type: Number },
  updated: { type: Number }
})

const PromotionCategory = mongoose.model(
  'promotioncategory',
  PromotionCategorySchema
)
module.exports = PromotionCategory
