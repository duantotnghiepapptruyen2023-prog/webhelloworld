const mongoose = require('mongoose')

const linkdomainSchema = new mongoose.Schema({
  link: { type: String }
})

const linkdomain = mongoose.model('linkdomain', linkdomainSchema)

module.exports = linkdomain
