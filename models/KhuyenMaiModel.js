const mongoose = require('mongoose');

const KhuyenMaiSchema = new mongoose.Schema({
    id: { type: Number },
    category_id: { type: Number },
    slideshow: { type: Number },
    name: { type: String },
    description: { type: String },
    banner: { type: String },
    photo: { type: String, default: null },
    start_date: { type: String },
    end_date: { type: String },
    link: { type: String },
    created: { type: Number, default: () => Math.floor(Date.now() / 1000) },
    updated: { type: Number, default: null },
    status: { type: Number, default: 1 },
});
const KhuyenMai = mongoose.model('KhuyenMai', KhuyenMaiSchema)

module.exports = KhuyenMai
