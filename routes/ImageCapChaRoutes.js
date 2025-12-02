const express = require('express')
const router = express.Router()
const ImageCapCha = require('../models/ImageCapchaModel')
const uploads = require('./upload')

router.post(
  '/postimagecapcha',
  uploads.array('image', 100),
  async (req, res) => {
    try {
      const images = req.files.map(file => `${file.filename}`)

      const lastImage = await ImageCapCha.findOne().sort({ value: -1 })
      let currentId = lastImage ? lastImage.value + 1 : 1

      const createdImages = await Promise.all(
        images.map(async imageUrl => {
          const newImageCapcha = new ImageCapCha({
            value: currentId++,
            image: imageUrl
          })
          return await newImageCapcha.save()
        })
      )

      res.json(createdImages)
    } catch (error) {
      console.error('Error saving images:', error)
      res.status(500).json({ message: error.message })
    }
  }
)

router.get('/getimagecapcha', async (req, res) => {
  try {
    const imagecapcha = await ImageCapCha.find().lean()

    let allImages = imagecapcha.map(item => ({
      _id: item._id,
      url: item.image,
      value: item.value
    }))

    if (allImages.length < 1) {
      return res.status(400).json({ message: 'Không đủ ảnh trong database' })
    }

    allImages = allImages.sort(() => Math.random() - 0.5)

    let selectedImages = allImages.slice(0, 8)

    const randomImage =
      selectedImages[Math.floor(Math.random() * selectedImages.length)]
    selectedImages.push(randomImage)

    function shuffleAvoidAdjacent (arr) {
      let isValid = false
      let shuffled

      while (!isValid) {
        shuffled = arr.sort(() => Math.random() - 0.5)
        isValid = shuffled.every(
          (img, index) => index === 0 || img.url !== shuffled[index - 1].url
        )
      }

      return shuffled
    }

    selectedImages = shuffleAvoidAdjacent(selectedImages)

    res.json(selectedImages)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})

router.get('/getimagecapcha2', async (req, res) => {
  try {
    const imagecapcha = await ImageCapCha.find().lean()

    let allImages = imagecapcha.map(item => ({
      _id: item._id,
      url: item.image,
      value: item.value
    }))

    if (allImages.length < 1) {
      return res.status(400).json({ message: 'Không đủ ảnh trong database' })
    }

    allImages = allImages.sort(() => Math.random() - 0.5)

    const selectedImages = allImages.slice(0, 9)

    res.json(selectedImages)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})

router.get('/getcapcha', async (req, res) => {
  try {
    const capcha = await ImageCapCha.find().lean()
    res.json(capcha)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})

router.post('/deletecapcha/:idcapcha', async (req, res) => {
  try {
    const idcapcha = req.params.idcapcha
    await ImageCapCha.findByIdAndDelete(idcapcha)
    res.json({ message: 'xóa thành công' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})

router.delete('/deleteallimagecapcha', async (req, res) => {
  try {
    await ImageCapCha.deleteMany({})
    res.json({ message: 'Đã xóa toàn bộ dữ liệu trong collection ImageCapCha' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})

module.exports = router
