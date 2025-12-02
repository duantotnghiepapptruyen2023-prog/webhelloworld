const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const TranDau = require('../models/TranDauModel')
const SoccerBet = require('../models/SoccerBetModel')
const axios = require('axios')
const upload = require('./upload')
const Bet = require('../models/BetModel')
const User = require('../models/UserModel')
const UserCoinlog = require('../models/CoinLogModel')
const crypto = require('crypto')
const {
  betUpdateAction,
  bonusUpdateAction,
  updateBetWindephong,
  updateBetFailedDephong
} = require('./TuDongTraThuong')

const handelformatdate = itemdate => {
  const date = new Date(itemdate * 1000)

  const day = String(date.getDate()).padStart(2, '0') // ngày
  const month = String(date.getMonth() + 1).padStart(2, '0') // tháng (0-11 → +1)
  const year = date.getFullYear() // năm

  const formattedStarted = `${day}/${month}/${year} `
  return formattedStarted
}

const handelformathour = itemdate => {
  const date = new Date(itemdate * 1000)

  const hours = String(date.getHours()).padStart(2, '0') // giờ
  const minutes = String(date.getMinutes()).padStart(2, '0') // phút

  const formattedStarted = `${hours}:${minutes}`
  return formattedStarted
}

const handelloinhuan = (muccuoc, profit) => {
  const loinhuan = (muccuoc * profit) / 100
  const loinhuanrong = loinhuan - loinhuan * 0.05
  return loinhuanrong
}

const gameQueue = []
let isProcessing = false

async function processGameQueue () {
  if (isProcessing || gameQueue.length === 0) return

  isProcessing = true
  const currentGames = [...gameQueue]
  gameQueue.length = 0

  const BATCH_SIZE = 5

  try {
    for (let i = 0; i < currentGames.length; i += BATCH_SIZE) {
      const batch = currentGames.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(async gameId => {
          try {
            await betUpdateAction(gameId)
            await bonusUpdateAction()
          } catch (err) {
            console.error('Lỗi xử lý game:', gameId, err)
          }
        })
      )
    }
  } catch (err) {
    console.error('Lỗi xử lý Promise.all:', err)
  }

  isProcessing = false

  if (gameQueue.length > 0) {
    processGameQueue()
  }
}

function enqueueGame (gameId) {
  if (!gameQueue.includes(gameId)) {
    gameQueue.push(gameId)
    processGameQueue()
  }
}

router.post('/traketqua', async (req, res) => {
  try {
    const { code } = req.body
    const bet = await Bet.findOne({ code: code })
    console.log(bet)
    if (!bet) return res.status(404).json({ message: 'Không tìm thấy cược' })
    await updateBetWindephong(bet._id)
    await bonusUpdateAction()
    res.json({ message: 'Thành công' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

router.post('/traketquathua', async (req, res) => {
  try {
    const { code } = req.body
    const bet = await Bet.findOne({ code: code })
    if (!bet) return res.status(404).json({ message: 'Không tìm thấy cược' })
    await updateBetFailedDephong(bet._id)
    res.json({ message: 'Thành công' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

router.post('/import-matches', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../backup/app_soccer.json')
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const matches =
      jsonData.find(item => item.type === 'table' && item.name === 'app_soccer')
        ?.data || []

    const formattedMatches = matches.map(match => ({
      id: parseInt(match.id, 10),
      gameId: parseInt(match.gameId, 10) || null,
      started: parseInt(match.started, 10) || null,
      leagueName: match.leagueName || null,
      homeTeam: match.homeTeam || null,
      awayTeam: match.awayTeam || null,
      tradeVolume: parseInt(match.tradeVolume, 10) || null,
      homeIcon: match.homeIcon || null,
      awayIcon: match.awayIcon || null,
      is_home: parseInt(match.is_home, 10) || 0,
      is_hot: parseInt(match.is_hot, 10) || 0,
      resultH: match.resultH !== null ? parseInt(match.resultH, 10) : null,
      resultC: match.resultC !== null ? parseInt(match.resultC, 10) : null,
      resultUpH:
        match.resultUpH !== null ? parseInt(match.resultUpH, 10) : null,
      resultUpC:
        match.resultUpC !== null ? parseInt(match.resultUpC, 10) : null,
      resultUpdate: parseInt(match.resultUpdate, 10) || 0,
      message: match.message || null,
      created: parseInt(match.created, 10) || null,
      updated: parseInt(match.updated, 10) || null,
      status: parseInt(match.status, 10) || 1
    }))

    await TranDau.insertMany(formattedMatches)

    res.status(201).json({
      message: 'Dữ liệu trận đấu đã được nhập vào database thành công!',
      matches: formattedMatches
    })
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/clearsoccer', async (req, res) => {
  try {
    await TranDau.deleteMany({})
    res.json({ success: true, message: 'Đã xóa toàn bộ trận đấu' })
  } catch (error) {
    console.error('Lỗi khi xóa trận đấu:', error)
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
})

router.get('/getmatches', async (req, res) => {
  try {
    const { date } = req.query

    if (!date) {
      return res
        .status(400)
        .json({ message: 'Vui lòng cung cấp ngày (YYYY-MM-DD)' })
    }

    const startOfDay = Math.floor(
      new Date(new Date(date).setHours(0, 0, 0, 0)).getTime() / 1000
    )
    const endOfDay = Math.floor(
      new Date(new Date(date).setHours(23, 59, 59, 999)).getTime() / 1000
    )

    const now = Math.floor(Date.now() / 1000)
    const matches = await TranDau.find({
      $and: [
        { started: { $gte: startOfDay, $lte: endOfDay } },
        { started: { $gt: now } }
      ],
      status: 1
    }).sort({ started: 1 })

    const trandaujson = await Promise.all(
      matches.map(async item => {
        const soccerbets = await SoccerBet.find({
          gameId: item.gameId,
          type: { $in: ['1_1', '2_1'] }
        }).lean()
        const betdata = soccerbets.map(bet => {
          const firstThree = bet.data.slice(0, 3)

          const betthree = firstThree.map(d => ({
            name: d.keo,
            value: d.profit,
            locked: d.locked || false
          }))

          return {
            id: bet.id,
            type: bet.type,
            data: betthree
          }
        })

        return {
          _id: item._id,
          id: item.id,
          gameId: item.gameId,
          leagueName: item.leagueName,
          homeTeam: item.homeTeam,
          awayTeam: item.awayTeam,
          homeIcon: item.homeIcon,
          awayIcon: item.awayIcon,
          started: item.started,
          bet: betdata
        }
      })
    )

    res.json(trandaujson)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error })
  }
})

router.get('/randomtran', async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000)

    const trandau = await TranDau.find({
      status: 1,
      started: { $gt: now }
    })
      .sort({ started: 1 })
      .limit(5)

    const trandaujson = await Promise.all(
      trandau.map(async item => {
        const soccerbets = await SoccerBet.find({
          gameId: item.gameId,
          type: { $in: ['1_1', '2_1'] }
        }).lean()
        const betdata = soccerbets.map(bet => {
          const firstThree = bet.data.slice(0, 3)

          const betthree = firstThree.map(d => ({
            name: d.keo,
            value: d.profit,
            locked: d.locked || false
          }))

          return {
            id: bet.id,
            type: bet.type,
            data: betthree
          }
        })

        return {
          _id: item._id,
          id: item.id,
          gameId: item.gameId,
          leagueName: item.leagueName,
          homeTeam: item.homeTeam,
          awayTeam: item.awayTeam,
          homeIcon: item.homeIcon,
          awayIcon: item.awayIcon,
          started: handelformatdate(item.started),
          hour: handelformathour(item.started),
          bet: betdata
        }
      })
    )

    res.json(trandaujson)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server khi lấy trận đấu' })
  }
})

router.get('/chitiettran/:gameId', async (req, res) => {
  try {
    const gameId = req.params.gameId
    const trandau = await TranDau.findOne({ gameId })
    res.json(trandau)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error })
  }
})

router.get('/proxy', async (req, res) => {
  const imageUrl = req.query.url
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' })
    res.set('Content-Type', 'image/jpeg')
    res.send(response.data)
  } catch (error) {
    res.end()
  }
})

router.delete('/deletetran', async (req, res) => {
  try {
    await TranDau.deleteMany({})
    res.json({ message: 'Đã xóa toàn bộ dữ liệu trong collection trandau' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})

router.post('/posttyso/:idtrandau', async (req, res) => {
  try {
    const idtrandau = req.params.idtrandau
    const { resultH, resultC, resultUpH, resultUpC } = req.body
    const createdcoin = Math.floor(Date.now() / 1000)

    const trandau = await TranDau.findOne({ id: idtrandau })
    if (!trandau)
      return res.status(404).json({ message: 'Không tìm thấy trận đấu' })

    let message = []

    let shouldRunUpdate = false

    if (resultUpH !== undefined && resultUpC !== undefined) {
      trandau.resultUpH = resultUpH
      trandau.resultUpC = resultUpC
      trandau.updated = createdcoin
      message.push('Đã cập nhật tỷ số HT và trả kèo HT')
      shouldRunUpdate = true
    }

    if (resultH !== '' && resultC !== '') {
      trandau.resultH = resultH
      trandau.resultC = resultC
      trandau.resultUpdate = 1
      trandau.status = 2
      trandau.updated = createdcoin
      message.push('Đã cập nhật tỷ số FT và trả toàn bộ kèo còn lại')
      shouldRunUpdate = true
    }

    await trandau.save()

    if (shouldRunUpdate) {
      enqueueGame(trandau.gameId)
    }

    return res.json({ message: message.join(' - '), trandau })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})

router.get('/gettyso/:idtrandau', async (req, res) => {
  try {
    const idtrandau = req.params.idtrandau
    const trandau = await TranDau.findOne({ id: idtrandau })
    const tysojson = {
      resultH: trandau.resultH,
      resultC: trandau.resultC,
      resultUpH: trandau.resultUpH,
      resultUpC: trandau.resultUpC
    }
    res.json(tysojson)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})

// router.post('/posttyso/:idtrandau', async (req, res) => {
//   try {
//     const idtrandau = req.params.idtrandau
//     const { resultH, resultC, resultUpH, resultUpC } = req.body
//     const trandau = await TranDau.findOne({ id: idtrandau })
//     trandau.resultUpdate = 1
//     trandau.status = 2
//     trandau.resultH = resultH
//     trandau.resultC = resultC
//     trandau.resultUpH = resultUpH
//     trandau.resultUpC = resultUpC
//     trandau.updated = Math.floor(Date.now() / 1000)
//     await trandau.save()

//     enqueueGame(trandau.gameId)

//     res.json(trandau)
//   } catch (error) {
//     console.error(error)
//     res.status(500).json({ message: error.message })
//   }
// })

router.post('/posttyso2', async (req, res) => {
  try {
    const { gameid } = req.body

    await enqueueGame(parseInt(gameid))

    res.json({ message: 'thành công' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})

router.get('/getfulltrandautheodate', async (req, res) => {
  try {
    const { date } = req.query
    if (!date) {
      return res.status(400).json({ message: 'Vui lòng cung cấp ngày' })
    }

    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const startTimestamp = Math.floor(startOfDay.getTime() / 1000)
    const endTimestamp = Math.floor(endOfDay.getTime() / 1000)

    const trandau = await TranDau.find({
      started: { $gte: startTimestamp, $lte: endTimestamp }
    })

    res.json(trandau)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

router.get('/getfulltran', async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1
    let limit = 20
    let skip = (page - 1) * limit

    let now = Math.floor(Date.now() / 1000)

    const totalMatches = await TranDau.countDocuments()
    const totalPages = Math.ceil(totalMatches / limit)

    const trandau = await TranDau.aggregate([
      { $match: { status: 1 } },
      {
        $addFields: {
          diff: { $abs: { $subtract: ['$started', now] } }
        }
      },
      { $sort: { diff: 1 } },
      { $skip: skip },
      { $limit: limit }
    ])

    res.json({
      currentPage: page,
      totalPages: totalPages,
      totalMatches: totalMatches,
      matchesPerPage: limit,
      matches: trandau
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

router.get('/gettranchoduyet', async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1
    let limit = 20
    let skip = (page - 1) * limit
    let now = Math.floor(Date.now() / 1000)

    let matches = await TranDau.find({
      status: 0,
      started: { $gt: now }
    }).sort({ started: 1 })

    let filteredMatches = []
    for (let match of matches) {
      let betCount = await SoccerBet.countDocuments({ gameId: match.gameId })
      if (betCount > 0) {
        filteredMatches.push(match)
      }
    }

    const totalMatches = filteredMatches.length
    const totalPages = Math.ceil(totalMatches / limit)

    const paginatedMatches = filteredMatches.slice(skip, skip + limit)

    res.json({
      currentPage: page,
      totalPages: totalPages,
      totalMatches: totalMatches,
      matchesPerPage: limit,
      matches: paginatedMatches
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

router.post('/searchtranchoduyet', async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1
    let limit = 20
    let skip = (page - 1) * limit
    let now = Math.floor(Date.now() / 1000)
    let { search } = req.body

    let query = {
      status: 0,
      started: { $gt: now }
    }

    if (search && typeof search === 'string') {
      query.$or = [
        { homeTeam: { $regex: search, $options: 'i' } },
        { awayTeam: { $regex: search, $options: 'i' } },
        { leagueName: { $regex: search, $options: 'i' } },
        { gameId: !isNaN(search) ? Number(search) : null }
      ]
    }

    let matches = await TranDau.find(query).sort({ started: 1 }).lean()

    let filteredMatches = []
    for (let match of matches) {
      let betCount = await SoccerBet.countDocuments({ gameId: match.gameId })
      if (betCount > 0) {
        filteredMatches.push(match)
      }
    }

    const totalMatches = filteredMatches.length
    const totalPages = Math.ceil(totalMatches / limit)

    const paginatedMatches = filteredMatches.slice(skip, skip + limit)

    res.json({
      currentPage: page,
      totalPages: totalPages,
      totalMatches: totalMatches,
      matchesPerPage: limit,
      matches: paginatedMatches
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

router.get('/gettranchuakeo', async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1
    let limit = 20
    let skip = (page - 1) * limit
    let now = Math.floor(Date.now() / 1000)

    let matches = await TranDau.find({
      status: 0,
      started: { $gt: now }
    }).sort({ started: 1 })

    let filteredMatches = []
    for (let match of matches) {
      let betCount = await SoccerBet.countDocuments({ gameId: match.gameId })
      if (betCount >= 0) {
        filteredMatches.push(match)
      }
    }

    const totalMatches = filteredMatches.length
    const totalPages = Math.ceil(totalMatches / limit)

    const paginatedMatches = filteredMatches.slice(skip, skip + limit)

    res.json({
      currentPage: page,
      totalPages: totalPages,
      totalMatches: totalMatches,
      matchesPerPage: limit,
      matches: paginatedMatches
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

router.post('/searchtranchuakeo', async (req, res) => {
  try {
    let page = parseInt(req.query.page) || 1
    let limit = 20
    let skip = (page - 1) * limit
    let now = Math.floor(Date.now() / 1000)
    let { search } = req.body

    let query = {
      status: 0,
      started: { $gt: now }
    }

    if (search && typeof search === 'string') {
      query.$or = [
        { homeTeam: { $regex: search, $options: 'i' } },
        { awayTeam: { $regex: search, $options: 'i' } },
        { leagueName: { $regex: search, $options: 'i' } }
      ]

      if (!isNaN(search)) {
        query.$or.push({ gameId: Number(search) })
      }
    }

    let matches = await TranDau.find(query).sort({ started: 1 }).lean()

    let gameIds = matches.map(match => match.gameId)

    let betCounts = await SoccerBet.aggregate([
      { $match: { gameId: { $in: gameIds } } },
      { $group: { _id: '$gameId', count: { $sum: 1 } } }
    ])

    let betMap = {}
    betCounts.forEach(bet => {
      betMap[bet._id] = bet.count
    })

    let filteredMatches = matches.filter(
      match => (betMap[match.gameId] || 0) >= 0
    )

    const totalMatches = filteredMatches.length
    const totalPages = Math.ceil(totalMatches / limit)

    const paginatedMatches = filteredMatches.slice(skip, skip + limit)

    res.json({
      currentPage: page,
      totalPages: totalPages,
      totalMatches: totalMatches,
      matchesPerPage: limit,
      matches: paginatedMatches
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

router.post('/duyettrandau', async (req, res) => {
  try {
    const { ids } = req.body
    const trandau = await TranDau.find({ _id: { $in: ids } })
    if (trandau.length <= 0) {
      return res.status(400).json({ message: 'Trận đấu không tồn tại' })
    }
    for (let match of trandau) {
      match.status = 1
      await match.save()
    }
    res.json({ message: 'Duyệt trận đấu thành công' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi server' })
  }
})

router.post(
  '/posttrandau',
  upload.fields([
    { name: 'homeIcon', maxCount: 1 },
    { name: 'awayIcon', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        leagueName,
        homeTeam,
        awayTeam,
        datedau,
        hourdau,
        baotoan,
        keo,
        tyso
      } = req.body
      const uploadDir = path.join(__dirname, '../uploads')

      const homeFileName = `${homeTeam.replace(/\s+/g, '_')}.png`
      const awayFileName = `${awayTeam.replace(/\s+/g, '_')}.png`

      const homeFilePath = path.join(uploadDir, homeFileName)
      const awayFilePath = path.join(uploadDir, awayFileName)

      let homeIcon = null
      let awayIcon = null

      if (fs.existsSync(homeFilePath)) {
        homeIcon = `${homeFileName}`
      } else if (req.files['homeIcon']) {
        fs.renameSync(req.files['homeIcon'][0].path, homeFilePath)
        homeIcon = `${homeFileName}`
      }

      if (fs.existsSync(awayFilePath)) {
        awayIcon = `${awayFileName}`
      } else if (req.files['awayIcon']) {
        fs.renameSync(req.files['awayIcon'][0].path, awayFilePath)
        awayIcon = `${awayFileName}`
      }

      const datetimeString = `${datedau} ${hourdau}`
      const started = Math.floor(new Date(datetimeString).getTime() / 1000)
      const created = Math.floor(Date.now() / 1000)

      const lastMatch = await TranDau.findOne().sort({ id: -1 })
      const newId = lastMatch ? lastMatch.id + 1 : 1000

      const trandau = new TranDau({
        id: newId,
        gameId: newId,
        leagueName,
        homeTeam,
        awayTeam,
        homeIcon,
        awayIcon,
        started,
        created,
        updated: created,
        baotoan
      })
      if (baotoan === 'true') {
        trandau.baotoanvon.keo = keo
        trandau.baotoanvon.tyso = tyso
      }
      console.log(hourdau)
      await trandau.save()
      res.json(trandau)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Lỗi server' })
    }
  }
)

router.post('/huytrandau/:idtrandau', async (req, res) => {
  try {
    const idtrandau = req.params.idtrandau
    const trandau = await TranDau.findById(idtrandau)
    if (!trandau) {
      return res.status(404).json({ error: 'Trận đấu không tồn tại' })
    }

    const bets = await Bet.find({
      gameId: trandau.gameId,
      status: { $gt: 0 },
      result: 0
    })

    if (bets.length > 0) {
      const userIds = bets.map(bet => bet.user_id)
      const users = await User.find({ id: { $in: userIds } })
      const userMap = new Map(users.map(user => [user.id, user]))

      const createdcoin = Math.floor(Date.now() / 1000)

      for (const bet of bets) {
        const user = userMap.get(bet.user_id)
        if (!user) continue

        const hashString = `${bet.user_id}${Date.now()}${bet.amount}`
        const hash = crypto.createHash('md5').update(hashString).digest('hex')
        const lastcoin = await UserCoinlog.findOne().sort({ id: -1 })
        const newcoinId = lastcoin ? lastcoin.id + 1 : 1

        const usercoinlog = new UserCoinlog({
          id: newcoinId,
          user_id: user.id,
          amount: bet.amount,
          reason: `Hoàn tiền hủy trận đấu ${trandau.gameId} mã ${bet.code}`,
          previous: user.coins,
          check: hash,
          created: createdcoin,
          updated: createdcoin
        })

        await usercoinlog.save()

        user.coins += bet.amount
        await user.save()

        bet.status = -1
        bet.updated = createdcoin
        await bet.save()
      }
    }

    trandau.resultUpdate = -1
    trandau.status = -2
    await trandau.save()

    res.json({ message: 'Hủy trận đấu thành công và đã hoàn tiền' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getGameActive', async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query
    const TIME_NOW = Math.floor(Date.now() / 1000)
    const TIME_OFFSET = 50 * 60

    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    let query = { status: { $gt: 0 } }

    switch (type) {
      case 'running':
        query.started = { $gt: TIME_NOW - TIME_OFFSET, $lte: TIME_NOW }
        break
      case 'upcoming':
        query.started = { $gt: TIME_NOW }
        break
      case 'pending-result':
        query.started = { $lt: TIME_NOW - TIME_OFFSET }
        query.resultUpdate = 0
        break
      case 'ended':
        query.started = { $lt: TIME_NOW - TIME_OFFSET }
        query.resultUpdate = { $gt: 0 }
        query.status = 2
        break
    }

    const totalGames = await TranDau.countDocuments(query)

    const games = await TranDau.find(query)
      .sort({ id: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    res.json({
      currentPage: pageNum,
      totalPages: Math.ceil(totalGames / limitNum),
      totalGames,
      games
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/cleartranchokq', async (req, res) => {
  try {
    const TIME_NOW = Math.floor(Date.now() / 1000)
    const TIME_OFFSET = 120 * 60
    const trandau = await TranDau.find({
      status: { $gt: 0 },
      started: { $lt: TIME_NOW - TIME_OFFSET },
      resultUpdate: 0
    })
    if (trandau.length > 0) {
      for (let i = 0; i < trandau.length; i++) {
        trandau[i].status = -1
        await trandau[i].save()
      }
    }
    res.json({ message: 'Đã xóa toàn bộ trận đấu' })
  } catch (error) {
    console.error('Lỗi khi xóa trận đấu:', error)
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
})

router.get('/getGameActiveexcel', async (req, res) => {
  try {
    const TIME_NOW = Math.floor(Date.now() / 1000)
    const TIME_OFFSET = 120 * 60
    const { type } = req.query
    let query = { status: { $gt: 0 } }

    switch (type) {
      case 'running':
        query.started = { $gt: TIME_NOW - TIME_OFFSET, $lte: TIME_NOW }
        break
      case 'upcoming':
        query.started = { $gt: TIME_NOW }
        break
      case 'pending-result':
        query.started = { $lt: TIME_NOW - TIME_OFFSET }
        query.resultUpdate = 0
        break
      case 'ended':
        query.started = { $lt: TIME_NOW - TIME_OFFSET }
        query.resultUpdate = { $gt: 0 }
        query.status = 2
        break
    }

    const games = await TranDau.find(query).sort({ id: -1 }).lean()

    res.json(games)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/searchGameActive', async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query
    const { search } = req.body
    const TIME_NOW = Math.floor(Date.now() / 1000)
    const TIME_OFFSET = 120 * 60

    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    let query = { status: { $gt: 0 } }

    switch (type) {
      case 'running':
        query.started = { $gt: TIME_NOW - TIME_OFFSET, $lte: TIME_NOW }
        break
      case 'upcoming':
        query.started = { $gt: TIME_NOW }
        break
      case 'pending-result':
        query.started = { $lt: TIME_NOW - TIME_OFFSET }
        query.resultUpdate = 0
        break
      case 'ended':
        query.started = { $lt: TIME_NOW - TIME_OFFSET }
        query.resultUpdate = { $gt: 0 }
        query.status = 2

        break
    }

    if (search && typeof search === 'string') {
      query.$or = [
        { homeTeam: { $regex: search, $options: 'i' } },
        { awayTeam: { $regex: search, $options: 'i' } },
        { leagueName: { $regex: search, $options: 'i' } }
      ]
      if (!isNaN(search)) {
        query.$or.push({ gameId: Number(search) })
      }
    }

    const totalGames = await TranDau.countDocuments(query)

    const games = await TranDau.find(query)
      .sort({ id: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    res.json({
      currentPage: pageNum,
      totalPages: Math.ceil(totalGames / limitNum),
      totalGames,
      games
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/gethuyxoatran', async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query

    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    let query = {}

    if (type === 'huytran') {
      query = { resultUpdate: -1, status: -2 }
    } else if (type === 'xoatran') {
      query = { resultUpdate: 0, status: -1 }
    } else {
      return res.status(400).json({ error: 'Loại truy vấn không hợp lệ' })
    }

    const totalGames = await TranDau.countDocuments(query)

    const games = await TranDau.find(query)
      .sort({ started: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    res.json({
      currentPage: pageNum,
      totalPages: Math.ceil(totalGames / limitNum),
      totalGames,
      games
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/gethuyxoatranexcel', async (req, res) => {
  try {
    const { type } = req.query

    let query = {}

    if (type === 'huytran') {
      query = { resultUpdate: -1, status: -2 }
    } else if (type === 'xoatran') {
      query = { resultUpdate: 0, status: -1 }
    } else {
      return res.status(400).json({ error: 'Loại truy vấn không hợp lệ' })
    }

    const games = await TranDau.find(query).sort({ started: -1 }).lean()

    res.json(games)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/searchhuyxoatran', async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query
    const { search } = req.body

    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    let query = {}

    if (type === 'huytran') {
      query = { resultUpdate: -1, status: -2 }
    } else if (type === 'xoatran') {
      query = { resultUpdate: 0, status: -1 }
    } else {
      return res.status(400).json({ error: 'Loại truy vấn không hợp lệ' })
    }

    if (search && typeof search === 'string') {
      query.$or = [
        { homeTeam: { $regex: search, $options: 'i' } },
        { awayTeam: { $regex: search, $options: 'i' } },
        { leagueName: { $regex: search, $options: 'i' } }
      ]
      if (!isNaN(search)) {
        query.$or.push({ gameId: Number(search) })
      }
    }

    const totalGames = await TranDau.countDocuments(query)

    const games = await TranDau.find(query)
      .sort({ started: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    res.json({
      currentPage: pageNum,
      totalPages: Math.ceil(totalGames / limitNum),
      totalGames,
      games
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/xoatrandau/:idtrandau', async (req, res) => {
  try {
    const idtrandau = req.params.idtrandau
    const trandau = await TranDau.findById(idtrandau)

    if (!trandau) {
      return res.status(404).json({ error: 'Trận đấu không tồn tại' })
    }

    trandau.status = -1
    await trandau.save()

    res.json({ message: 'Xóa trận đấu thành công' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/khoiphuctran/:idtran', async (req, res) => {
  try {
    const idtran = req.params.idtran
    const trandau = await TranDau.findById(idtran)
    if (!trandau) {
      return res.status(404).json({ error: 'Trận đấu không tồn tại' })
    }
    trandau.resultUpdate = 0
    trandau.status = 1
    await trandau.save()
    res.json({ message: 'khôi phục trận đấu thành công' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

const tabNames = [
  { id: '1_1', name: 'FT Tỷ số', type: 'FT' },
  { id: '1_2', name: 'FT Chẵn lẻ', type: 'FT' },
  { id: '1_3', name: 'FT Thắng Hòa Thua', type: 'FT' },
  { id: '2_1', name: 'HT Tỷ số', type: 'HT' },
  { id: '2_3', name: 'HT Thắng Hòa Thua', type: 'HT' },
  { id: '3_1', name: 'H2T Tỷ số', type: 'H2T' }
]

const generateKeo = betType => {
  return tabNames.find(tab => tab.id === betType) || null
}

router.get('/getkqthang', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const total = await Bet.countDocuments({ result: 1, status: 1 })

    const bets = await Bet.find({ result: 1, status: 1 })
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .select(
        'code user_id gameId betType gameKey amount profit created updated'
      )
      .lean()

    if (bets.length === 0) {
      return res.json({
        data: [],
        currentPage: page,
        totalPages: 0,
        totalRecords: total
      })
    }

    const userIds = [...new Set(bets.map(b => b.user_id))]
    const gameIds = [...new Set(bets.map(b => b.gameId))]

    const users = await User.find({ id: { $in: userIds } })
      .select('id username')
      .lean()
    const games = await TranDau.find({ gameId: { $in: gameIds } })
      .select('gameId homeTeam awayTeam')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))
    const gameMap = new Map(
      games.map(game => [game.gameId, `${game.homeTeam} vs ${game.awayTeam}`])
    )

    const betjson = bets.map(b => ({
      code: b.code,
      user: userMap.get(b.user_id) || 'Unknown',
      trandau: gameMap.get(b.gameId) || 'Unknown',
      keo: generateKeo(b.betType).name,
      game: b.gameKey,
      muccuoc: b.amount,
      profit: b.profit,
      loinhuanrong: handelloinhuan(b.amount, b.profit),
      created: b.created,
      updated: b.updated
    }))

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getkqthangexcel2', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10000
    const skip = (page - 1) * limit

    const total = await Bet.countDocuments({ result: 1, status: 1 })

    const bets = await Bet.find({ result: 1, status: 1 })
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .select(
        'code user_id gameId betType gameKey amount profit created updated'
      )
      .lean()

    if (bets.length === 0) {
      return res.json({
        data: [],
        currentPage: page,
        totalPages: 0,
        totalRecords: total
      })
    }

    const userIds = [...new Set(bets.map(b => b.user_id))]
    const gameIds = [...new Set(bets.map(b => b.gameId))]

    const users = await User.find({ id: { $in: userIds } })
      .select('id username')
      .lean()
    const games = await TranDau.find({ gameId: { $in: gameIds } })
      .select('gameId homeTeam awayTeam')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))
    const gameMap = new Map(
      games.map(game => [game.gameId, `${game.homeTeam} vs ${game.awayTeam}`])
    )

    const betjson = bets.map(b => ({
      code: b.code,
      user: userMap.get(b.user_id) || 'Unknown',
      trandau: gameMap.get(b.gameId) || 'Unknown',
      keo: generateKeo(b.betType).name,
      game: b.gameKey,
      muccuoc: b.amount,
      profit: b.profit,
      loinhuanrong: handelloinhuan(b.amount, b.profit),
      created: b.created,
      updated: b.updated
    }))

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getkqthangexcel', async (req, res) => {
  try {
    const bets = await Bet.find({ result: 1, status: 1 })

      .sort({ id: -1 })
      .select(
        'code user_id gameId betType gameKey amount profit created updated'
      )
      .lean()

    const userIds = [...new Set(bets.map(b => b.user_id))]
    const gameIds = [...new Set(bets.map(b => b.gameId))]

    const users = await User.find({ id: { $in: userIds } })
      .select('id username')
      .lean()
    const games = await TranDau.find({ gameId: { $in: gameIds } })
      .select('gameId homeTeam awayTeam')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))
    const gameMap = new Map(
      games.map(game => [game.gameId, `${game.homeTeam} vs ${game.awayTeam}`])
    )

    const betjson = bets.map(b => ({
      code: b.code,
      user: userMap.get(b.user_id) || 'Unknown',
      trandau: gameMap.get(b.gameId) || 'Unknown',
      keo: generateKeo(b.betType).name,
      game: b.gameKey,
      muccuoc: b.amount,
      profit: b.profit,
      loinhuanrong: handelloinhuan(b.amount, b.profit),
      created: b.created,
      updated: b.updated
    }))

    res.json(betjson)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/searchkqthang', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { search } = req.body || ''

    const query = { result: 1, status: 1 }

    if (search) {
      const searchRegex = new RegExp(search, 'i')

      const matchingUsers = await User.find({ username: searchRegex })
        .select('id')
        .lean()
      const userIds = matchingUsers.map(user => user.id)

      const matchingGames = await TranDau.find({
        $or: [
          { homeTeam: searchRegex },
          { awayTeam: searchRegex },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ['$homeTeam', ' vs ', '$awayTeam'] },
                regex: search,
                options: 'i'
              }
            }
          }
        ]
      })
        .select('gameId')
        .lean()
      const gameIds = matchingGames.map(game => game.gameId)

      query.$or = [{ code: searchRegex }]
      if (gameIds.length > 0) query.$or.push({ gameId: { $in: gameIds } })
      if (userIds.length > 0) query.$or.push({ user_id: { $in: userIds } })
    }

    const total = await Bet.countDocuments(query)

    const bets = await Bet.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .select(
        'code user_id gameId betType gameKey amount profit created updated'
      )
      .lean()

    if (bets.length === 0) {
      return res.json({
        data: [],
        currentPage: page,
        totalPages: 0,
        totalRecords: total
      })
    }

    const userIds = [...new Set(bets.map(b => b.user_id))]
    const gameIds = [...new Set(bets.map(b => b.gameId))]

    const users = await User.find({ id: { $in: userIds } })
      .select('id username')
      .lean()
    const games = await TranDau.find({ gameId: { $in: gameIds } })
      .select('gameId homeTeam awayTeam')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))
    const gameMap = new Map(
      games.map(game => [game.gameId, `${game.homeTeam} vs ${game.awayTeam}`])
    )

    const betjson = bets.map(b => ({
      code: b.code,
      user: userMap.get(b.user_id) || 'Unknown',
      trandau: gameMap.get(b.gameId) || 'Unknown',
      keo: generateKeo(b.betType).name,
      game: b.gameKey,
      muccuoc: b.amount,
      profit: b.profit,
      loinhuanrong: handelloinhuan(b.amount, b.profit),
      created: b.created,
      updated: b.updated
    }))

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/searchkqthangtheodate', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { startDate, endDate } = req.query || ''

    let query = { result: 1, status: 1 }

    const startTimestamp = startDate
      ? Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000)
      : null
    const endTimestamp = endDate
      ? Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000)
      : null

    if (startTimestamp && endTimestamp) {
      query.created = { $gte: startTimestamp, $lte: endTimestamp }
    } else if (startTimestamp) {
      query.created = { $gte: startTimestamp }
    } else if (endTimestamp) {
      query.created = { $lte: endTimestamp }
    }

    const total = await Bet.countDocuments(query)

    const bet = await Bet.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .lean()

    const betjson = await Promise.all(
      bet.map(async b => {
        const user = await User.findOne({ id: b.user_id }).lean()
        const game = await TranDau.findOne({ gameId: b.gameId }).lean()
        return {
          code: b.code,
          user: user?.username || 'Unknown',
          trandau: game ? `${game.homeTeam} vs ${game.awayTeam}` : 'Unknown',
          keo: generateKeo(b.betType).name,
          game: b.gameKey,
          muccuoc: b.amount,
          profit: b.profit,
          loinhuanrong: handelloinhuan(b.amount, b.profit),
          created: b.created,
          updated: b.updated
        }
      })
    )

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getchoxuly', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const total = await Bet.countDocuments({ result: 0, status: 1 })

    const bets = await Bet.find({ result: 0, status: 1 })
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .select(
        'code user_id gameId betType gameKey amount profit created updated'
      )
      .lean()

    if (bets.length === 0) {
      return res.json({
        data: [],
        currentPage: page,
        totalPages: 0,
        totalRecords: total
      })
    }

    const userIds = [...new Set(bets.map(b => b.user_id))]
    const gameIds = [...new Set(bets.map(b => b.gameId))]

    const users = await User.find({ id: { $in: userIds } })
      .select('id username')
      .lean()
    const games = await TranDau.find({ gameId: { $in: gameIds } })
      .select('gameId homeTeam awayTeam')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))
    const gameMap = new Map(
      games.map(game => [game.gameId, `${game.homeTeam} vs ${game.awayTeam}`])
    )

    const betjson = bets.map(b => ({
      code: b.code,
      user: userMap.get(b.user_id) || 'Unknown',
      trandau: gameMap.get(b.gameId) || 'Unknown',
      keo: generateKeo(b.betType).name,
      game: b.gameKey,
      muccuoc: b.amount,
      profit: b.profit,
      created: b.created,
      updated: b.updated
    }))

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getchoxulyexcel', async (req, res) => {
  try {
    const bets = await Bet.find({ result: 0, status: 1 })
      .sort({ id: -1 })
      .select(
        'code user_id gameId betType gameKey amount profit created updated'
      )
      .lean()

    const userIds = [...new Set(bets.map(b => b.user_id))]
    const gameIds = [...new Set(bets.map(b => b.gameId))]

    const users = await User.find({ id: { $in: userIds } })
      .select('id username')
      .lean()
    const games = await TranDau.find({ gameId: { $in: gameIds } })
      .select('gameId homeTeam awayTeam')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))
    const gameMap = new Map(
      games.map(game => [game.gameId, `${game.homeTeam} vs ${game.awayTeam}`])
    )

    const betjson = bets.map(b => ({
      code: b.code,
      user: userMap.get(b.user_id) || 'Unknown',
      trandau: gameMap.get(b.gameId) || 'Unknown',
      keo: generateKeo(b.betType).name,
      game: b.gameKey,
      muccuoc: b.amount,
      profit: b.profit,
      created: b.created,
      updated: b.updated
    }))

    res.json(betjson)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/searchkqchoxuly', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { search } = req.body || ''

    const query = { result: 0, status: 1 }

    if (search) {
      const searchRegex = new RegExp(search, 'i')

      const matchingUsers = await User.find({ username: searchRegex })
        .select('id')
        .lean()
      const userIds = matchingUsers.map(user => user.id)

      const matchingGames = await TranDau.find({
        $or: [
          { homeTeam: searchRegex },
          { awayTeam: searchRegex },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ['$homeTeam', ' vs ', '$awayTeam'] },
                regex: search,
                options: 'i'
              }
            }
          }
        ]
      })
        .select('gameId')
        .lean()
      const gameIds = matchingGames.map(game => game.gameId)

      query.$or = [{ code: searchRegex }]
      if (gameIds.length > 0) query.$or.push({ gameId: { $in: gameIds } })
      if (userIds.length > 0) query.$or.push({ user_id: { $in: userIds } })
    }

    const total = await Bet.countDocuments(query)

    const bets = await Bet.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .select(
        'code user_id gameId betType gameKey amount profit created updated'
      )
      .lean()

    if (bets.length === 0) {
      return res.json({
        data: [],
        currentPage: page,
        totalPages: 0,
        totalRecords: total
      })
    }

    const userIds = [...new Set(bets.map(b => b.user_id))]
    const gameIds = [...new Set(bets.map(b => b.gameId))]

    const users = await User.find({ id: { $in: userIds } })
      .select('id username')
      .lean()
    const games = await TranDau.find({ gameId: { $in: gameIds } })
      .select('gameId homeTeam awayTeam')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))
    const gameMap = new Map(
      games.map(game => [game.gameId, `${game.homeTeam} vs ${game.awayTeam}`])
    )

    const betjson = bets.map(b => ({
      code: b.code,
      user: userMap.get(b.user_id) || 'Unknown',
      trandau: gameMap.get(b.gameId) || 'Unknown',
      keo: generateKeo(b.betType).name,
      game: b.gameKey,
      muccuoc: b.amount,
      profit: b.profit,
      created: b.created,
      updated: b.updated
    }))

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getkqthua', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const total = await Bet.countDocuments({ result: -1, status: 1 })

    const bet = await Bet.find({ result: -1, status: 1 })
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .lean()

    const betjson = await Promise.all(
      bet.map(async b => {
        const user = await User.findOne({ id: b.user_id }).lean()
        const game = await TranDau.findOne({ gameId: b.gameId }).lean()
        return {
          code: b.code,
          user: user?.username || 'Unknown',
          trandau: game ? `${game.homeTeam} vs ${game.awayTeam}` : 'Unknown',
          keo: generateKeo(b.betType).name,
          game: b.gameKey,
          muccuoc: b.amount,
          profit: b.profit,
          created: b.created,
          updated: b.updated
        }
      })
    )

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getkqthuaexcel', async (req, res) => {
  try {
    const bet = await Bet.find({ result: -1, status: 1 })
      .sort({ id: -1 })
      .lean()

    const userIds = [...new Set(bet.map(b => b.user_id))]
    const gameIds = [...new Set(bet.map(b => b.gameId))]

    const [users, games] = await Promise.all([
      User.find({ id: { $in: userIds } }).lean(),
      TranDau.find({ gameId: { $in: gameIds } }).lean()
    ])

    const userMap = new Map(users.map(u => [u.id, u.username]))
    const gameMap = new Map(
      games.map(g => [g.gameId, `${g.homeTeam} vs ${g.awayTeam}`])
    )

    const betjson = bet.map(b => ({
      code: b.code,
      user: userMap.get(b.user_id) || 'Unknown',
      trandau: gameMap.get(b.gameId) || 'Unknown',
      keo: generateKeo(b.betType).name,
      game: b.gameKey,
      muccuoc: b.amount,
      profit: b.profit,
      created: b.created,
      updated: b.updated
    }))

    res.json(betjson)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/searchkqchoxulytheodate', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { startDate, endDate } = req.query || ''

    let query = { result: 0, status: 1 }

    const startTimestamp = startDate
      ? Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000)
      : null
    const endTimestamp = endDate
      ? Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000)
      : null

    if (startTimestamp && endTimestamp) {
      query.created = { $gte: startTimestamp, $lte: endTimestamp }
    } else if (startTimestamp) {
      query.created = { $gte: startTimestamp }
    } else if (endTimestamp) {
      query.created = { $lte: endTimestamp }
    }

    const total = await Bet.countDocuments(query)

    const bet = await Bet.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .lean()

    const betjson = await Promise.all(
      bet.map(async b => {
        const user = await User.findOne({ id: b.user_id }).lean()
        const game = await TranDau.findOne({ gameId: b.gameId }).lean()
        return {
          code: b.code,
          user: user?.username || 'Unknown',
          trandau: game ? `${game.homeTeam} vs ${game.awayTeam}` : 'Unknown',
          keo: generateKeo(b.betType).name,
          game: b.gameKey,
          muccuoc: b.amount,
          profit: b.profit,
          created: b.created,
          updated: b.updated
        }
      })
    )

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/searchkqthua', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { search } = req.body || ''

    let query = { result: -1, status: 1 }

    let gameIds = []
    let userIds = []

    if (search) {
      const matchingUsers = await User.find({
        username: new RegExp(search, 'i')
      })
        .select('id')
        .lean()
      if (matchingUsers.length > 0) {
        userIds = matchingUsers.map(user => user.id)
      }

      const matchingGames = await TranDau.find({
        $or: [
          { homeTeam: new RegExp(search, 'i') },
          { awayTeam: new RegExp(search, 'i') },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ['$homeTeam', ' vs ', '$awayTeam'] },
                regex: search,
                options: 'i'
              }
            }
          }
        ]
      })
        .select('gameId')
        .lean()

      if (matchingGames.length > 0) {
        gameIds = matchingGames.map(game => game.gameId)
      }

      query.$or = [{ code: new RegExp(search, 'i') }]
      if (gameIds.length > 0) {
        query.$or.push({ gameId: { $in: gameIds } })
      }
      if (userIds.length > 0) {
        query.$or.push({ user_id: { $in: userIds } })
      }
    }

    const total = await Bet.countDocuments(query)

    const bet = await Bet.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .lean()

    const betjson = await Promise.all(
      bet.map(async b => {
        const user = await User.findOne({ id: b.user_id }).lean()
        const game = await TranDau.findOne({ gameId: b.gameId }).lean()

        return {
          id: b.id,
          code: b.code,
          user: user?.username || 'Unknown',
          trandau: game ? `${game.homeTeam} vs ${game.awayTeam}` : 'Unknown',
          keo: generateKeo(b.betType).name,
          game: b.gameKey,
          muccuoc: b.amount,
          profit: b.profit,
          created: b.created,
          updated: b.updated
        }
      })
    )

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/searchkqthuatheodate', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { startDate, endDate } = req.query || ''

    let query = { result: -1, status: 1 }

    const startTimestamp = startDate
      ? Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000)
      : null
    const endTimestamp = endDate
      ? Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000)
      : null

    if (startTimestamp && endTimestamp) {
      query.created = { $gte: startTimestamp, $lte: endTimestamp }
    } else if (startTimestamp) {
      query.created = { $gte: startTimestamp }
    } else if (endTimestamp) {
      query.created = { $lte: endTimestamp }
    }

    const total = await Bet.countDocuments(query)

    const bet = await Bet.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .lean()

    const betjson = await Promise.all(
      bet.map(async b => {
        const user = await User.findOne({ id: b.user_id }).lean()
        const game = await TranDau.findOne({ gameId: b.gameId }).lean()
        return {
          code: b.code,
          user: user?.username || 'Unknown',
          trandau: game ? `${game.homeTeam} vs ${game.awayTeam}` : 'Unknown',
          keo: generateKeo(b.betType).name,
          game: b.gameKey,
          muccuoc: b.amount,
          profit: b.profit,
          created: b.created,
          updated: b.updated
        }
      })
    )

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getkqhoantien', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const total = await Bet.countDocuments({ result: 0, status: -1 })

    const bet = await Bet.find({ result: 0, status: -1 })
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .lean()

    const betjson = await Promise.all(
      bet.map(async b => {
        const user = await User.findOne({ id: b.user_id }).lean()
        const game = await TranDau.findOne({ gameId: b.gameId }).lean()
        return {
          code: b.code,
          user: user?.username || 'Unknown',
          trandau: game ? `${game.homeTeam} vs ${game.awayTeam}` : 'Unknown',
          keo: generateKeo(b.betType).name,
          game: b.gameKey,
          muccuoc: b.amount,
          profit: b.profit,
          created: b.created,
          updated: b.updated
        }
      })
    )

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getkqhoantienexcel', async (req, res) => {
  try {
    const bet = await Bet.find({ result: 0, status: -1 })

      .sort({ id: -1 })
      .lean()

    const userIds = [...new Set(bet.map(b => b.user_id))]
    const gameIds = [...new Set(bet.map(b => b.gameId))]

    const [users, games] = await Promise.all([
      User.find({ id: { $in: userIds } }).lean(),
      TranDau.find({ gameId: { $in: gameIds } }).lean()
    ])

    const userMap = new Map(users.map(u => [u.id, u.username]))
    const gameMap = new Map(
      games.map(g => [g.gameId, `${g.homeTeam} vs ${g.awayTeam}`])
    )

    const betjson = bet.map(b => ({
      code: b.code,
      user: userMap.get(b.user_id) || 'Unknown',
      trandau: gameMap.get(b.gameId) || 'Unknown',
      keo: generateKeo(b.betType).name,
      game: b.gameKey,
      muccuoc: b.amount,
      profit: b.profit,
      created: b.created,
      updated: b.updated
    }))

    res.json(betjson)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/searchkqhoantientheodate', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { startDate, endDate } = req.query || ''

    let query = { result: 0, status: -1 }

    const startTimestamp = startDate
      ? Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000)
      : null
    const endTimestamp = endDate
      ? Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000)
      : null

    if (startTimestamp && endTimestamp) {
      query.created = { $gte: startTimestamp, $lte: endTimestamp }
    } else if (startTimestamp) {
      query.created = { $gte: startTimestamp }
    } else if (endTimestamp) {
      query.created = { $lte: endTimestamp }
    }

    const total = await Bet.countDocuments(query)

    const bet = await Bet.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .lean()

    const betjson = await Promise.all(
      bet.map(async b => {
        const user = await User.findOne({ id: b.user_id }).lean()
        const game = await TranDau.findOne({ gameId: b.gameId }).lean()
        return {
          code: b.code,
          user: user?.username || 'Unknown',
          trandau: game ? `${game.homeTeam} vs ${game.awayTeam}` : 'Unknown',
          keo: generateKeo(b.betType).name,
          game: b.gameKey,
          muccuoc: b.amount,
          profit: b.profit,
          created: b.created,
          updated: b.updated
        }
      })
    )

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/searchkqhoantien', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { search } = req.body || ''

    let query = { result: 0, status: -1 }

    let gameIds = []
    let userIds = []

    if (search) {
      const matchingUsers = await User.find({
        username: new RegExp(search, 'i')
      })
        .select('id')
        .lean()
      if (matchingUsers.length > 0) {
        userIds = matchingUsers.map(user => user.id)
      }

      const matchingGames = await TranDau.find({
        $or: [
          { homeTeam: new RegExp(search, 'i') },
          { awayTeam: new RegExp(search, 'i') },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ['$homeTeam', ' vs ', '$awayTeam'] },
                regex: search,
                options: 'i'
              }
            }
          }
        ]
      })
        .select('gameId')
        .lean()

      if (matchingGames.length > 0) {
        gameIds = matchingGames.map(game => game.gameId)
      }

      query.$or = [{ code: new RegExp(search, 'i') }]
      if (gameIds.length > 0) {
        query.$or.push({ gameId: { $in: gameIds } })
      }
      if (userIds.length > 0) {
        query.$or.push({ user_id: { $in: userIds } })
      }
    }

    const total = await Bet.countDocuments(query)

    const bet = await Bet.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ id: -1 })
      .lean()

    const betjson = await Promise.all(
      bet.map(async b => {
        const user = await User.findOne({ id: b.user_id }).lean()
        const game = await TranDau.findOne({ gameId: b.gameId }).lean()

        return {
          code: b.code,
          user: user?.username || 'Unknown',
          trandau: game ? `${game.homeTeam} vs ${game.awayTeam}` : 'Unknown',
          keo: generateKeo(b.betType).name,
          game: b.gameKey,
          muccuoc: b.amount,
          profit: b.profit,
          created: b.created,
          updated: b.updated
        }
      })
    )

    res.json({
      data: betjson,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/postchoketqua/:idtrandau', async (req, res) => {
  try {
    const idtrandau = req.params.idtrandau
    const trandau = await TranDau.findById(idtrandau)
    if (!trandau) {
      return res.status(404).json({ error: 'Trận đấu không tồn tại' })
    }
    trandau.started -= 4 * 86400

    await trandau.save()

    res.json({ message: 'Đã cập nhật thời gian trận đấu', trandau })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

module.exports = router
