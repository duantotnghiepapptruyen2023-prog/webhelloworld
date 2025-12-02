const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const md5 = require('md5')

const Bet = require('../models/BetModel')
const Soccer = require('../models/TranDauModel')
const User = require('../models/UserModel')
const UserCoinlog = require('../models/CoinLogModel')
const fs = require('fs')
const path = require('path')
const { error } = require('console')

const generatedCodes = new Set()

async function generateUniqueCode () {
  let code
  do {
    code = crypto.randomBytes(6).toString('hex').toUpperCase()
  } while (generatedCodes.has(code) || (await Bet.exists({ code })))

  generatedCodes.add(code)
  return code
}

const BET_DISABLE_TIME = 5 * 60

router.post('/import-bets', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../backup/app_bets.json')

    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const bets =
      jsonData.find(item => item.type === 'table' && item.name === 'app_bets')
        ?.data || []

    const formattedBets = bets.map(bet => ({
      id: parseInt(bet.id, 10),
      code: bet.code || null,
      gameId: bet.gameId !== undefined ? parseInt(bet.gameId, 10) : null,
      user_id: bet.user_id !== undefined ? parseInt(bet.user_id, 10) : null,
      betType: bet.betType || null,
      gameKey: bet.gameKey || null,
      amount: bet.amount !== undefined ? parseFloat(bet.amount) : 0,
      profit: bet.profit !== undefined ? parseFloat(bet.profit) : 0,
      result: bet.result !== undefined ? parseInt(bet.result, 10) : 0,
      created: bet.created !== undefined ? parseInt(bet.created, 10) : 0,
      updated: bet.updated !== undefined ? parseInt(bet.updated, 10) : 0,
      status: bet.status !== undefined ? parseInt(bet.status, 10) : 1,
      check: bet.check || null,
      check1: bet.check1 || null
    }))

    await Bet.insertMany(formattedBets)

    res.status(201).json({
      message: 'Dữ liệu bets đã được nhập vào database thành công!',
      bets: formattedBets
    })
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/clearbet', async (req, res) => {
  try {
    await Bet.deleteMany({})
    res.json({ success: true, message: 'Đã xóa toàn bộ bet' })
  } catch (error) {
    console.error('Lỗi khi xóa bet:', error)
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
})

router.post('/postdatcuoc/:userid', async (req, res) => {
  try {
    const userId = req.params.userid
    const { gameId, betType, gameKey, betAmount, profit } = req.body

    const userInfo = await User.findOne({ id: userId })
    if (!userInfo) {
      return res.json({ status: -1, message: 'User not found!' })
    }

    const betInfo = await Soccer.findOne({
      gameId,
      status: { $gt: 0 }
    })
    if (!betInfo) {
      return res.json({
        status: -1,
        message: 'Không tìm thấy thông tin trận đấu'
      })
    }

    const latestBet = await Bet.findOne({ user_id: userId }).sort({
      created: -1
    })
    if (latestBet && Date.now() - latestBet.created * 1000 < 10 * 1000) {
      return res.json({
        status: -1,
        message:
          'Bạn chỉ có thể đặt lệnh mới sau 10 giây kể từ lần đặt lệnh gần nhất.'
      })
    }

    if (Date.now() > betInfo.started * 1000 - BET_DISABLE_TIME * 1000) {
      return res.json({
        status: -1,
        message:
          'Đã hết thời gian đặt cược, vui lòng đặt cược những trận đấu khác!'
      })
    }

    if (betAmount > userInfo.coins) {
      return res.json({ status: -1, message: 'Số dư không đủ' })
    }

    const created = Math.floor(Date.now() / 1000)

    const hashString = `${userId}${gameId}${gameKey}${betAmount}${created}`
    const hash = md5(hashString)

    const existingRecord = await Bet.findOne({ check: hash })
    if (existingRecord) {
      return res.json({
        status: -1,
        message: 'Đã có lệnh tương tự trước đó, vui lòng kiểm tra lại'
      })
    }

    const code = await generateUniqueCode()

    const lastBet = await Bet.findOne().sort({ id: -1 })
    const newBetId = lastBet ? lastBet.id + 1 : 1000

    const newBet = new Bet({
      id: newBetId,
      user_id: userId,
      gameId,
      betType,
      gameKey,
      amount: betAmount,
      check: hash,
      created: created,
      updated: created,
      code: code,
      profit: profit
    })
    await newBet.save()
    const lastcoin = await UserCoinlog.findOne().sort({ id: -1 })
    const newcoinId = lastcoin ? lastcoin.id + 1 : 1

    const usercoinlog = new UserCoinlog({
      id: newcoinId,
      user_id: userId,
      amount: betAmount,
      reason: `Đặt cược mã ${newBet.code}`,
      previous: userInfo.coins,
      created: created,
      updated: created,
      check: hash
    })
    await usercoinlog.save()

    await User.updateOne({ id: userId }, { $inc: { coins: -betAmount } })

    return res.json({ status: 1, success: 'Đặt cược thành công' })
  } catch (error) {
    console.error(error)
    return res.json({ status: -1, message: 'Lỗi server, vui lòng thử lại sau' })
  }
})

router.post('/huycuoc/:code', async (req, res) => {
  try {
    const code = req.params.code
    const bet = await Bet.findOne({ code: code })
    if (!bet) {
      return res.json({ error: 'Không tìm thấy lệnh đặt cược' })
    }

    if (bet.status === -1) {
      return res.json({
        error: 'Lệnh đặt cược đã bị hủy trước đó'
      })
    }

    const user = await User.findOne({ id: bet.user_id })
    if (!user) {
      return res.json({ error: 'Không tìm thấy người dùng' })
    }
    const created = Math.floor(Date.now() / 1000)
    const hashString = `${bet.user_id}${Date.now()}${bet.amount}`
    const hash = crypto.createHash('md5').update(hashString).digest('hex')
    const lastcoin = await UserCoinlog.findOne().sort({ id: -1 })
    const lastcoinId = lastcoin?.id ?? 0
    const newcoinId =
      Number.isInteger(lastcoinId) && lastcoinId > 0 ? lastcoinId + 1 : 1

    const existedCoinlog = await UserCoinlog.findOne({
      reason: `Hoàn tiền hủy đặt cược mã ${bet.code}`
    })
    if (existedCoinlog) {
      return res.json({
        error: 'Lệnh cược này đã được hoàn tiền trước đó'
      })
    }

    const usercoinlog = new UserCoinlog({
      id: newcoinId,
      user_id: bet.user_id,
      amount: bet.amount,
      reason: `Hoàn tiền hủy đặt cược mã ${bet.code}`,
      previous: user.coins,
      created: created,
      updated: created,
      check: hash
    })
    await usercoinlog.save()
    user.coins += bet.amount
    await user.save()
    bet.status = -1
    await bet.save()
    return res.json({ success: 'Hủy đặt cược thành công' })
  } catch (error) {
    console.error(error)
    return res.json({ error: 'Lỗi server, vui lòng thử lại sau' })
  }
})

module.exports = router
