const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const Config = require('../models/configModel')
const upload = require('./upload')

router.post('/import-configs', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../backup/__configs.json')
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const configs =
      jsonData.find(item => item.type === 'table' && item.name === '__configs')
        ?.data || []

    const formattedConfigs = configs.map(item => ({
      id: parseInt(item.id, 10),
      type: item.type || null,
      name: item.name || null,
      description: item.description || null,
      data: item.data || null,
      created: item.created ? parseInt(item.created, 10) : null,
      updated: item.updated ? parseInt(item.updated, 10) : null,
      status: parseInt(item.status, 10) || 1
    }))

    await Config.insertMany(formattedConfigs)

    res.status(201).json({
      message: 'Dữ liệu từ JSON đã được nhập vào database thành công!',
      configs: formattedConfigs
    })
  } catch (error) {
    console.error('Lỗi import JSON:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/capnhatconfig', async (req, res) => {
  try {
    const config1 = await Config.findOne({
      name: 'deposit_crypto_exchange_rate'
    })
    const config2 = await Config.findOne({
      name: 'withdrawal_crypto_exchange_rate'
    })
    config1.data = '27.70\r\n'
    config2.data = '27.70'
    await config1.save()
    await config2.save()
    res.json(config1)
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getconfig', async (req, res) => {
  try {
    const config = await Config.find({
      type: 'setting',
      name: {
        $in: [
          'name',
          'title',
          'email',
          'phone',
          'copyright',
          'logo',
          'photo',
          'favicon',
          'description',
          'keywords',
          'address',
          'about_us',
          'privacy',
          'facebook',
          'twitter',
          'youtube',
          'instagram',
          'author_url',
          'author'
        ]
      }
    }).lean()

    res.json(config)
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post(
  '/postconfig',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const updates = req.body

      if (req.files['logo']) updates.logo = `/${req.files['logo'][0].filename}`
      if (req.files['photo'])
        updates.photo = `/${req.files['photo'][0].filename}`
      if (req.files['favicon'])
        updates.favicon = `/${req.files['favicon'][0].filename}`

      for (const key in updates) {
        await Config.findOneAndUpdate(
          { name: key },
          { data: updates[key] },
          { upsert: true, new: true }
        )
      }

      res.json({ success: true, message: 'Cập nhật thành công!', updates })
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: 'Cập nhật thất bại!', error })
    }
  }
)

module.exports = router
