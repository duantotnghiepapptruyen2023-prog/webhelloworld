const express = require('express')
const router = express.Router()
const Bet = require('../models/BetModel')
const User = require('../models/UserModel')
const TranDau = require('../models/TranDauModel')
const moment = require('moment')

const tabNames = [
  { id: '1_1', name: 'FT Tỷ số', type: 'FT' },
  { id: '1_2', name: 'FT Chẵn lẻ', type: 'FT' },
  { id: '1_3', name: 'FT Thắng Hòa Thua', type: 'FT' },
  { id: '2_1', name: 'HT Tỷ số', type: 'HT' },
  { id: '2_3', name: 'HT Thắng Hòa Thua', type: 'HT' },
  { id: '3_1', name: 'H2T Tỷ số', type: 'H2T' }
]

const generatetrangthai = (result, status) => {
  if (result === 1) {
    return 'Thắng'
  }
  if (result === -1) {
    return 'Thua'
  }
  if (result === 0) {
    if (status === -1) {
      return 'Hủy'
    }
    return 'Đang chờ kết quả'
  }
}
const formatdateTime = timestamp => {
  const formattedDate = moment.unix(timestamp).format('YYYY-MM-DD HH:mm:ss')
  return formattedDate
}
const formatTimedate = timestamp => {
  const formattedDate = moment.unix(timestamp).format('HH:mm YYYY-MM-DD')
  return formattedDate
}

const generateKeo = betType => {
  return tabNames.find(tab => tab.id === betType) || null
}

router.get('/lichsucuoc/:userid', async (req, res) => {
  try {
    const userId = req.params.userid
    let { startdate, enddate, type } = req.query

    if (!startdate) {
      startdate = enddate
    } else if (!enddate) {
      enddate = startdate
    }

    if (!startdate && !enddate) {
      return res.json({
        status: -1,
        message: 'Thiếu ngày bắt đầu hoặc ngày kết thúc'
      })
    }

    const startTimestamp = Math.floor(
      new Date(startdate + ' 00:00:00').getTime() / 1000
    )
    const endTimestamp = Math.floor(
      new Date(enddate + ' 23:59:59').getTime() / 1000
    )

    const bets = await Bet.find({
      user_id: +userId,
      status: {
        $ne: 0
      },
      created: { $gte: startTimestamp, $lte: endTimestamp }
    }).sort({ id: -1 })
    const betjson = await Promise.all(
      bets.map(async b => {
        const tranDau = await TranDau.findOne({ gameId: b.gameId })
        const loinhuan = (b.amount * b.profit) / 100
        const phicuoc = -loinhuan * 0.05
        const loinhuanrong = loinhuan - loinhuan * 0.05

        return {
          code: b.code,
          trangthai: generatetrangthai(b.result, b.status),
          keo: generateKeo(b.betType).name,
          betType: b.betType,
          gamekey: b.gameKey,
          profit: b.profit,
          leageName:tranDau?.leagueName,
          homeName: tranDau?.homeTeam || 'N/A',
          awayName: tranDau?.awayTeam || 'N/A',
          giodau: formatTimedate(tranDau?.started || 0),
          datecuoc: formatdateTime(b.created),
          tiencuoc: b.amount,
          loinhuan: loinhuan.toFixed(2),
          phicuoc: phicuoc.toFixed(2),
          loinhuanrong: loinhuanrong.toFixed(2),
          baotoan: tranDau?.baotoanvon?.tyso || '',
          keo_tran: tranDau?.baotoanvon?.keo || '',
          result: b.result,
          status: b.status
        }
      })
    )

    let filteredBets = betjson
    if (type === 'đã hoàn thành') {
      filteredBets = betjson.filter(
        b => b.result !== 0 || (b.result === 0 && b.status === -1)
      )
      console.log(filteredBets)
    } else if (type === 'đang xử lý') {
      filteredBets = betjson.filter(b => b.result === 0 && b.status === 1)
    }

    return res.json(filteredBets)
  } catch (error) {
    console.error(error)
    return res.json({ status: -1, message: 'Lỗi server, vui lòng thử lại sau' })
  }
})

router.get('/lichsucuocadmin/:userid', async (req, res) => {
  try {
    const userId = req.params.userid
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const user = await User.findById(userId)

    const totalBets = await Bet.countDocuments({ user_id: user.id })

    const bets = await Bet.find({ user_id: user.id })
      .sort({ created: -1 })
      .skip(skip)
      .limit(limit)

    const betjson = await Promise.all(
      bets.map(async b => {
        const tranDau = await TranDau.findOne({ gameId: b.gameId })
        const loinhuan = (b.amount * b.profit) / 100
        const phicuoc = -loinhuan * 0.05
        const loinhuanrong = loinhuan - loinhuan * 0.05

        return {
          id: b.id,
          code: b.code,
          trangthai: generatetrangthai(b.result, b.status),
          keo: generateKeo(b.betType).name,
          gamekey: b.gameKey,
          profit: b.profit,
          ht: `${tranDau?.resultUpC}:${tranDau?.resultUpH}`,
          ft: `${tranDau?.resultC}:${tranDau?.resultH}`,
          homeName: tranDau?.homeTeam || 'N/A',
          awayName: tranDau?.awayTeam || 'N/A',
          giodau: formatTimedate(tranDau?.started || 0),
          datecuoc: formatdateTime(b.created),
          tiencuoc: b.amount,
          loinhuan: loinhuan.toFixed(2),
          phicuoc: phicuoc.toFixed(2),
          loinhuanrong: loinhuanrong.toFixed(2),
          result: b.result
        }
      })
    )

    return res.json({
      totalBets,
      page,
      limit,
      totalPages: Math.ceil(totalBets / limit),
      data: betjson
    })
  } catch (error) {
    console.error(error)
    return res.json({ status: -1, message: 'Lỗi server, vui lòng thử lại sau' })
  }
})

router.get('/lichsucuocadminexcel/:userid', async (req, res) => {
  try {
    const userId = req.params.userid

    const user = await User.findOne({ _id: userId }).select('id').lean()
    if (!user) {
      return res
        .status(404)
        .json({ status: -1, message: 'Không tìm thấy người dùng' })
    }

    const bets = await Bet.find({ user_id: user.id })
      .sort({ created: -1 })
      .select(
        'id code result status betType gameKey profit amount created gameId'
      )
      .lean()

    const gameIds = [...new Set(bets.map(b => b.gameId))]

    const tranDaus = await TranDau.find({ gameId: { $in: gameIds } })
      .select('gameId homeTeam awayTeam started')
      .lean()

    const tranDauMap = new Map(tranDaus.map(td => [td.gameId, td]))

    const betjson = bets.map(b => {
      const td = tranDauMap.get(b.gameId)
      const loinhuan = (b.amount * b.profit) / 100
      const phicuoc = -loinhuan * 0.05
      const loinhuanrong = loinhuan + phicuoc
      return {
        id: b.id,
        code: b.code,
        trangthai: generatetrangthai(b.result, b.status),
        keo: generateKeo(b.betType).name,
        gamekey: b.gameKey,
        profit: b.profit,
        ht: `${td?.resultUpC}:${td?.resultUpH}`,
        ft: `${td?.resultC}:${td?.resultH}`,
        homeName: td?.homeTeam || 'N/A',
        awayName: td?.awayTeam || 'N/A',
        giodau: formatTimedate(td?.started || 0),
        datecuoc: formatdateTime(b.created),
        tiencuoc: b.amount,
        loinhuan: loinhuan.toFixed(2),
        phicuoc: phicuoc.toFixed(2),
        loinhuanrong: loinhuanrong.toFixed(2),
        result: b.result
      }
    })

    return res.json(betjson)
  } catch (error) {
    console.error(error)
    return res
      .status(500)
      .json({ status: -1, message: 'Lỗi server, vui lòng thử lại sau' })
  }
})

module.exports = router
