const express = require('express')
const router = express.Router()
const UserBonus = require('../models/UserBonusModel')
const User = require('../models/UserModel')
const Bet = require('../models/BetModel')
const { getReferredByUser, getBonusByUser } = require('./getReferenceUser')
const fs = require('fs')
const path = require('path')
const JSONStream = require('jsonstream')

router.get('/userbonus', async (req, res) => {
  try {
    // Lấy tham số phân trang từ query string
    const page = parseInt(req.query.page) || 1 // Mặc định là trang 1
    const limit = parseInt(req.query.limit) || 10 // Mặc định 10 bản ghi mỗi trang
    const skip = (page - 1) * limit // Tính số bản ghi cần bỏ qua

    // Đếm tổng số bản ghi để tính tổng số trang (tùy chọn)
    const totalRecords = await UserBonus.countDocuments({})
    const totalPages = Math.ceil(totalRecords / limit)

    // Lấy dữ liệu với phân trang
    const userBonus = await UserBonus.find({})
      .skip(skip) // Bỏ qua các bản ghi trước đó
      .limit(limit) // Giới hạn số bản ghi trả về
      .lean() // Chuyển đổi sang plain JavaScript object

    // Trả về kết quả với thông tin phân trang
    res.json({
      success: true,
      data: userBonus,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalRecords: totalRecords,
        limit: limit
      }
    })
  } catch (error) {
    console.error('Lỗi khi lấy thông tin bonus:', error)
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
})

router.post('/clearuserbonus/', async (req, res) => {
  try {
    await UserBonus.deleteMany({})
    res.json({ success: true, message: 'Đã xóa toàn bộ bonus' })
  } catch (error) {
    console.error('Lỗi khi xóa người dùng:', error)
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
})

router.post('/import-bonus2', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../backup/app_users_bonus.json')
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const coinLogs =
      jsonData.find(
        item => item.type === 'table' && item.name === 'app_users_bonus'
      )?.data || []

    const formattedCoinLogs = coinLogs.map(log => ({
      id: log.id !== undefined ? parseInt(log.id, 10) : undefined,
      user_id: log.user_id !== undefined ? parseInt(log.user_id, 10) : null,
      type: log.type || null,
      target: log.target || null,
      action: log.action || null,
      bonus: log.bonus !== undefined ? parseFloat(log.bonus) : 0,
      description: log.description || null,
      referrer_id:
        log.referrer_id !== undefined ? parseInt(log.referrer_id, 10) : null,
      level: log.level !== undefined ? parseInt(log.level, 10) : null,
      created: log.created !== undefined ? parseInt(log.created, 10) : 0,
      updated: log.updated !== undefined ? parseInt(log.updated, 10) : 0,
      status: log.status !== undefined ? parseInt(log.status, 10) : 1
    }))

    await UserBonus.insertMany(formattedCoinLogs)

    res.status(201).json({
      message: 'Dữ liệu userbonus đã được nhập vào database thành công!',
      coinLogs: formattedCoinLogs.length
    })
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/import-bonus', async (req, res) => {
  try {
    console.log('Bắt đầu import dữ liệu bonus từ JSON...')

    const filePath = path.join(__dirname, '../backup/app_users_bonus.json')
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File backup bonus không tồn tại' })
    }

    const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
    const parser = JSONStream.parse('*.data.*') // Đọc từng phần tử trong "data"

    let batchSize = 1000 // Số bản ghi xử lý mỗi lần
    let batch = [] // Lưu batch hiện tại
    let totalImported = 0

    parser.on('data', async bonus => {
      // Format dữ liệu trước khi import
      const formattedBonus = {
        id: bonus.id !== undefined ? parseInt(bonus.id, 10) : undefined,
        user_id:
          bonus.user_id !== undefined ? parseInt(bonus.user_id, 10) : null,
        type: bonus.type || null,
        target: bonus.target || null,
        action: bonus.action || null,
        bonus: bonus.bonus !== undefined ? parseFloat(bonus.bonus) : 0,
        description: bonus.description || null,
        referrer_id:
          bonus.referrer_id !== undefined
            ? parseInt(bonus.referrer_id, 10)
            : null,
        level: bonus.level !== undefined ? parseInt(bonus.level, 10) : null,
        created: bonus.created !== undefined ? parseInt(bonus.created, 10) : 0,
        updated: bonus.updated !== undefined ? parseInt(bonus.updated, 10) : 0,
        status: bonus.status !== undefined ? parseInt(bonus.status, 10) : 1
      }

      batch.push(formattedBonus)

      // Khi đạt đến batchSize, thực hiện import
      if (batch.length >= batchSize) {
        stream.pause() // Tạm dừng đọc file để xử lý batch

        const bulkOps = batch.map(bonus => ({
          updateOne: {
            filter: { id: bonus.id },
            update: { $set: bonus },
            upsert: true
          }
        }))

        await UserBonus.bulkWrite(bulkOps)
        totalImported += batch.length
        console.log(`Đã import ${totalImported} bản ghi`)

        batch = [] // Reset batch
        stream.resume() // Tiếp tục đọc file
      }
    })

    parser.on('end', async () => {
      if (batch.length > 0) {
        // Import batch cuối cùng nếu còn dữ liệu
        const bulkOps = batch.map(bonus => ({
          updateOne: {
            filter: { id: bonus.id },
            update: { $set: bonus },
            upsert: true
          }
        }))

        await UserBonus.bulkWrite(bulkOps)
        totalImported += batch.length
      }

      console.log(`Import hoàn tất! Tổng số bản ghi: ${totalImported}`)
      res.status(201).json({
        message: 'Dữ liệu bonus đã được import thành công!',
        importedCount: totalImported
      })
    })

    parser.on('error', error => {
      console.error('Lỗi khi parse JSON:', error)
      res.status(500).json({ error: 'Lỗi server', details: error.message })
    })

    stream.pipe(parser) // Đọc dữ liệu từ file và parse
  } catch (error) {
    console.error('Lỗi khi import dữ liệu bonus:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getuserbonus', async (req, res) => {
  try {
    const userbonus = await UserBonus.aggregate([
      {
        $group: {
          _id: '$user_id',
          total_bonus: { $sum: '$bonus' }
        }
      }
    ])

    res.json(userbonus)
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})
router.get('/getbonustheouser/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const userbonus = await UserBonus.find({ user_id: userid }).lean()
    res.json(userbonus)
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getbonususer/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const page = parseInt(req.query.page) || 1 // Mặc định trang 1
    const limit = 20
    const skip = (page - 1) * limit

    const user = await User.findById(userid)
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' })
    }

    const userbonus = await UserBonus.find({ user_id: user.id })
      .skip(skip)
      .limit(limit)

    const totalCount = await UserBonus.countDocuments({ user_id: user.id }) // Tổng số bản ghi

    res.json({
      data: userbonus,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.get('/referred/:userid', async (req, res) => {
  try {
    const userid = req.params.userid

    const [
      hoahongTodayF1,
      dangkyTodayF1,
      hequaTodayF1,
      hoahongYesterdayF1,
      dangkyYesterdayF1,
      hequoYesterdayF1,
      hoahongTodayF2F3,
      dangkyTodayF2F3,
      hequaTodayF2F3,
      hoahongYesterdayF2F3,
      dangkyYesterdayF2F3,
      hequoYesterdayF2F3
    ] = await Promise.all([
      getReferredByUser(userid, 'direct', 'today', 'bet'),
      getReferredByUser(userid, 'direct', 'today', 'count'),
      getBonusByUser(userid, 'direct', 'today'),
      getReferredByUser(userid, 'direct', 'yesterday', 'bet'),
      getReferredByUser(userid, 'direct', 'yesterday', 'count'),
      getBonusByUser(userid, 'direct', 'yesterday'),
      getReferredByUser(userid, 'team', 'today', 'bet'),
      getReferredByUser(userid, 'team', 'today', 'count'),
      getBonusByUser(userid, 'team', 'today'),
      getReferredByUser(userid, 'team', 'yesterday', 'bet'),
      getReferredByUser(userid, 'team', 'yesterday', 'count'),
      getBonusByUser(userid, 'team', 'yesterday')
    ])

    const dailyjson = {
      f1: {
        hequatoday: hequaTodayF1,
        dangkytoday: dangkyTodayF1,
        hoahongtoday: hoahongTodayF1,
        hoahongyesterday: hoahongYesterdayF1,
        dangkyyesterday: dangkyYesterdayF1,
        hequoyesterday: hequoYesterdayF1
      },
      f2f3: {
        hoahongtoday: hoahongTodayF2F3,
        dangkytoday: dangkyTodayF2F3,
        hequatoday: hequaTodayF2F3,
        hoahongyesterday: hoahongYesterdayF2F3,
        dangkyyesterday: dangkyYesterdayF2F3,
        hequoyesterday: hequoYesterdayF2F3
      }
    }

    res.json(dailyjson)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

router.get('/getbonusdatef1/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const user = await User.findById(userid)
    let { startdate, enddate } = req.query

    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' })
    }

    if (!startdate) {
      startdate = enddate
    } else if (!enddate) {
      enddate = startdate
    }

    const startOfToday = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000)
    const endOfToday = startOfToday + 86399

    let userbonus

    if (!startdate && !enddate) {
      userbonus = await UserBonus.find({
        user_id: user.id,
        level: 1,
        created: { $gte: startOfToday, $lte: endOfToday }
      }).lean()
    } else {
      const startTimestamp = Math.floor(
        new Date(startdate + ' 00:00:00').getTime() / 1000
      )
      const endTimestamp = Math.floor(
        new Date(enddate + ' 23:59:59').getTime() / 1000
      )

      userbonus = await UserBonus.find({
        user_id: user.id,
        level: 1,
        created: { $gte: startTimestamp, $lte: endTimestamp }
      }).lean()
    }

    const datajson = await Promise.all(
      userbonus.map(async bonus => {
        const referrer = await User.findOne({ id: bonus.user_id })
        const bet = await Bet.findOne({ code: bonus.action })
        return {
          user: referrer.username,
          date: bonus.created,
          amount: bet.amount,
          bonus: bonus.bonus
        }
      })
    )

    return res.json(datajson)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Lỗi server' })
  }
})
router.get('/getbonusdatef2f3/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const user = await User.findById(userid)
    let { startdate, enddate } = req.query

    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' })
    }

    if (!startdate) {
      startdate = enddate
    } else if (!enddate) {
      enddate = startdate
    }

    const startOfToday = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000)
    const endOfToday = startOfToday + 86399

    let userbonus

    if (!startdate && !enddate) {
      userbonus = await UserBonus.find({
        user_id: user.id,
        level: {
          $in: [2, 3]
        },
        created: { $gte: startOfToday, $lte: endOfToday }
      }).lean()
    } else {
      const startTimestamp = Math.floor(
        new Date(startdate + ' 00:00:00').getTime() / 1000
      )
      const endTimestamp = Math.floor(
        new Date(enddate + ' 23:59:59').getTime() / 1000
      )

      userbonus = await UserBonus.find({
        user_id: user.id,
        level: {
          $in: [2, 3]
        },
        created: { $gte: startTimestamp, $lte: endTimestamp }
      }).lean()
    }

    const datajson = await Promise.all(
      userbonus.map(async bonus => {
        const referrer = await User.findOne({ id: bonus.user_id })
        const bet = await Bet.findOne({ code: bonus.action })
        return {
          user: referrer.username,
          date: bonus.created,
          amount: bet.amount,
          bonus: bonus.bonus
        }
      })
    )

    return res.json(datajson)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Lỗi server' })
  }
})

router.get('/getbonusdate/:userid', async (req, res) => {
  try {
    const { userid } = req.params
    const { startdate, enddate, type } = req.query

    const user = await User.findById(userid).lean()
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' })
    }

    const levelFilter =
      type === 'f1' ? 1 : type === 'f2f3' ? { $in: [2, 3] } : null
    if (!levelFilter) {
      return res.status(400).json({ message: 'Type không hợp lệ' })
    }

    let startTimestamp, endTimestamp
    if (!startdate && !enddate) {
      startTimestamp = Math.floor(Date.now() / 1000 / 86400) * 86400
      endTimestamp = startTimestamp + 86399
    } else {
      const start = startdate || enddate
      const end = enddate || startdate
      startTimestamp = Math.floor(
        new Date(`${start} 00:00:00`).getTime() / 1000
      )
      endTimestamp = Math.floor(new Date(`${end} 23:59:59`).getTime() / 1000)
    }

    // Lấy danh sách userbonus
    const userbonus = await UserBonus.find({
      user_id: user.id,
      level: levelFilter,
      created: { $gte: startTimestamp, $lte: endTimestamp }
    })
      .select('referrer_id created level bonus action status')
      .lean()

    if (userbonus.length === 0) {
      return res.json({ totalPending: 0, totalReceived: 0, data: [] })
    }

    // Lấy tất cả referrer_id và action (code của Bet)
    const referrerIds = [...new Set(userbonus.map(bonus => bonus.referrer_id))]
    const betCodes = [...new Set(userbonus.map(bonus => bonus.action))]

    // Truy vấn users và bets một lần
    const users = await User.find({ id: { $in: referrerIds } })
      .select('id username')
      .lean()
    const bets = await Bet.find({ code: { $in: betCodes } })
      .select('code amount')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))
    const betMap = new Map(bets.map(bet => [bet.code, bet.amount]))

    const datajson = userbonus.map(bonus => ({
      user: userMap.get(bonus.referrer_id) || 'Unknown',
      date: bonus.created,
      level: bonus.level,
      amount: betMap.get(bonus.action) || 0,
      bonus: bonus.bonus,
      trangthai: bonus.status
    }))

    const totalReceived = datajson.reduce((sum, item) => {
      if (type === 'f1' && item.trangthai === 2) {
        return sum + item.bonus
      }
      if (type === 'f2f3' && item.trangthai === 2) {
        return sum + item.bonus
      }
      return sum
    }, 0)

    const totalPending = datajson.reduce((sum, item) => {
      return item.trangthai === 0 ? sum + item.bonus : sum
    }, 0)

    return res.json({
      totalPending,
      totalReceived,
      data: datajson
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Lỗi server' })
  }
})

router.get('/getbonusbyusername/:userid', async (req, res) => {
  try {
    const { userid } = req.params
    const { username, type } = req.query

    const user = await User.findById(userid).lean()
    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' })
    }
    const referrers = await User.find({
      username: { $regex: username, $options: 'i' }
    })
      .select('id username')
      .lean()

    if (!referrers.length) {
      return res
        .status(404)
        .json({ message: 'Không tìm thấy người giới thiệu phù hợp' })
    }

    const referrerIds1 = referrers.map(u => u.id)

    const levelFilter =
      type === 'f1' ? 1 : type === 'f2f3' ? { $in: [2, 3] } : null
    if (!levelFilter) {
      return res.status(400).json({ message: 'Type không hợp lệ' })
    }

    const userbonus = await UserBonus.find({
      user_id: user.id,
      level: levelFilter,
      referrer_id: {
        $in: referrerIds1
      }
    })
      .select('referrer_id created level bonus action status')
      .lean()

    if (userbonus.length === 0) {
      return res.json({ totalPending: 0, totalReceived: 0, data: [] })
    }

    const referrerIds = [...new Set(userbonus.map(bonus => bonus.referrer_id))]
    const betCodes = [...new Set(userbonus.map(bonus => bonus.action))]

    const users = await User.find({ id: { $in: referrerIds } })
      .select('id username')
      .lean()
    const bets = await Bet.find({ code: { $in: betCodes } })
      .select('code amount')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))
    const betMap = new Map(bets.map(bet => [bet.code, bet.amount]))

    const datajson = userbonus.map(bonus => ({
      user: userMap.get(bonus.referrer_id) || 'Unknown',
      date: bonus.created,
      level: bonus.level,
      amount: betMap.get(bonus.action) || 0,
      bonus: bonus.bonus,
      trangthai: bonus.status
    }))

    const totalReceived = datajson.reduce((sum, item) => {
      if (type === 'f1' && item.trangthai === 2) {
        return sum + item.bonus
      }
      if (type === 'f2f3' && item.trangthai === 2) {
        return sum + item.bonus
      }
      return sum
    }, 0)

    const totalPending = datajson.reduce((sum, item) => {
      return item.trangthai === 0 ? sum + item.bonus : sum
    }, 0)

    return res.json({
      totalPending,
      totalReceived,
      data: datajson
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Lỗi server' })
  }
})

router.get('/getbangxephang/:userid', async (req, res) => {
  try {
    const userid = parseInt(req.params.userid)

    // Step 1: Aggregate user bonus ranking
    const ranking = await UserBonus.aggregate([
      {
        $group: {
          _id: '$user_id',
          totalBonus: { $sum: '$bonus' }
        }
      },
      { $sort: { totalBonus: -1 } }
    ])

    // Step 2: Map user ID to rank
    const userIdsNeeded = new Set()
    const top10Raw = ranking.slice(0, 9)
    top10Raw.forEach(item => userIdsNeeded.add(item._id))
    userIdsNeeded.add(userid)

    const users = await User.find({ id: { $in: [...userIdsNeeded] } })
      .select('id username')
      .lean()

    const userMap = new Map(users.map(u => [u.id, u.username]))

    const top10 = top10Raw.map((item, index) => ({
      rank: index + 1,
      userid: item._id,
      username: userMap.get(item._id) || 'Unknown',
      totalBonus: item.totalBonus
    }))

    const userIndex = ranking.findIndex(item => item._id === userid)

    const userRank =
      userIndex !== -1
        ? {
            rank: userIndex + 1,
            userid,
            username: userMap.get(userid) || 'Bạn',
            totalBonus: ranking[userIndex].totalBonus
          }
        : {
            rank: ranking.length + 1,
            userid,
            username: userMap.get(userid) || 'Bạn',
            totalBonus: 0
          }

    return res.json({
      top10,
      yourRank: userRank
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Lỗi server' })
  }
})

module.exports = router
