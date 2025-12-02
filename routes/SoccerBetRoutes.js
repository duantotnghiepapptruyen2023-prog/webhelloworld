const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const SoccerBet = require('../models/SoccerBetModel')
const TranDau = require('../models/TranDauModel')

const typeHexToString = hex =>
  Buffer.from(hex.replace(/^0x/, ''), 'hex').toString()

router.post('/import-soccer-bet', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../backup/app_soccer_bet.json')
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const soccerBetData =
      jsonData.find(
        item => item.type === 'table' && item.name === 'app_soccer_bet'
      )?.data || []

    const formattedBets = soccerBetData.map(bet => ({
      id: parseInt(bet.id, 10),
      gameId: parseInt(bet.gameId, 10) || null,
      type: bet.type.startsWith('0x') ? typeHexToString(bet.type) : bet.type,
      data: Object.entries(JSON.parse(bet.data)).map(([keo, profit]) => ({
        keo,
        profit: profit
      })),
      created: parseInt(bet.created, 10) || null,
      updated: parseInt(bet.updated, 10) || null,
      status: parseInt(bet.status, 10) || 1
    }))

    await SoccerBet.insertMany(formattedBets)

    res.status(201).json({
      message: 'Dữ liệu app_soccer_bet đã được nhập vào database thành công!',
      bets: formattedBets
    })
  } catch (error) {
    console.error('Lỗi khi nhập dữ liệu:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/postsoccerbet/:gameId', async (req, res) => {
  try {
    const gameId = req.params.gameId
    const { type, data } = req.body

    let soccerbet = await SoccerBet.findOne({ gameId, type })

    if (soccerbet) {
      soccerbet.data = data
      await soccerbet.save()
    } else {
      soccerbet = new SoccerBet({ gameId, type, data })
      await soccerbet.save()
    }

    res.json(soccerbet)
  } catch (error) {
    console.error('Lỗi khi nhập dữ liệu:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getsoccerbet/:gameId', async (req, res) => {
  try {
    const gameId = req.params.gameId
    const { type } = req.query

    const soccerbet = await SoccerBet.findOne({ gameId, type })
    if (!soccerbet) {
      return res.status(404).json({ message: 'Không tìm thấy dữ liệu' })
    }
    res.json(soccerbet)
  } catch (error) {
    console.error('Lỗi khi nhập dữ liệu:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getchitietkeo/:gameId', async (req, res) => {
  try {
    const gameId = Number(req.params.gameId)
    const soccerbets = await SoccerBet.find({ gameId }).lean()
    const trandau = await TranDau.findOne({ gameId })

    if (!soccerbets || soccerbets.length === 0) {
      return res.json({ message: 'Không tìm thấy dữ liệu' })
    }

    const tabNames = [
      { id: '1_1', name: 'FT Tỷ số', type: 'FT' },
      { id: '1_2', name: 'FT Chẵn lẻ', type: 'FT' },
      { id: '1_3', name: 'FT Thắng Hòa Thua', type: 'FT' },
      { id: '2_1', name: 'HT Tỷ số', type: 'HT' },
      { id: '2_3', name: 'HT Thắng Hòa Thua', type: 'HT' },
      { id: '3_1', name: 'H2T Tỷ số', type: 'H2T' }
    ]

    const formattedData = {}

    soccerbets.forEach(bet => {
      const tab = tabNames.find(t => t.id === bet.type)
      if (!tab) return

      if (!formattedData[bet.type]) {
        formattedData[bet.type] = {}
      }

      bet.data.forEach(item => {
        let key = item.keo === 'Khác' ? 'Other' : item.keo.replace(':', '_')

        let isMatch = false

        if (trandau.baotoan && trandau.baotoanvon) {
          const { tyso, keo } = trandau.baotoanvon
          if (tyso === bet.type && keo === key) {
            isMatch = true
          }
        }

        formattedData[bet.type][key] = {
          type: tab.type,
          name: item.keo,
          value: item.profit,
          baotoan: isMatch
        }
      })
    })

    res.json(formattedData)
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getchitietbet/:gameId', async (req, res) => {
  try {
    const gameId = Number(req.params.gameId)
    const { type } = req.query
    const soccerbets = await SoccerBet.find({ gameId, type }).lean()
    console.log(soccerbets)
    const trandau = await TranDau.findOne({ gameId })

    if (!soccerbets || soccerbets.length === 0) {
      return res.json({ message: 'Không tìm thấy dữ liệu' })
    }

    let formattedData = {}

    soccerbets.forEach(bet => {
      bet.data.forEach(item => {
        let key = item.keo === 'Khác' ? 'Other' : item.keo.replace(':', '_')
        let isMatch = false

        if (trandau.baotoan && trandau.baotoanvon) {
          const { tyso, keo } = trandau.baotoanvon
          if (keo === type && tyso === key) {
            isMatch = true
          }
        }

        formattedData[key] = {
          name: item.keo,
          value: item.profit,
          locked: item.locked || false,
          baotoan: isMatch
        }
      })
    })

    res.json(formattedData)
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/clearsoccerbet', async (req, res) => {
  try {
    await SoccerBet.deleteMany({})
    res.json({ success: true, message: 'Đã xóa toàn bộ soccerbet' })
  } catch (error) {
    console.error('Lỗi khi xóa soccerbet:', error)
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
})

module.exports = router
