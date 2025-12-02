const express = require('express')
const fs = require('fs')
const path = require('path')
const CoinLog = require('../models/CoinLogModel')
const router = express.Router()

router.post('/import-coinlogs', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../backup/app_users_coin_logs.json')
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const coinLogs =
      jsonData.find(
        item => item.type === 'table' && item.name === 'app_users_coin_logs'
      )?.data || []

    const formattedCoinLogs = coinLogs.map(log => ({
      id: parseInt(log.id, 10),
      user_id: parseInt(log.user_id, 10),
      amount: parseFloat(log.amount),
      reason: log.reason || null,
      previous: parseFloat(log.previous) || 0,
      created: parseInt(log.created, 10) || 0,
      updated: parseInt(log.updated, 10) || 0,
      status: parseInt(log.status, 10) || 0,
      check: log.check || null
    }))

    await CoinLog.insertMany(formattedCoinLogs)

    res.status(201).json({
      message: 'Dữ liệu coinlog đã được nhập vào database thành công!',
      coinLogs: formattedCoinLogs.length
    })
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/clearcoinlog', async (req, res) => {
  try {
    await CoinLog.deleteMany({})
    res.status(200).json({ message: 'Xóa coinlog thành công!' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getcoinlog', async (req, res) => {
  try {
    const coinlog = await CoinLog.find().lean()
    res.json(coinlog)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

module.exports = router
