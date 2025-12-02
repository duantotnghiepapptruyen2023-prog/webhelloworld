const mongoose = require('mongoose')

const trandauSchema = new mongoose.Schema({
  id: { type: Number },
  gameId: { type: Number, default: null },
  started: { type: Number, default: null },
  leagueName: { type: String, default: null },
  homeTeam: { type: String, default: null },
  awayTeam: { type: String, default: null },
  tradeVolume: { type: Number, default: null },
  homeIcon: { type: String, default: null },
  awayIcon: { type: String, default: null },
  is_home: { type: Number, default: 0 },
  is_hot: { type: Number, default: 0 },
  resultH: { type: Number, default: null },
  resultC: { type: Number, default: null },
  resultUpH: { type: Number, default: null },
  resultUpC: { type: Number, default: null },
  resultUpdate: { type: Number, default: 0 },
  message: { type: String, default: null },
  created: { type: Number, default: null },
  updated: { type: Number, default: null },
  status: { type: Number, default: 0 },
  baotoan: { type: Boolean, default: false },
  baotoanvon: {
    keo: { type: String },
    tyso: {
      type: String
    }
  }
})

trandauSchema.virtual('resultFt').get(function () {
  if (this.resultH !== null && this.resultC !== null) {
    return `${this.resultH}:${this.resultC}`
  }
  return ''
})

trandauSchema.virtual('resultHt').get(function () {
  if (this.resultUpH !== null && this.resultUpC !== null) {
    return `${this.resultUpH}:${this.resultUpC}`
  }
  return ''
})

trandauSchema.virtual('resultH2t').get(function () {
  if (
    this.resultH !== null &&
    this.resultUpH !== null &&
    this.resultC !== null &&
    this.resultUpC !== null
  ) {
    return `${this.resultH - this.resultUpH}:${this.resultC - this.resultUpC}`
  }
  return ''
})

trandauSchema.virtual('resultUpdateTime').get(function () {
  return this.resultUpdate > 0
    ? new Date(this.resultUpdate * 1000).toLocaleString()
    : ''
})

trandauSchema.virtual('resultChanLe').get(function () {
  if (this.resultH !== null && this.resultC !== null) {
    return (this.resultH + this.resultC) % 2 === 0 ? '1_1' : '0_0'
  }
  return ''
})

trandauSchema.virtual('resultThangHoaThua').get(function () {
  if (this.resultH !== null && this.resultC !== null) {
    return this.resultH > this.resultC
      ? '1_0'
      : this.resultH === this.resultC
      ? '0_0'
      : '0_1'
  }
  return ''
})

trandauSchema.virtual('resultThangHoaThuaHt').get(function () {
  return this.resultUpH !== null && this.resultUpC !== null
    ? this.resultUpH > this.resultUpC
      ? '1_0'
      : this.resultUpH === this.resultUpC
      ? '0_0'
      : '0_1'
    : ''
})

const TranDau = mongoose.model('TranDau', trandauSchema)

module.exports = TranDau
