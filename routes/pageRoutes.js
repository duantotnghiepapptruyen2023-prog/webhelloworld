const express = require('express')
const router = express.Router()
const Page = require('../models/pageModel')
const fs = require('fs')
const path = require('path')
const uploads = require('./upload')
const uploadDir = path.join(__dirname, '../uploads')
const removeAccents = require('remove-accents')

function generateSlug (title) {
  return removeAccents(title)
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase()
}

router.post('/import-json-posts', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../backup/__posts.json')
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const posts =
      jsonData.find(item => item.type === 'table' && item.name === '__posts')
        ?.data || []

    const formattedPosts = posts.map(post => ({
      id: parseInt(post.id, 10),
      title: post.title || null,
      slug: post.slug || null,
      parent_id: parseInt(post.parent_id, 10) || 0,
      content: post.content || null,
      tags: post.tags,
      created: parseInt(post.created, 10) || Math.floor(Date.now() / 1000),
      updated: parseInt(post.updated, 10) || null,
      status: parseInt(post.status, 10) || 0
    }))

    await Page.insertMany(formattedPosts)

    res.status(201).json({
      message: 'Dữ liệu từ __posts.json đã được nhập vào database thành công!',
      posts: formattedPosts
    })
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server', details: error.message })
    console.error('Lỗi khi nhập dữ liệu từ __posts.json:', error)
  }
})


router.get('/', async (req, res) => {
  try {
    let { page = 1, limit = 20 } = req.query

    page = parseInt(page)
    limit = parseInt(limit)

    if (page < 1) page = 1
    if (limit < 1) limit = 20

    const totalItems = await Page.countDocuments({ status: 1 })
    const totalPages = Math.ceil(totalItems / limit)

    const pages = await Page.find({ status: 1 })
      .sort({ created: 1 })
      .skip((page - 1) * limit)
      .limit(limit)

    res.json({
      totalItems,
      totalPages,
      currentPage: page,
      data: pages
    })
  } catch (error) {
    console.error('Lỗi khi lấy danh sách trang:', error)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

router.post('/search', async (req, res) => {
  try {
    let { page = 1, limit = 20 } = req.query
    const { search } = req.body

    page = parseInt(page)
    limit = parseInt(limit)

    if (page < 1) page = 1
    if (limit < 1) limit = 20

    let query = { status: 1 }

    if (search && search.trim() !== '') {
      const regex = new RegExp(search, 'i') 
      query.$or = [{ title: regex }, { slug: regex }]
    }

    console.log('Query:', query) 

    const totalItems = await Page.countDocuments(query)
    const totalPages = Math.ceil(totalItems / limit)

    const pages = await Page.find(query)
      .sort({ created: 1 })
      .skip((page - 1) * limit)
      .limit(limit)

    res.json({
      totalItems,
      totalPages,
      currentPage: page,
      data: pages
    })
  } catch (error) {
    console.error('Lỗi khi tìm kiếm trang:', error)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug
    const page = await Page.findOne({ slug })
    if (!page) {
      return res.status(404).json({ message: 'Không tìm thấy trang' })
    }
    res.json(page)
  } catch (err) {
    console.error('L��i khi tìm trang theo slug:', err)
    res.status(500).json({ message: 'L��i máy chủ' })
  }
})

router.get('/getchitiet/:pageid', async (req, res) => {
  try {
    const pageid = req.params.pageid
    const page = await Page.findById(pageid)

    if (!page) {
      return res.status(404).json({ message: 'Không tìm thấy trang' })
    }

    res.json(page)
  } catch (error) {
    console.error('Lỗi khi tìm trang theo slug:', error)
    res.status(500).json({ message: 'Lỗi máy chủ' })
  }
})

router.post(
  '/',
  uploads.fields([{ name: 'photo', maxCount: 1 }]),
  async (req, res) => {
    try {
      const { title, content, description, tags } = req.body
      let photo = null

      const lastPage = await Page.findOne().sort({ id: -1 })
      const bannerFileName = `${removeAccents(title).replace(/\s+/g, '_')}.png`

      const bannerFilePath = path.join(uploadDir, bannerFileName)

      if (fs.existsSync(bannerFilePath)) {
        photo = `${bannerFileName}`
      } else if (req.files['photo']) {
        fs.renameSync(req.files['photo'][0].path, bannerFilePath)
        photo = `${bannerFileName}`
      }

      const newPage = new Page({
        title,
        slug: generateSlug(title),
        content,
        description,
        tags,
        id: lastPage ? lastPage.id + 1 : 1,
        created: Math.floor(Date.now() / 1000).toString(),
        updated: null,
        type: 'page',
        status: req.body.status || '1'
      })

      if (photo) {
        newPage.photo = photo
      }

      const savedPage = await newPage.save()
      res.status(201).json(savedPage)
    } catch (error) {
      console.error('Lỗi khi tạo trang:', error)
      res.status(500).json({ message: 'Lỗi server' })
    }
  }
)

router.post(
  '/:pageid',
  uploads.fields([{ name: 'photo', maxCount: 1 }]),
  async (req, res) => {
    try {
      const { title, content, description, tags } = req.body
      const pageId = req.params.pageid
      let photo = null
      const updateFields = {}

      if (title) {
        updateFields.title = title
        updateFields.slug = generateSlug(title)
      }
      if (content) {
        updateFields.content = content
      }
      if (description) {
        updateFields.description = description
      }
      if (tags) {
        updateFields.tags = tags
      }
      updateFields.updated = Math.floor(Date.now() / 1000).toString()

      const bannerFileName = `${removeAccents(title).replace(/\s+/g, '_')}.png`
      const bannerFilePath = path.join(uploadDir, bannerFileName)
      if (fs.existsSync(bannerFilePath)) {
        photo = `${bannerFileName}`
      } else if (req.files['photo']) {
        fs.renameSync(req.files['photo'][0].path, bannerFilePath)
        photo = `${bannerFileName}`
      }

      if (photo) {
        updateFields.photo = photo
      }

      const updatedPage = await Page.findByIdAndUpdate(pageId, updateFields, {
        new: true
      })

      if (!updatedPage) {
        return res.status(404).json({ message: 'Không tìm thấy trang' })
      }

      res.json(updatedPage)
    } catch (error) {
      console.error('Lỗi khi cập nhật trang:', error)
      res.status(500).json({ message: 'Lỗi server' })
    }
  }
)

router.post('/delelepage/:pageid', async (req, res) => {
  try {
    const pageId = req.params.pageid
    const deletedPage = await Page.findByIdAndUpdate(pageId, { status: -1 })

    if (!deletedPage) {
      return res.status(404).json({ message: 'Không tìm thấy trang' })
    }

    res.json({ message: 'Đã xóa trang thành công' })
  } catch (error) {
    console.error('Lỗi khi xóa trang:', error)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

module.exports = router
