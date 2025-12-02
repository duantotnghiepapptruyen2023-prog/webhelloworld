const express = require('express')
const router = express.Router()
const KhuyenMai = require('../models/KhuyenMaiModel')
const TheLoaiKhuyenMai = require('../models/ProMoTionCategoryModel')
const path = require('path')
const fs = require('fs')
const uploads = require('./upload')
const uploadDir = path.join(__dirname, '../uploads')

router.post('/import-promotions', async (req, res) => {
  try {
    console.log('Bắt đầu import dữ liệu promotion từ JSON...')

    const filePath = path.join(__dirname, '../backup/app_promotion.json')

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ error: 'File backup promotion không tồn tại' })
    }

    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const promotions =
      jsonData.find(
        item => item.type === 'table' && item.name === 'app_promotion'
      )?.data || []

    if (!promotions.length) {
      return res
        .status(400)
        .json({ error: 'Không có dữ liệu promotion để import' })
    }

    const formattedPromotions = promotions.map(promo => ({
      id: promo.id !== undefined ? parseInt(promo.id, 10) : undefined,
      category_id:
        promo.category_id !== undefined
          ? parseInt(promo.category_id, 10)
          : undefined,
      slideshow:
        promo.slideshow !== undefined ? parseInt(promo.slideshow, 10) : 0,
      name: promo.name || undefined,
      description: promo.description || undefined,
      banner: promo.banner || undefined,
      photo: promo.photo || undefined,
      start_date: promo.start_date || undefined,
      end_date: promo.end_date || undefined,
      link: promo.link || undefined,
      status: promo.status !== undefined ? parseInt(promo.status, 10) : 1,
      created:
        promo.created !== undefined ? parseInt(promo.created, 10) : undefined,
      updated:
        promo.updated !== undefined ? parseInt(promo.updated, 10) : undefined
    }))

    const bulkOps = formattedPromotions.map(promo => ({
      updateOne: {
        filter: { id: promo.id },
        update: { $set: promo },
        upsert: true
      }
    }))

    await KhuyenMai.bulkWrite(bulkOps)

    console.log('Import dữ liệu promotion thành công!')
    res.status(201).json({
      message: 'Dữ liệu promotion đã được import vào database thành công!',
      importedCount: formattedPromotions.length
    })
  } catch (error) {
    console.error('Lỗi khi import dữ liệu promotion:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/import-promotion-categories', async (req, res) => {
  try {
    console.log('Bắt đầu import dữ liệu promotion categories từ JSON...')

    const filePath = path.join(
      __dirname,
      '../backup/app_promotion_category.json'
    )

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ error: 'File backup promotion categories không tồn tại' })
    }

    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const promotionCategories =
      jsonData.find(
        item => item.type === 'table' && item.name === 'app_promotion_category'
      )?.data || []

    if (!promotionCategories.length) {
      return res
        .status(400)
        .json({ error: 'Không có dữ liệu promotion categories để import' })
    }

    const formattedPromotionCategories = promotionCategories.map(category => ({
      id: category.id !== undefined ? parseInt(category.id, 10) : undefined,
      name: category.name || null,
      status: category.status !== undefined ? parseInt(category.status, 10) : 1,
      created:
        category.created !== undefined ? parseInt(category.created, 10) : null,
      updated:
        category.updated !== undefined ? parseInt(category.updated, 10) : null
    }))

    const bulkOps = formattedPromotionCategories.map(category => ({
      updateOne: {
        filter: { id: category.id },
        update: { $set: category },
        upsert: true
      }
    }))

    await TheLoaiKhuyenMai.bulkWrite(bulkOps)

    console.log('Import dữ liệu promotion categories thành công!')
    res.status(201).json({
      message:
        'Dữ liệu promotion categories đã được import vào database thành công!',
      importedCount: formattedPromotionCategories.length
    })
  } catch (error) {
    console.error('Lỗi khi import dữ liệu promotion categories:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getfulltheloai', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const total = await TheLoaiKhuyenMai.countDocuments({ status: 1 })

    const theloai = await TheLoaiKhuyenMai.find({ status: 1 })
      .skip(skip)
      .limit(limit)
      .lean()

    res.json({
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total,
      data: theloai
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getfulltheloainopage', async (req, res) => {
  try {
    const theloai = await TheLoaiKhuyenMai.find({ status: 1 })

    res.json(theloai)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/posttheloaikm', async (req, res) => {
  try {
    const { name } = req.body
    const lastRecord = await TheLoaiKhuyenMai.findOne().sort({ id: -1 })
    const newId = lastRecord ? lastRecord.id + 1 : 1

    const newTheLoai = new TheLoaiKhuyenMai({
      id: newId,
      name,
      created: Math.floor(Date.now() / 1000),
      updated: Math.floor(Date.now() / 1000)
    })
    await newTheLoai.save()
    res.json(newTheLoai)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/updatetheloaikm/:theloaiId', async (req, res) => {
  try {
    const theloaiId = req.params.theloaiId
    const { name } = req.body
    const theLoai = await TheLoaiKhuyenMai.findById(theloaiId)
    theLoai.name = name
    theLoai.updated = Math.floor(Date.now() / 1000)
    await theLoai.save()
    res.json(theLoai)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/xoatheloaikm/:theloaiId', async (req, res) => {
  try {
    const theloaiId = req.params.theloaiId
    const theLoai = await TheLoaiKhuyenMai.findById(theloaiId)
    theLoai.status = -1
    theLoai.updated = Math.floor(Date.now() / 1000)
    await theLoai.save()
    res.json(theLoai)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/searchtheloaikm', async (req, res) => {
  try {
    const keyword = req.body.keyword || ''
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    let query = {}
    if (keyword) {
      query.name = new RegExp(keyword, 'i')
    }

    const totalRecords = await TheLoaiKhuyenMai.countDocuments(query)

    const categories = await TheLoaiKhuyenMai.find(query)
      .skip(skip)
      .limit(limit)
      .lean()

    res.json({
      currentPage: page,
      totalPages: Math.ceil(totalRecords / limit),
      totalRecords,
      data: categories
    })
  } catch (error) {
    console.error('Lỗi server:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/khuyenmai', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const totalKhuyenMai = await KhuyenMai.countDocuments({ status: 1 })
    const khuyenMaiList = await KhuyenMai.find({ status: 1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const khuyenMaijson = await Promise.all(
      khuyenMaiList.map(async khuyenmai => {
        const theloai = await TheLoaiKhuyenMai.findOne({
          id: khuyenmai.category_id
        }).lean()
        return {
          _id: khuyenmai._id,
          id: khuyenmai.id,
          name: khuyenmai.name,
          category_id: theloai?.id || null,
          category_name: theloai?.name || 'Không xác định',
          banner: khuyenmai.banner,
          photo: khuyenmai.photo,
          slideshow: khuyenmai.slideshow,
          description: khuyenmai.description,
          start_date: khuyenmai.start_date,
          end_date: khuyenmai.end_date,
          link: khuyenmai.link,
          created: khuyenmai.created,
          updated: khuyenmai.updated,
          status: khuyenmai.status
        }
      })
    )

    res.json({
      currentPage: page,
      totalPages: Math.ceil(totalKhuyenMai / limit),
      totalItems: totalKhuyenMai,
      data: khuyenMaijson
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/searchkhuyenmai', async (req, res) => {
  try {
    const { search } = req.body

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    let query = {}
    if (search) {
      query.name = new RegExp(search, 'i')
      query.status = 1
    }

    const totalKhuyenMai = await KhuyenMai.countDocuments(query)
    const khuyenmailist = await KhuyenMai.find(query)
      .skip(skip)
      .limit(limit)
      .lean()

    const khuyenMaijson = await Promise.all(
      khuyenmailist.map(async khuyenmai => {
        const theloai = await TheLoaiKhuyenMai.findOne({
          id: khuyenmai.category_id
        }).lean()
        return {
          _id: khuyenmai._id,
          id: khuyenmai.id,
          name: khuyenmai.name,
          category_id: theloai?.id || null,
          category_name: theloai?.name || 'Không xác định',
          banner: khuyenmai.banner,
          photo: khuyenmai.photo,
          slideshow: khuyenmai.slideshow,
          description: khuyenmai.description,
          start_date: khuyenmai.start_date,
          end_date: khuyenmai.end_date,
          link: khuyenmai.link,
          created: khuyenmai.created,
          updated: khuyenmai.updated,
          status: khuyenmai.status
        }
      })
    )

    res.json({
      currentPage: page,
      totalPages: Math.ceil(totalKhuyenMai / limit),
      totalItems: totalKhuyenMai,
      data: khuyenMaijson
    })
  } catch (error) {
    console.error('Lỗi server:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/khuyenmaijson', async (req, res) => {
  try {
    const { category } = req.query

    const khuyenMaiList = await KhuyenMai.find({ status: 1 })

    const khuyenMaijsonRaw = await Promise.all(
      khuyenMaiList.map(async khuyenmai => {
        const theloai = await TheLoaiKhuyenMai.findOne({
          id: khuyenmai.category_id
        }).lean()

        return {
          _id: khuyenmai._id,
          id: khuyenmai.id,
          name: khuyenmai.name,
          category_id: theloai?.id || null,
          category_name: theloai?.name || 'Không xác định',
          banner: khuyenmai.banner,
          photo: khuyenmai.photo,
          slideshow: khuyenmai.slideshow,
          description: khuyenmai.description,
          start_date: khuyenmai.start_date,
          end_date: khuyenmai.end_date,
          link: khuyenmai.link,
          created: khuyenmai.created,
          updated: khuyenmai.updated,
          status: khuyenmai.status
        }
      })
    )

    // Lọc sau khi đã resolve Promise.all
    const khuyenMaijson = category
      ? khuyenMaijsonRaw.filter(km => km.category_name === category)
      : khuyenMaijsonRaw

    res.json(khuyenMaijson)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/getkhuyenmai/:id', async (req, res) => {
  try {
    const khuyenMai = await KhuyenMai.findOne({ id: req.params.id })
    if (!khuyenMai)
      return res.status(404).json({ message: 'Khuyến mãi không tồn tại' })
    res.json(khuyenMai)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/getfullkm', async (req, res) => {
  const tlkm = await TheLoaiKhuyenMai.find().lean()
  res.json(tlkm)
})

router.get('/getbannertrangchu', async (req, res) => {
  try {
    const category = req.query.category

    const theloaikhuyenmai = await TheLoaiKhuyenMai.findOne({
      name: category
    })
    const banner = await KhuyenMai.find({
      status: 1,
      slideshow: 1,
      category_id: theloaikhuyenmai.id
    }).lean()
    if (!banner) {
      return res
        .status(404)
        .json({ message: 'Không tìm thấy banner trang chủ' })
    }
    res.json(banner)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

router.post(
  '/khuyenmai',
  uploads.fields([
    { name: 'banner', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        category_id,
        slideshow,
        name,
        description,
        end_date,
        start_date,
        link
      } = req.body

      const bannerFileName = `${name.replace(/\s+/g, '_')}_banner.png`
      const photoFileName = `${name.replace(/\s+/g, '_')}_photo.png`

      const bannerFilePath = path.join(uploadDir, bannerFileName)
      const photoFilePath = path.join(uploadDir, photoFileName)

      let bannerIcon = null
      let photoIcon = null

      if (fs.existsSync(bannerFilePath)) {
        bannerIcon = `${bannerFileName}`
      } else if (req.files['banner']) {
        fs.renameSync(req.files['banner'][0].path, bannerFilePath)
        bannerIcon = `${bannerFileName}`
      }

      if (fs.existsSync(photoFilePath)) {
        photoIcon = `${photoFileName}`
      } else if (req.files['photo']) {
        fs.renameSync(req.files['photo'][0].path, photoFilePath)
        photoIcon = `${photoFileName}`
      }

      const lastRecord = await KhuyenMai.findOne().sort({ id: -1 })
      const newId = lastRecord ? lastRecord.id + 1 : 1

      const newKhuyenMai = new KhuyenMai({
        id: newId,
        category_id,
        slideshow,
        name,
        start_date,
        end_date,
        banner: bannerIcon,
        photo: photoIcon,
        created: Math.floor(Date.now() / 1000),
        updated: Math.floor(Date.now() / 1000)
      })

      if (slideshow) {
        newKhuyenMai.slideshow = slideshow
      }

      if (link) {
        newKhuyenMai.link = link
      }
      if (description) {
        newKhuyenMai.description = description
      }

      await newKhuyenMai.save()
      res.status(201).json(newKhuyenMai)
    } catch (err) {
      res.status(400).json({ message: err.message })
    }
  }
)

router.get('/gethitietkhuyenmai/:idkm', async (req, res) => {
  try {
    const idkm = req.params.idkm
    const khuyenmai = await KhuyenMai.findOne({ id: idkm })
    if (!khuyenmai)
      return res.status(404).json({ message: 'Khuyến mãi không tồn tại' })
    res.json(khuyenmai)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

router.post(
  '/khuyenmai/:id',
  uploads.fields([
    { name: 'banner', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { id } = req.params
      const {
        category_id,
        slideshow,
        name,
        description,
        end_date,
        start_date,
        link
      } = req.body

      const existingKhuyenMai = await KhuyenMai.findOne({ id })
      if (!existingKhuyenMai) {
        return res.status(404).json({ message: 'Khuyến mãi không tồn tại' })
      }

      const bannerFileName = `${name.replace(/\s+/g, '_')}_banner.png`
      const photoFileName = `${name.replace(/\s+/g, '_')}_photo.png`
      const bannerFilePath = path.join(uploadDir, bannerFileName)
      const photoFilePath = path.join(uploadDir, photoFileName)

      let bannerIcon = existingKhuyenMai.banner
      let photoIcon = existingKhuyenMai.photo

      if (req.files['banner']) {
        fs.renameSync(req.files['banner'][0].path, bannerFilePath)
        bannerIcon = bannerFileName
      }

      if (req.files['photo']) {
        fs.renameSync(req.files['photo'][0].path, photoFilePath)
        photoIcon = photoFileName
      }

      existingKhuyenMai.category_id =
        category_id || existingKhuyenMai.category_id
      existingKhuyenMai.slideshow = slideshow || existingKhuyenMai.slideshow
      existingKhuyenMai.name = name || existingKhuyenMai.name
      existingKhuyenMai.start_date = start_date || existingKhuyenMai.start_date
      existingKhuyenMai.end_date = end_date || existingKhuyenMai.end_date
      existingKhuyenMai.banner = bannerIcon
      existingKhuyenMai.photo = photoIcon
      existingKhuyenMai.link = link || existingKhuyenMai.link
      existingKhuyenMai.description =
        description || existingKhuyenMai.description
      existingKhuyenMai.updated = Math.floor(Date.now() / 1000)

      await existingKhuyenMai.save()
      res.status(200).json(existingKhuyenMai)
    } catch (err) {
      res.status(400).json({ message: err.message })
    }
  }
)

router.post('/deletekhuyenmai/:id', async (req, res) => {
  try {
    const id = req.params.id

    const deletedKhuyenMai = await KhuyenMai.findById(id)

    if (!deletedKhuyenMai)
      return res.status(404).json({ message: 'Khuyến mãi không tồn tại' })
    deletedKhuyenMai.status = -1
    await deletedKhuyenMai.save()

    res.json({ message: 'Khuyến mãi đã bị xóa' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
