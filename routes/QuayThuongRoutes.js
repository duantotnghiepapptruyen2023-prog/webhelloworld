const express = require('express')
const router = express.Router()
const User = require('../models/UserModel')
const UserCoinLog = require('../models/CoinLogModel')
const LichSuQuayThuong = require('../models/LichSuQuayThuong')
const crypto = require('crypto')

router.post('/postquaythuong/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const user = await User.findById(userid)
    const created = Math.floor(Date.now() / 1000)

    if (!user) {
      return res.json({ error: 'Không tìm thấy người dùng' })
    }
    if (!user.luotquay || user.luotquay === 0) {
      return res.json({ error: 'Bạn đã hết lượt quay' })
    }
    if (user.diemthuong >= 300) {
      return res.json({
        error:
          'Điểm thưởng đã đạt tối đa'
      })
    }

    const allRewards = [2, 5, 10, 20, 50, 100, 200, 500]

    const allowedRewards = [15, 16]

    const reward =
      allowedRewards[Math.floor(Math.random() * allowedRewards.length)]

    user.diemthuong = (user.diemthuong || 0) + reward
    user.luotquay = (user.luotquay || 0) - 1

    await user.save()
    const lastls = await LichSuQuayThuong.findOne().sort({ id: -1 })
    const newlsId = lastls ? lastls.id + 1 : 1

    const lichsuquaythuong = new LichSuQuayThuong({
      id: newlsId,
      user_id: user.id,
      amount: reward,
      created: created,
      updated: created
    })

    await lichsuquaythuong.save()

    res.json({
      message: 'Quay thưởng thành công',
      luotquay: user.luotquay,
      reward,
      diemthuong: user.diemthuong
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server khi quay thưởng' })
  }
})

router.post('/ruttienquaythuong/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const user = await User.findById(userid)
    const created = Math.floor(Date.now() / 1000)

    if (!user) {
      return res.json({ error: 'Không tìm thấy người dùng' })
    }
    if (user.diemthuong < 300) {
      return res.json({ error: 'Điểm thưởng phải đạt ít nhất là 300 để rút' })
    }
    const lastcoin = await UserCoinLog.findOne().sort({ id: -1 })
    const newcoinId = lastcoin ? lastcoin.id + 1 : 1
    const hashString = `${user.id}${user.diemthuong}${created}`
    const hash = crypto.createHash('md5').update(hashString).digest('hex')
    const createdDate = new Date(created * 1000)
    const day = String(createdDate.getDate()).padStart(2, '0')
    const month = String(createdDate.getMonth() + 1).padStart(2, '0')
    const year = createdDate.getFullYear()
    const formattedDate = `${day}/${month}/${year}`

    const usercoinlog = new UserCoinLog({
      id: newcoinId,
      amount: user.diemthuong,
      user_id: user.id,
      reason: `Rút tiền quay thưởng ngày ${formattedDate}`,
      previous: user.coins,
      created: created,
      updated: created,
      check: hash
    })
    await usercoinlog.save()
    user.coins = user.coins + user.diemthuong
    user.diemthuong = 0
    await user.save()
    res.json({
      message: 'Tiền thưởng đã được cộng vào số dư'
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server khi rút tiền' })
  }
})

router.get('/getlichsuquaythuong/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const user = await User.findById(userid)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }
    const now = new Date()
    const startOfDay =
      Math.floor(new Date(now.setHours(0, 0, 0, 0)).getTime() / 1000) -
      new Date().getTimezoneOffset() * 60 +
      7 * 60 * 60
    const endOfDay = startOfDay + 86399

    const data = await LichSuQuayThuong.find({
      user_id: user.id,
      created: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ created: -1 })

    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server khi lấy lịch sử quay thưởng' })
  }
})

router.get('/getlichsuquaythuongadmin/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const user = await User.findById(userid)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    const total = await LichSuQuayThuong.countDocuments({ user_id: user.id })

    const data = await LichSuQuayThuong.find({ user_id: user.id })
      .sort({ created: -1 })
      .skip(skip)
      .limit(limit)

    res.json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server khi lấy lịch sử quay thưởng' })
  }
})

module.exports = router
