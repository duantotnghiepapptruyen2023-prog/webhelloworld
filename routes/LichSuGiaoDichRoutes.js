const express = require('express')
const router = express.Router()
const Transactions = require('../models/TransactionsModel')
const Config = require('../models/configModel')
const User = require('../models/UserModel')
router.get('/getgdnaptien', async (req, res) => {
  try {
    const { status, status_gt, page = 1, limit = 20 } = req.query

    const pageNumber = parseInt(page)
    const limitNumber = parseInt(limit)
    const skip = (pageNumber - 1) * limitNumber

    let match = { type: 'deposit' }
    if (status) {
      match.status = parseInt(status)
    } else if (status_gt) {
      match.status = { $gt: parseInt(status_gt) }
    }

    const total = await Transactions.countDocuments(match)

    const transactions = await Transactions.find(match)
      .skip(skip)
      .limit(limitNumber)
      .sort({ id: -1 })
      .lean()

    const userIds = transactions.map(t => t.user_id)

    const users = await User.find({ id: { $in: userIds } }).lean()

    const transactionJson = transactions.map(t => {
      const user = users.find(u => u.id === t.user_id)
      return {
        _id: t._id,
        code: t.code,
        amount: t.amount,
        ip_address: t.ip_address,
        user_id: t.user_id,
        username: user?.username || 'N/A',
        tentk: user?.bank_account_name || 'chưa cập nhật',
        account: user?.bank_account_number || 'chưa cập nhật',
        created: t.created,
        updated: t.updated
      }
    })

    res.json({
      success: true,
      data: transactionJson,
      pagination: {
        total,
        page: pageNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Lỗi server', error })
  }
})

router.get('/getgdnaptienexcel', async (req, res) => {
  try {
    const { status, status_gt } = req.query

    let match = { type: 'deposit' }
    if (status) {
      match.status = parseInt(status)
    } else if (status_gt) {
      match.status = { $gt: parseInt(status_gt) }
    }

    const transactions = await Transactions.find(match).sort({ _id: -1 }).lean()

    const userIds = transactions.map(t => t.user_id)

    const users = await User.find({ id: { $in: userIds } }).lean()

    const transactionJson = transactions.map(t => {
      const user = users.find(u => u.id === t.user_id)
      return {
        _id: t._id,
        code: t.code,
        amount: t.amount,
        ip_address: t.ip_address,
        user_id: t.user_id,
        username: user?.username || 'N/A',
        tentk: user?.bank_account_name || 'chưa cập nhật',
        account: user?.bank_account_number || 'chưa cập nhật',
        created: t.created,
        updated: t.updated
      }
    })

    res.json(transactionJson)
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Lỗi server', error })
  }
})

router.post('/searchgdnaptien', async (req, res) => {
  try {
    const { status, page = 1, limit = 20, status_gt } = req.query
    const { search } = req.body

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skipNum = (pageNum - 1) * limitNum

    let match = { type: 'deposit' }
    if (status) match.status = parseInt(status)
    else if (status_gt) {
      match.status = { $gt: parseInt(status_gt) }
    }

    let userMatch = {}
    if (search) {
      const searchRegex = new RegExp(search, 'i')

      match.$or = [
        { code: searchRegex },
        { ip_address: searchRegex },
        { amount: parseFloat(search) || 0 }
      ]

      userMatch = { username: searchRegex }
    }

    const users = await User.find(userMatch, { id: 1 }).lean()
    const userIds = users.map(u => u.id)

    if (userIds.length > 0) {
      match.$or = match.$or || []
      match.$or.push({ user_id: { $in: userIds } })
    }

    const totalTransactions = await Transactions.countDocuments(match)

    const transactions = await Transactions.find(match)
      .skip(skipNum)
      .limit(limitNum)
      .sort({ created: -1 })
      .lean()

    const transactionUserIds = transactions.map(t => t.user_id)

    const userData = await User.find({ id: { $in: transactionUserIds } }).lean()

    const transactionJson = transactions.map(t => {
      const user = userData.find(u => u.id === t.user_id)
      return {
        _id: t._id,
        code: t.code,
        amount: t.amount,
        ip_address: t.ip_address,
        user_id: t.user_id,
        username: user?.username || 'N/A',
        tentk: user?.bank_account_name || 'chưa cập nhật',
        account: user?.bank_account_number || 'chưa cập nhật',
        created: t.created,
        updated: t.updated
      }
    })

    res.json({
      success: true,
      data: transactionJson,
      pagination: {
        page: pageNum,
        totalPages: Math.ceil(totalTransactions / limitNum),
        total: totalTransactions
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Lỗi server', error })
  }
})

router.get('/getgdnapcrypto', async (req, res) => {
  try {
    const { status, status_gt, page = 1, limit = 20 } = req.query

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skipNum = (pageNum - 1) * limitNum

    let match = { type: 'deposit-crypto' }
    if (status) {
      match.status = parseInt(status)
    } else if (status_gt) {
      match.status = { $gt: parseInt(status_gt) }
    }

    const [totalTransactions, transactions] = await Promise.all([
      Transactions.countDocuments(match),
      Transactions.find(match)
        .skip(skipNum)
        .limit(limitNum)
        .sort({ id: -1 })
        .select('id code amount ip_address user_id created updated')
        .lean()
    ])

    const userIds = [...new Set(transactions.map(t => t.user_id))]

    const users = userIds.length
      ? await User.find({ id: { $in: userIds } })
          .select('id username')
          .lean()
      : []

    const userMap = Object.fromEntries(users.map(u => [u.id, u.username]))

    const transactionJson = transactions.map(t => ({
      ...t,
      username: userMap[t.user_id] || 'N/A',
      tiennap: t.amount * 1000
    }))

    res.json({
      success: true,
      data: transactionJson,
      pagination: {
        total: totalTransactions,
        page: pageNum,
        totalPages: Math.ceil(totalTransactions / limitNum)
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Lỗi server', error })
  }
})

router.get('/getgdnapcryptoexcel', async (req, res) => {
  try {
    const { status, status_gt } = req.query

    let match = { type: 'deposit-crypto' }
    if (status) {
      match.status = parseInt(status)
    } else if (status_gt) {
      match.status = { $gt: parseInt(status_gt) }
    }

    const [transactions] = await Promise.all([
      Transactions.find(match)
        .sort({ _id: -1 })
        .select('id code amount ip_address user_id created updated')
        .lean()
    ])

    const userIds = [...new Set(transactions.map(t => t.user_id))]

    const users = userIds.length
      ? await User.find({ id: { $in: userIds } })
          .select('id username')
          .lean()
      : []

    const userMap = Object.fromEntries(users.map(u => [u.id, u.username]))

    const transactionJson = transactions.map(t => ({
      ...t,
      username: userMap[t.user_id] || 'N/A',
      tiennap: t.amount * 1000
    }))

    res.json(transactionJson)
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Lỗi server', error })
  }
})

router.post('/searchgdnapcrypto', async (req, res) => {
  try {
    const { status, page = 1, limit = 20, status_gt } = req.query
    const { search } = req.body

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skipNum = (pageNum - 1) * limitNum

    let match = { type: 'deposit-crypto' }
    if (status) {
      match.status = parseInt(status)
    } else if (status_gt) {
      match.status = { $gt: parseInt(status_gt) }
    }

    let userMatch = {}
    if (search) {
      const searchRegex = new RegExp(search, 'i')

      match.$or = [{ code: searchRegex }, { ip_address: searchRegex }]

      const searchNumber = parseFloat(search)
      if (!isNaN(searchNumber)) {
        match.$or.push({ amount: searchNumber })
        match.$or.push({ user_id: searchNumber })
      }

      userMatch = { username: searchRegex }
    }

    const users = Object.keys(userMatch).length
      ? await User.find(userMatch, { id: 1 }).lean()
      : []

    const userIds = users.map(u => u.id)
    if (userIds.length > 0) match.$or.push({ user_id: { $in: userIds } })

    const [totalTransactions, transactions] = await Promise.all([
      Transactions.countDocuments(match),
      Transactions.find(match)
        .skip(skipNum)
        .limit(limitNum)
        .sort({ created: -1 })
        .select('id code amount ip_address user_id created updated')
        .lean()
    ])

    const transactionUserIds = [...new Set(transactions.map(t => t.user_id))]

    const userData = transactionUserIds.length
      ? await User.find({ id: { $in: transactionUserIds } })
          .select('id username')
          .lean()
      : []

    const userMap = Object.fromEntries(userData.map(u => [u.id, u.username]))

    const transactionJson = transactions.map(t => ({
      ...t,
      username: userMap[t.user_id] || 'N/A',
      tiennap: t.amount * 1000
    }))

    res.json({
      success: true,
      data: transactionJson,
      pagination: {
        page: pageNum,
        totalPages: Math.ceil(totalTransactions / limitNum),
        total: totalTransactions
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Lỗi server', error })
  }
})

router.get('/getgdruttien', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const pageNumber = parseInt(page)
    const limitNumber = parseInt(limit)
    const skip = (pageNumber - 1) * limitNumber

    const total = await Transactions.countDocuments({
      type: 'withdraw',
      status
    })

    const transactions = await Transactions.find({ type: 'withdraw', status })
      .sort({ id: -1 })
      .skip(skip)
      .limit(limitNumber)
      .select(
        '_id id code message amount bank_name bank_account bank_account_name ip_address created updated user_id'
      )
      .lean()

    if (transactions.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { total, page: pageNumber, totalPages: 0 }
      })
    }

    const userIds = transactions.map(trans => trans.user_id)

    const users = await User.find({ id: { $in: userIds } })
      .select('id username')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))

    const transactionsjson = transactions.map(trans => ({
      _id: trans._id,
      id: trans.id,
      order: trans.code,
      message: trans.message,
      username: userMap.get(trans.user_id) || 'N/A',
      tienrut: trans.amount * 1000,
      phirut: trans.amount * 0.02 * 1000,
      thucchuyen: trans.amount * 1000 - trans.amount * 0.02 * 1000,
      nganhang: trans.bank_name,
      sotk: trans.bank_account,
      tentk: trans.bank_account_name,
      ip: trans.ip_address,
      created: trans.created,
      updated: trans.updated
    }))

    res.json({
      success: true,
      data: transactionsjson,
      pagination: {
        total,
        page: pageNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error })
  }
})

router.get('/getgdruttienexcel', async (req, res) => {
  try {
    const { status } = req.query

    const transactions = await Transactions.find({ type: 'withdraw', status })
      .sort({ id: -1 })
      .select(
        '_id id code message amount bank_name bank_account bank_account_name ip_address created updated user_id'
      )
      .lean()

    const userIds = transactions.map(trans => trans.user_id)

    const users = await User.find({ id: { $in: userIds } })
      .select('id username')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))

    const transactionsjson = transactions.map(trans => ({
      _id: trans._id,
      id: trans.id,
      order: trans.code,
      message: trans.message,
      username: userMap.get(trans.user_id) || 'N/A',
      tienrut: trans.amount * 1000,
      phirut: trans.amount * 0.02 * 1000,
      thucchuyen: trans.amount * 1000 - trans.amount * 0.02 * 1000,
      nganhang: trans.bank_name,
      sotk: trans.bank_account,
      tentk: trans.bank_account_name,
      ip: trans.ip_address,
      created: trans.created,
      updated: trans.updated
    }))

    res.json(transactionsjson)
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: 'Lỗi server', error })
  }
})

router.post('/searchgdruttien', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const { search } = req.body
    const pageNumber = parseInt(page)
    const limitNumber = parseInt(limit)
    const skip = (pageNumber - 1) * limitNumber

    const match = { type: 'withdraw' }
    if (status) match.status = parseInt(status)

    let userIds = []
    if (search) {
      const searchRegex = new RegExp(search, 'i')
      const users = await User.find({ username: searchRegex })
        .select('id')
        .lean()
      userIds = users.map(u => u.id)

      match.$or = [
        { code: searchRegex },
        { ip_address: searchRegex },
        ...(isNaN(parseFloat(search)) ? [] : [{ amount: parseFloat(search) }]),
        ...(userIds.length > 0 ? [{ user_id: { $in: userIds } }] : [])
      ]
    }

    const total = await Transactions.countDocuments(match)

    const transactions = await Transactions.find(match)
      .sort({ created: -1 })
      .skip(skip)
      .limit(limitNumber)
      .select(
        '_id id code message amount bank_name bank_account bank_account_name ip_address created updated user_id'
      )
      .lean()

    if (transactions.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { total, currentPage: pageNumber, totalPages: 0 }
      })
    }

    const transUserIds = transactions.map(trans => trans.user_id)

    const users = await User.find({ id: { $in: transUserIds } })
      .select('id username')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))

    const transactionsjson = transactions.map(trans => ({
      id: trans.id,
      order: trans.code,
      message: trans.message,
      username: userMap.get(trans.user_id) || 'N/A',
      tienrut: trans.amount * 1000,
      phirut: trans.amount * 0.05 * 1000,
      thucchuyen: trans.amount * 1000 - trans.amount * 0.05 * 1000,
      nganhang: trans.bank_name,
      sotk: trans.bank_account,
      tentk: trans.bank_account_name,
      ip: trans.ip_address,
      created: trans.created,
      updated: trans.updated
    }))

    res.json({
      success: true,
      data: transactionsjson,
      pagination: {
        total,
        currentPage: pageNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error })
  }
})

router.get('/getgdruttiencryto', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const pageNumber = parseInt(page)
    const limitNumber = parseInt(limit)
    const skip = (pageNumber - 1) * limitNumber

    const withdrawal_crypto_exchange_rate = await Config.findOne({
      name: 'withdrawal_crypto_exchange_rate'
    }).lean()
    const exchangeRate = parseFloat(withdrawal_crypto_exchange_rate.data) * 1000

    const total = await Transactions.countDocuments({
      type: 'withdraw-crypto',
      status
    })

    const transactions = await Transactions.find({
      type: 'withdraw-crypto',
      status
    })
      .sort({ id: -1 })
      .skip(skip)
      .limit(limitNumber)
      .select('_id id code message amount ip_address created updated user_id')
      .lean()

    if (transactions.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { total, page: pageNumber, totalPages: 0 }
      })
    }

    const userIds = transactions.map(trans => trans.user_id)

    const users = await User.find({ id: { $in: userIds } })
      .select('id username cryto_wallet')
      .lean()

    const userMap = new Map(
      users.map(user => [
        user.id,
        {
          username: user.username,
          cryto_wallet: user.cryto_wallet || 'chưa cập nhật'
        }
      ])
    )

    const transactionsjson = transactions.map(trans => {
      const tienrut = trans.amount * 1000
      const phirut = tienrut * 0.02
      const thucchuyen = tienrut - phirut
      const user = userMap.get(trans.user_id) || {
        username: 'N/A',
        cryto_wallet: 'chưa cập nhật'
      }
      return {
        _id: trans._id,
        id: trans.id,
        order: trans.code,
        message: trans.message,
        username: user.username,
        tienrut,
        phirut,
        thucchuyen,
        quydoi: Math.round(thucchuyen / exchangeRate),
        cryto_wallet: user.cryto_wallet,
        net: 'BEP20',
        ip: trans.ip_address,
        created: trans.created,
        updated: trans.updated
      }
    })

    res.json({
      success: true,
      data: transactionsjson,
      pagination: {
        total,
        page: pageNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error })
  }
})

router.get('/getgdruttiencrytoexcel', async (req, res) => {
  try {
    const { status } = req.query

    const withdrawal_crypto_exchange_rate = await Config.findOne({
      name: 'withdrawal_crypto_exchange_rate'
    }).lean()
    const exchangeRate = parseFloat(withdrawal_crypto_exchange_rate.data) * 1000

    const transactions = await Transactions.find({
      type: 'withdraw-crypto',
      status
    })
      .sort({ id: -1 })
      .select('_id id code message amount ip_address created updated user_id')
      .lean()

    const userIds = transactions.map(trans => trans.user_id)

    const users = await User.find({ id: { $in: userIds } })
      .select('id username cryto_wallet')
      .lean()

    const userMap = new Map(
      users.map(user => [
        user.id,
        {
          username: user.username,
          cryto_wallet: user.cryto_wallet || 'chưa cập nhật'
        }
      ])
    )

    const transactionsjson = transactions.map(trans => {
      const tienrut = trans.amount * 1000
      const phirut = tienrut * 0.02
      const thucchuyen = tienrut - phirut
      const user = userMap.get(trans.user_id) || {
        username: 'N/A',
        cryto_wallet: 'chưa cập nhật'
      }
      return {
        _id: trans._id,
        id: trans.id,
        order: trans.code,
        message: trans.message,
        username: user.username,
        tienrut,
        phirut,
        thucchuyen,
        quydoi: Math.round(thucchuyen / exchangeRate),
        cryto_wallet: user.cryto_wallet,
        net: 'BEP20',
        ip: trans.ip_address,
        created: trans.created,
        updated: trans.updated
      }
    })

    res.json(transactionsjson)
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error })
  }
})

router.post('/searchgdruttiencrypto', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const { search } = req.body
    const pageNumber = parseInt(page)
    const limitNumber = parseInt(limit)
    const skip = (pageNumber - 1) * limitNumber

    const withdrawal_crypto_exchange_rate = await Config.findOne({
      name: 'withdrawal_crypto_exchange_rate'
    }).lean()
    const exchangeRate = parseFloat(withdrawal_crypto_exchange_rate.data) * 1000

    const match = { type: 'withdraw-crypto' }
    if (status) match.status = parseInt(status)

    let userIds = []
    if (search) {
      const searchRegex = new RegExp(search, 'i')
      const users = await User.find({ username: searchRegex })
        .select('id')
        .lean()
      userIds = users.map(u => u.id)

      match.$or = [
        { code: searchRegex },
        { ip_address: searchRegex },
        ...(isNaN(parseFloat(search)) ? [] : [{ amount: parseFloat(search) }]),
        ...(userIds.length > 0 ? [{ user_id: { $in: userIds } }] : [])
      ]
    }

    const total = await Transactions.countDocuments(match)

    const transactions = await Transactions.find(match)
      .sort({ created: -1 })
      .skip(skip)
      .limit(limitNumber)
      .select('_id id code message amount ip_address created updated user_id')
      .lean()

    if (transactions.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { total, currentPage: pageNumber, totalPages: 0 }
      })
    }

    const transUserIds = transactions.map(trans => trans.user_id)

    const users = await User.find({ id: { $in: transUserIds } })
      .select('id username cryto_wallet')
      .lean()

    const userMap = new Map(
      users.map(user => [
        user.id,
        {
          username: user.username,
          cryto_wallet: user.cryto_wallet || 'chưa cập nhật'
        }
      ])
    )

    const transactionsjson = transactions.map(trans => {
      const tienrut = trans.amount * 1000
      const phirut = tienrut * 0.05
      const thucchuyen = tienrut - phirut
      const user = userMap.get(trans.user_id) || {
        username: 'N/A',
        cryto_wallet: 'chưa cập nhật'
      }
      return {
        id: trans.id,
        order: trans.code,
        message: trans.message,
        username: user.username,
        tienrut,
        phirut,
        thucchuyen,
        quydoi: Math.round(thucchuyen / exchangeRate),
        cryto_wallet: user.cryto_wallet,
        net: 'BEP20',
        ip: trans.ip_address,
        created: trans.created,
        updated: trans.updated
      }
    })

    res.json({
      success: true,
      data: transactionsjson,
      pagination: {
        total,
        currentPage: pageNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error })
  }
})

module.exports = router
