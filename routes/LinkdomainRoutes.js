const express = require('express')
const router = express.Router()
const linkdomain = require('../models/linkdomainchinh')

router.get('/domainchinh', async (req, res) => {
  try {
    const domain = await linkdomain.find().lean()
    const domainlink = domain[0].link
    res.json({domainlink,id:domain[0]._id})
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/postdomain', async (req, res) => {
  try {
    const { link } = req.body
    const domain = new linkdomain({
      link: link
    })

    await domain.save()
    res.json({ message: 'Đã thêm thông tin' })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/updatedomainchinh/:id', async (req, res) => {
  try {
    const id = req.params.id
    const { link } = req.body
    const user = await linkdomain.findById(id)
    if (!user) {
      return res.status(404).json({ error: 'User không tồn tại' })
    }
    user.link = link
    await user.save()
    res.json({ message: 'Đã cập nhật thông tin' })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

module.exports = router
