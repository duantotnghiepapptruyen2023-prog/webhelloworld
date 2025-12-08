const express = require('express')
const router = express.Router()
const Transactions = require('../models/TransactionsModel')
const User = require('../models/UserModel')
const { handelbot } = require('./TeleGram')
const Config = require('../models/configModel')
const UserCoinLog = require('../models/CoinLogModel')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { NAP_DAU } = require('../config/config')

require('dotenv').config()

const getPublicIP = async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    return ip
  } catch (error) {
    console.error('Lỗi khi lấy IP:', error)
    return 'Không xác định'
  }
}

const handlestatus = status => {
  try {
    if (status === 0) {
      return 'Chờ xử lý'
    }
    if (status === 1 || status === 2) {
      return 'Thành công'
    }
    if (status === -1) {
      return 'Bị hủy'
    }
  } catch (error) {
    return 'Không xác định'
  }
}

const handleType = type => {
  try {
    if (type === 'deposit') {
      return 'Nạp tiền pháp định'
    }
    if (type === 'withdraw') {
      return 'Rút tiền pháp định'
    }
    if (type === 'deposit-crypto') {
      return 'Nạp-Crypto'
    }
    if (type === 'withdraw-crypto') {
      return 'Rút-Crypto'
    }
  } catch (error) {
    return 'Không xác định'
  }
}

const handelReason = (type, code) => {
  try {
    if (type === 'withdraw-crypto') {
      return `Withdrawal Crypto ${code}`
    }
    if (type === 'withdraw') {
      return `Withdrawal ${code}`
    }
  } catch (error) {
    return 'Không xác định'
  }
}
const handelamount = (
  deposit_crypto_exchange_rate,
  deposit_crypto_fee,
  amount,
  type
) => {
  try {
    const amountnumber = amount * 1000
    const depositcrypto =
      amount *
      parseFloat(deposit_crypto_exchange_rate) *
      (1 - parseFloat(deposit_crypto_fee))

    if (type === 'deposit') {
      return amount * 1000
    }
    if (type === 'withdraw') {
      return amountnumber
    }
    if (type === 'deposit-crypto') {
      return depositcrypto * 1000
    }
    if (type === 'withdraw-crypto') {
      return amountnumber
    }
  } catch (error) {
    return 'Không xác định'
  }
}

const generateUniqueCode = async () => {
  const chars = '0123456789'
  let code
  let isDuplicate = true

  while (isDuplicate) {
    code = Array.from(
      { length: 8 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('')

    const existingUser = await User.findOne({ code })
    if (!existingUser) {
      isDuplicate = false
    }
  }

  return code
}

router.post('/import-transactions', async (req, res) => {
  try {
    console.log('Bắt đầu import dữ liệu transactions từ JSON...')

    const filePath = path.join(
      __dirname,
      '../backup/app_users_transactions.json'
    )

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ error: 'File backup transactions không tồn tại' })
    }

    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const transactions =
      jsonData.find(
        item => item.type === 'table' && item.name === 'app_users_transactions'
      )?.data || []

    if (!transactions.length) {
      return res
        .status(400)
        .json({ error: 'Không có dữ liệu transactions để import' })
    }

    // Chuẩn hóa dữ liệu transactions theo schema của bạn
    const formattedTransactions = transactions.map(trans => ({
      id: trans.id !== undefined ? parseInt(trans.id, 10) : undefined,
      code: trans.code || null,
      user_id: trans.user_id !== undefined ? parseInt(trans.user_id, 10) : null,
      type: trans.type || null,
      amount: trans.amount !== undefined ? parseInt(trans.amount, 10) : null,
      bank_name: trans.bank_name || null,
      bank_account: trans.bank_account || null,
      bank_account_name: trans.bank_account_name || null,
      transaction_code: trans.transaction_code || null,
      transaction_time: trans.transaction_time || null,
      data: trans.data ? JSON.parse(trans.data) : [], // Parse chuỗi JSON thành mảng, mặc định là mảng rỗng
      description: trans.description || null,
      message: trans.message || null,
      ip_address: trans.ip_address || null,
      logs: trans.logs || null,
      created: trans.created !== undefined ? parseInt(trans.created, 10) : null,
      updated: trans.updated !== undefined ? parseInt(trans.updated, 10) : null,
      status: trans.status !== undefined ? parseInt(trans.status, 10) : 0 // Giá trị mặc định trong schema
    }))

    const bulkOps = formattedTransactions.map(trans => ({
      updateOne: {
        filter: { id: trans.id }, // Dựa trên id để kiểm tra bản ghi tồn tại
        update: { $set: trans }, // Cập nhật toàn bộ dữ liệu
        upsert: true // Thêm mới nếu chưa tồn tại
      }
    }))

    await Transactions.bulkWrite(bulkOps)

    console.log('Import dữ liệu transactions thành công!')
    res.status(201).json({
      message: 'Dữ liệu transactions đã được import vào database thành công!',
      importedCount: formattedTransactions.length
    })
  } catch (error) {
    console.error('Lỗi khi import dữ liệu transactions:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/cleartransactions', async (req, res) => {
  try {
    await Transactions.deleteMany({})
    res.status(200).json({ message: 'Xóa transactions thành công!' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/naptien/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    let { amount, type } = req.body
    let qrImageUrl, BankAccountNumber, BankAccountName, OrderNo, codechuyen
    const user = await User.findById(userid)
    const timeNow = Math.floor(Date.now() / 1000)
    const userIP = await getPublicIP(req, res)
    const deposit_crypto_exchange_rate = await Config.findOne({
      name: 'deposit_crypto_exchange_rate'
    })
    const deposit_crypto_fee = await Config.findOne({
      name: 'deposit_crypto_fee'
    })

    const lasTransactions = await Transactions.findOne().sort({ id: -1 })
    const newUserId = lasTransactions ? lasTransactions.id + 1 : 2000
    const uniqueCode = await generateUniqueCode()
    let code = `2025${uniqueCode}`
    if (type === 'deposit-crypto') {
      code = `${uniqueCode}`
    }
    let amountnew = amount
    if (type === 'deposit-crypto') {
      amountnew =
        amount *
        parseFloat(deposit_crypto_exchange_rate.data) *
        (1 - parseFloat(deposit_crypto_fee.data))
    }

    const transactions = new Transactions({
      id: newUserId,
      code: code,
      user_id: user.id,
      amount: amountnew,
      type,
      ip_address: userIP,
      created: timeNow,
      updated: timeNow,
      bank_account: user.bank_account_number,
      bank_name: user.bank_name,
      bank_account_name: user.bank_account_name
    })
    transactions.data.push(amount)

    await transactions.save()
    handelbot(
      `[NẠP TIỀN] User ${user.username} Đặt lệnh nạp tiền: ${
        type === 'deposit-crypto' ? amountnew : amount
      }K, mã giao dịch: ${code}`
    )
    let bankjson = {}

    if (type === 'deposit') {
      const response = await axios.post(`${process.env.DOMAIN_BANK}/napmomo`, {
        BankCode: 'ACB',
        member_identity: user.name,
        requestId: code,
        amount: amount * 1000,
        callback: `${process.env.DOMAIN_BACKEND}/callbacknap`
      })
      console.log(response.data)
      if (response.data.stt === 1) {
        qrImageUrl = response.data.data.qr_url
        BankAccountName = response.data.data.phoneName
        BankAccountNumber = response.data.data.phoneNum
        OrderNo = response.data.data.code
        codechuyen = response.data.data.code
      }
      bankjson = {
        qrImageUrl: qrImageUrl,
        BankAccountName: BankAccountName,
        BankAccountNumber: BankAccountNumber,
        OrderNo: OrderNo,
        code: code,
        codechuyen: codechuyen
      }
      console.log(bankjson)
      return res.json({ bankjson, transactions })
    }

    return res.json({ bankjson, transactions })
  } catch (error) {
    console.error(error)
  }
})
router.post('/naptien2/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    let { amount, type } = req.body
    let qrImageUrl, BankAccountNumber, BankAccountName, OrderNo
    const user = await User.findById(userid)
    const timeNow = Math.floor(Date.now() / 1000)
    const userIP = await getPublicIP(req, res)
    const deposit_crypto_exchange_rate = await Config.findOne({
      name: 'deposit_crypto_exchange_rate'
    })
    const deposit_crypto_fee = await Config.findOne({
      name: 'deposit_crypto_fee'
    })

    const lasTransactions = await Transactions.findOne().sort({ id: -1 })
    const newUserId = lasTransactions ? lasTransactions.id + 1 : 2000
    const uniqueCode = await generateUniqueCode()
    let code = `2025${uniqueCode}`
    if (type === 'deposit-crypto') {
      code = `${uniqueCode}`
    }
    let amountnew = amount
    if (type === 'deposit-crypto') {
      amountnew =
        amount *
        parseFloat(deposit_crypto_exchange_rate.data) *
        (1 - parseFloat(deposit_crypto_fee.data))
    }

    const transactions = new Transactions({
      id: newUserId,
      code: code,
      user_id: user.id,
      amount: amountnew,
      type,
      ip_address: userIP,
      created: timeNow,
      updated: timeNow,
      bank_account: user.bank_account_number,
      bank_name: user.bank_name,
      bank_account_name: user.bank_account_name
    })
    transactions.data.push(amount)

    await transactions.save()
    handelbot(
      `[NẠP TIỀN] User ${user.username} Đặt lệnh nạp tiền: ${
        type === 'deposit-crypto' ? amountnew : amount
      }K, mã giao dịch: ${code}`
    )

    let bankjson = {}

    if (type === 'deposit') {
      const response = await axios.post(
        `${process.env.DOMAIN_BANK}/naptienbank`,
        {
          BankCode: 'ACB',
          RefCode: code,
          Amount: amount * 1000,
          CallbackUrl: `${process.env.DOMAIN_BACKEND}/callbacknap`
        }
      )
      console.log(response.data)
      if (response.data.ResponseCode === 1) {
        const content = JSON.parse(response.data.ResponseContent)
        qrImageUrl = content.Url || content.QRCode
        BankAccountName = content.BankAccountName
        BankAccountNumber = content.BankAccountNumber
        OrderNo = content.OrderNo
      }
      bankjson = {
        qrImageUrl: qrImageUrl,
        BankAccountName: BankAccountName,
        BankAccountNumber: BankAccountNumber,
        OrderNo: OrderNo,
        code: code
      }

      return res.json({ bankjson, transactions })
    }

    return res.json({ bankjson, transactions })
  } catch (error) {
    console.error(error)
  }
})

router.get('/getgiaodichlandau', async (req, res) => {
  try {
    let { page = 1, limit = 20 } = req.query
    page = parseInt(page)
    limit = parseInt(limit)

    const skip = (page - 1) * limit

    const pipeline = [
      {
        $match: {
          type: 'deposit',
          status: { $in: [1, 2] },
          amount: { $gte: 100 }
        }
      },
      {
        $sort: { created: 1 }
      },
      {
        $group: {
          _id: '$user_id',
          firstTransaction: { $first: '$$ROOT' },
          hasApproved: {
            $max: { $cond: [{ $eq: ['$status', 2] }, 1, 0] }
          }
        }
      },
      {
        $match: {
          hasApproved: 0,
          'firstTransaction.status': 1
        }
      },
      {
        $replaceRoot: { newRoot: '$firstTransaction' }
      },

      {
        $sort: { created: -1 }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          id: 1,
          order: '$code',
          amount: { $multiply: ['$amount', 1000] },
          thuongnaplandau: {
            $min: [
              { $multiply: [{ $multiply: ['$amount', NAP_DAU] }, 1000] },
              3000000
            ]
          },
          username: '$user.username',
          created: 1,
          updated: 1,
          status: 1,
          type: 1
        }
      }
    ]

    const countPipeline = [
      ...pipeline.slice(0, 5),
      {
        $count: 'total'
      }
    ]

    const [results, countResult] = await Promise.all([
      Transactions.aggregate(pipeline),
      Transactions.aggregate(countPipeline)
    ])

    const totalRecords = countResult[0]?.total || 0
    const totalPages = Math.ceil(totalRecords / limit)

    res.json({
      data: results,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message })
  }
})

router.get('/getgiaodichlandauexcel', async (req, res) => {
  try {
    const pipeline = [
      {
        $match: {
          type: 'deposit',
          status: { $in: [1, 2] },
          amount: { $gte: 100 }
        }
      },
      {
        $sort: { created: 1 }
      },
      {
        $group: {
          _id: '$user_id',
          firstTransaction: { $first: '$$ROOT' },
          hasApproved: {
            $max: { $cond: [{ $eq: ['$status', 2] }, 1, 0] }
          }
        }
      },
      {
        $match: {
          hasApproved: 0,
          'firstTransaction.status': 1
        }
      },
      {
        $replaceRoot: { newRoot: '$firstTransaction' }
      },
      {
        $sort: { created: -1 }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          id: 1,
          code: '$code',
          amount: { $multiply: ['$amount', 1000] },
          thuongnaplandau: {
            $min: [
              { $multiply: [{ $multiply: ['$amount', NAP_DAU] }, 1000] },
              3000000
            ]
          },
          username: '$user.username',
          created: 1,
          updated: 1,
          status: 1,
          type: 1
        }
      }
    ]

    const [results] = await Promise.all([Transactions.aggregate(pipeline)])

    res.json(results)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message })
  }
})

// router.post('/searchgiaodichlandau', async (req, res) => {
//   try {
//     let { page = 1, limit = 20 } = req.query
//     const { search } = req.body
//     page = parseInt(page)
//     limit = parseInt(limit)

//     let userMatch = {}
//     let match = {
//       type: { $in: ['deposit', 'deposit-crypto'] }
//     }

//     if (search) {
//       const searchRegex = new RegExp(search, 'i')
//       userMatch = { username: searchRegex }
//       const users = await User.find(userMatch, { id: 1 }).lean()
//       const userIds = users.map(u => u.id)

//       match.$or = [
//         { code: searchRegex },
//         { ip_address: searchRegex },
//         { amount: parseFloat(search) || 0 }
//       ]

//       if (userIds.length > 0) {
//         match.$or.push({ user_id: { $in: userIds } })
//       }
//     }

//     const allTransactions = await Transactions.find(match).sort({ created: 1 })

//     const firstTransactionsMap = new Map()

//     const transactionsByUser = {}
//     for (const transaction of allTransactions) {
//       if (!transactionsByUser[transaction.user_id]) {
//         transactionsByUser[transaction.user_id] = []
//       }
//       transactionsByUser[transaction.user_id].push(transaction)
//     }

//     for (const userId in transactionsByUser) {
//       const userTransactions = transactionsByUser[userId]
//       const oldestTransaction = userTransactions[0]

//       const transactionAmount = oldestTransaction.amount

//       if (oldestTransaction.status === 1 && transactionAmount >= 500) {
//         firstTransactionsMap.set(userId, oldestTransaction)
//       } else if (oldestTransaction.status === 2 || transactionAmount < 500) {
//         firstTransactionsMap.set(userId, null)
//       }
//     }

//     const firstTransactions = Array.from(firstTransactionsMap.values()).filter(
//       tx => tx !== null
//     )
//     const sortedFirstTransactions = firstTransactions.sort(
//       (a, b) => b.created - a.created
//     )

//     const totalRecords = sortedFirstTransactions.length
//     const totalPages = Math.ceil(totalRecords / limit)

//     const paginatedTransactions = sortedFirstTransactions.slice(
//       (page - 1) * limit,
//       page * limit
//     )

//     const userIds = paginatedTransactions.map(t => t.user_id)
//     const users = await User.find(
//       { id: { $in: userIds } },
//       { id: 1, username: 1 }
//     ).lean()

//     const transactionsWithUser = paginatedTransactions.map(tx => {
//       const user = users.find(u => u.id.toString() === tx.user_id.toString())
//       return {
//         _id: tx._id,
//         id: tx.id,
//         order: tx.code,
//         amount: tx.amount * 1000,
//         thuongnaplandau: tx.amount * 0.02 * 1000,
//         username: user ? user.username : 'N/A',
//         created: tx.created,
//         updated: tx.updated,
//         status: tx.status,
//         type: tx.type
//       }
//     })

//     res.json({
//       data: transactionsWithUser,
//       pagination: {
//         currentPage: page,
//         totalPages,
//         totalRecords
//       }
//     })
//   } catch (error) {
//     res.status(500).json({ error: error.message })
//   }
// })

router.post('/searchgiaodichlandau', async (req, res) => {
  try {
    let { page = 1, limit = 20 } = req.query
    const { search } = req.body

    page = parseInt(page)
    limit = parseInt(limit)

    const skip = (page - 1) * limit

    let userIds = []
    if (search) {
      const searchRegex = new RegExp(search, 'i')
      const users = await User.find({ username: searchRegex }, { id: 1 }).lean()
      userIds = users.map(u => u.id)
    }

    const searchRegex = search ? new RegExp(search, 'i') : null

    const pipeline = [
      {
        $match: {
          type: { $in: ['deposit', 'deposit-crypto'] },
          status: { $in: [1, 2] },
          amount: { $gte: 100 }
        }
      },
      {
        $sort: { created: 1 }
      },
      {
        $group: {
          _id: '$user_id',
          firstTransaction: { $first: '$$ROOT' },
          hasApproved: {
            $max: { $cond: [{ $eq: ['$status', 2] }, 1, 0] }
          }
        }
      },
      {
        $match: {
          hasApproved: 0,
          'firstTransaction.status': 1
        }
      },
      {
        $replaceRoot: { newRoot: '$firstTransaction' }
      }
    ]

    if (search) {
      const extraMatch = {
        $or: [
          { code: searchRegex },
          { ip_address: searchRegex },
          { amount: parseFloat(search) || 0 }
        ]
      }

      if (userIds.length > 0) {
        extraMatch.$or.push({ user_id: { $in: userIds } })
      }

      pipeline.push({ $match: extraMatch })
    }

    const countPipeline = [...pipeline, { $count: 'total' }]

    pipeline.push(
      { $sort: { created: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'id',
          as: 'user'
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          id: 1,
          order: '$code',
          amount: { $multiply: ['$amount', 1000] },
          thuongnaplandau: {
            $multiply: [{ $multiply: ['$amount', 0.03] }, 1000]
          },
          username: '$user.username',
          created: 1,
          updated: 1,
          status: 1,
          type: 1
        }
      }
    )

    const [results, countResult] = await Promise.all([
      Transactions.aggregate(pipeline),
      Transactions.aggregate(countPipeline)
    ])

    const totalRecords = countResult[0]?.total || 0
    const totalPages = Math.ceil(totalRecords / limit)

    res.json({
      data: results,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message })
  }
})

router.get('/getthuongnaplandau', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const totalCount = await Transactions.countDocuments({ status: 2 })

    const transactions = await Transactions.find({ status: 2 })
      .skip(skip)
      .limit(limitNum)
      .select('code user_id amount created updated')
      .lean()
      .sort({ created: -1 })

    const userIds = transactions.map(trans => trans.user_id)

    const users = await User.find({ id: { $in: userIds } })
      .select('id username')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))

    const transjson = transactions.map(trans => ({
      order: trans.code,
      user: userMap.get(trans.user_id) || 'N/A',
      amount: trans.amount,
      thuong: trans.amount * 0.03,
      created: trans.created,
      updated: trans.updated
    }))

    res.json({
      data: transjson,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalRecords: totalCount
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/getthuongnaplandauexcel', async (req, res) => {
  try {
    const transactions = await Transactions.find({ status: 2 })
      .select('code user_id amount created updated')
      .lean()
      .sort({ created: -1 })

    const userIds = transactions.map(trans => trans.user_id)

    const users = await User.find({ id: { $in: userIds } })
      .select('id username')
      .lean()

    const userMap = new Map(users.map(user => [user.id, user.username]))

    const transjson = transactions.map(trans => ({
      code: trans.code,
      username: userMap.get(trans.user_id) || 'N/A',
      amount: trans.amount,
      thuongnaplandau: trans.amount * 0.03,
      created: trans.created,
      updated: trans.updated
    }))

    res.json(transjson)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/getlichsugd/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const transactions = await Transactions.find({ user_id: userid })
      .sort({
        id: -1
      })
      .lean()

    const transacjson = transactions.map(tran => {
      return {
        amount: tran.amount * 1000,
        type: handleType(tran.type),
        status: handlestatus(tran.status),
        created: new Date(tran.created * 1000).toLocaleDateString('vi-VN')
      }
    })

    res.json(transacjson)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' })
  }
})

router.post('/postduyetrut/:idgiaodich', async (req, res) => {
  try {
    const idgiaoddich = req.params.idgiaodich
    const transaction = await Transactions.findById(idgiaoddich)
    const user = await User.findOne({ id: transaction.user_id })
    const response = await axios.post(
      `${process.env.DOMAIN_BANK}/ruttienmomo`,
      {
        bank_code: user.bank_swift_code,
        bank_accountName: user.bank_account_name,
        bank_account: user.bank_account_number,
        callback: `${process.env.DOMAIN_BACKEND}/callbackrut`,
        amount: transaction.amount * 1000 - transaction.amount * 0.02 * 1000,
        requestId: transaction.code,
        member_identity: user.name,
        msg: ''
      }
    )
    if (response.data.stt === 1) {
      transaction.status = 1
      await transaction.save()
      return res.json(transaction)
    } else {
      console.log(response.data)
      return res.status(500).json({ message: `${response.data}` })
    }
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' })
  }
})

router.post('/postduyetrut2/:idgiaodich', async (req, res) => {
  try {
    const idgiaoddich = req.params.idgiaodich
    const transaction = await Transactions.findById(idgiaoddich)
    const user = await User.findOne({ id: transaction.user_id })
    const response = await axios.post(
      `${process.env.DOMAIN_BANK}/ruttienbank`,
      {
        BankCode: user.bank_swift_code,
        AccountName: user.bank_account_name,
        AccountNumber: user.bank_account_number,
        CallbackUrl: `${process.env.DOMAIN_BACKEND}/callbackrut`,
        Amount: transaction.amount * 1000,
        RefCode: transaction.code
      }
    )
    if (response.data.ResponseCode === 1) {
      transaction.status = 1
      await transaction.save()
      return res.json(transaction)
    } else {
      console.log(response.data)
      return res.status(500).json({ message: `${response.data.Description}` })
    }
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' })
  }
})

router.post('/postduyetrutusdt/:idgiaodich', async (req, res) => {
  try {
    const idgiaoddich = req.params.idgiaodich
    const transaction = await Transactions.findById(idgiaoddich)
    transaction.status = 1
    await transaction.save()
    res.json(transaction)
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' })
  }
})

router.get('/callbackrut', async (req, res) => {
  try {
    const { status, requestId, regAmount } = req.query

    if (status !== 'success') {
      console.log('Giao dịch thất bại')
      return res.json({ message: 'thất bại' })
    }
    const transaction = await Transactions.findOne({ code: requestId })
    const user = await User.findOne({ id: transaction.user_id })

    handelbot(
      `[CHUYỂN KHOẢN THÀNH CÔNG] mã giao dịch: ${requestId} - user: ${user.username} - số tiền: ${regAmount}`
    )

    console.log('Giao dịch thành công')
    res.json({ message: 'thành công' })
  } catch (error) {
    console.log(error)
  }
})

router.post('/callbackrut2', async (req, res) => {
  try {
    const { ResponseCode, Description, ResponseContent, Signature } = req.body

    if (!ResponseContent) {
      console.log(ResponseCode)
      console.log('Giao dịch thất bại')
      return res.json({ message: 'thất bại' })
    }
    const content = JSON.parse(ResponseContent)
    const transaction = await Transactions.findOne({ code: content.RefCode })
    const user = await User.findOne({ id: transaction.user_id })

    handelbot(
      `[CHUYỂN KHOẢN THÀNH CÔNG] mã giao dịch: ${content.RefCode} - user: ${user.username} - số tiền: ${content.Amount}`
    )

    console.log('Giao dịch thành công')
    res.json({ message: 'thành công' })
  } catch (error) {
    console.log(error)
  }
})

router.post('/capnharut', async (req, res) => {
  try {
    const transaction = await Transactions.find({ type: 'withdraw' })
    transaction.forEach(async item => {
      item.status = 1
      await item.save()
    })

    res.json({ message: 'thành công' })
  } catch (error) {
    console.log(error)
  }
})

router.post('/postduyetnap/:idgiaodich', async (req, res) => {
  try {
    const idgiaoddich = req.params.idgiaodich
    const { reason } = req.body
    const transaction = await Transactions.findById(idgiaoddich)
    const user = await User.findOne({ id: transaction.user_id })

    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' })
    }
    let daily1
    if (user.lv1.length > 0) {
      daily1 = await User.findOne({ id: user.lv1[0] })
    }

    const created = Date.now()
    const hashString = `${user.id}${transaction.amount}${created}`
    const hash = crypto.createHash('md5').update(hashString).digest('hex')
    const createdcoin = Math.floor(Date.now() / 1000)
    const lastcoin = await UserCoinLog.findOne().sort({ id: -1 })
    const newcoinId = lastcoin ? lastcoin.id + 1 : 1

    const usercoinlog = new UserCoinLog({
      id: newcoinId,
      user_id: transaction.user_id,
      amount: transaction.amount,
      reason,
      previous: user.coins,
      check: hash,
      created: createdcoin,
      updated: createdcoin
    })

    await usercoinlog.save()
    user.coins += transaction.amount
    await user.save()
    if (daily1) {
      const created1 = Date.now()
      const hashString1 = `${daily1.id}${transaction.amount * 0.01}${created1}`
      const hash1 = crypto.createHash('md5').update(hashString1).digest('hex')
      const createdcoi1n = Math.floor(Date.now() / 1000)
      const lastcoin1 = await UserCoinLog.findOne().sort({ id: -1 })
      const newcoinId1 = lastcoin1 ? lastcoin1.id + 1 : 1
      const usercoinlogdaily = new UserCoinLog({
        id: newcoinId1,
        user_id: daily1.id,
        amount: transaction.amount * 0.01,
        reason: `Bonus 1% F`,
        previous: daily1.coins,
        check: hash1,
        created: createdcoi1n,
        updated: createdcoi1n
      })
      await usercoinlogdaily.save()
      daily1.coins += transaction.amount * 0.01
      await daily1.save()
    }

    transaction.status = 1

    await transaction.save()
    res.json(transaction)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' })
  }
})

router.get('/callbacknap', async (req, res) => {
  try {
    const {
      chargeId,
      chargeType,
      chargeCode,
      regAmount,
      chargeAmount,
      signature,
      status,
      requestId,
      momoTransId
    } = req.query

    if (status !== 'success') {
      console.log('Giao dịch thất bại', status)
      return res.json({ message: 'giao dịch thất bại' })
    }

    const transaction = await Transactions.findOne({
      code: requestId
    })

    const user = await User.findOne({ id: transaction.user_id })
    let daily1
    if (user.lv1.length > 0) {
      daily1 = await User.findOne({ id: user.lv1[0] })
    }

    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' })
    }
    const created = Date.now()
    const hashString = `${user.id}${transaction.amount}${created}`
    const hash = crypto.createHash('md5').update(hashString).digest('hex')
    const createdcoin = Math.floor(Date.now() / 1000)
    const lastcoin = await UserCoinLog.findOne().sort({ id: -1 })
    const newcoinId = lastcoin ? lastcoin.id + 1 : 1

    const usercoinlog = new UserCoinLog({
      id: newcoinId,
      user_id: transaction.user_id,
      amount: transaction.amount,
      reason: `Deposit ${transaction.code}`,
      previous: user.coins,
      check: hash,
      created: createdcoin,
      updated: createdcoin
    })
    await usercoinlog.save()
    user.coins += transaction.amount
    await user.save()

    const totalTransactions = await Transactions.countDocuments({
      user_id: transaction.user_id,
      status: 1
    })

    let bonusPercent = 0
    let bonusReason = ''

    if (totalTransactions === 1) {
      bonusPercent = 0.03
      bonusReason = 'Bonus 3% Nạp lần 2 Codepay'
    }

    if (bonusPercent > 0) {
      const bonusAmount = transaction.amount * bonusPercent

      const created1 = Date.now()
      const hashString1 = `${user.id}${bonusAmount}${created1}`
      const hash1 = crypto.createHash('md5').update(hashString1).digest('hex')
      const createdcoin1 = Math.floor(Date.now() / 1000)
      const lastcoin1 = await UserCoinLog.findOne().sort({ id: -1 })
      const newcoinId1 = lastcoin1 ? lastcoin1.id + 1 : 1

      const usercoinlog1 = new UserCoinLog({
        id: newcoinId1,
        user_id: transaction.user_id,
        amount: bonusAmount,
        reason: bonusReason,
        previous: user.coins,
        check: hash1,
        created: createdcoin1,
        updated: createdcoin1
      })

      await usercoinlog1.save()
      user.coins += Number(bonusAmount)
      await user.save()
    }

    if (daily1) {
      const created1 = Date.now()
      const hashString1 = `${daily1.id}${transaction.amount * 0.01}${created1}`
      const hash1 = crypto.createHash('md5').update(hashString1).digest('hex')
      const createdcoi1n = Math.floor(Date.now() / 1000)
      const lastcoin1 = await UserCoinLog.findOne().sort({ id: -1 })
      const newcoinId1 = lastcoin1 ? lastcoin1.id + 1 : 1
      const usercoinlogdaily = new UserCoinLog({
        id: newcoinId1,
        user_id: daily1.id,
        amount: transaction.amount * 0.01,
        reason: `Bonus 1% F`,
        previous: daily1.coins,
        check: hash1,
        created: createdcoi1n,
        updated: createdcoi1n
      })
      await usercoinlogdaily.save()
      daily1.coins += transaction.amount * 0.01
      await daily1.save()
    }

    transaction.status = 1

    await transaction.save()
    console.log('Giao dịch thành công', status)
    res.json(transaction)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' })
  }
})

router.post('/callbacknap2', async (req, res) => {
  try {
    console.log('gọi call back')
    const { ResponseCode, Description, ResponseContent, Signature } = req.body

    if (!ResponseContent) {
      console.log('Giao dịch thất bại')
      return res.json({ message: 'giao dịch thất bại' })
    }
    const content = JSON.parse(ResponseContent)

    const transaction = await Transactions.findOne({
      code: content.RefCode
    })
    console.log(transaction)

    const user = await User.findOne({ id: transaction.user_id })

    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' })
    }
    let daily1
    if (user.lv1.length > 0) {
      daily1 = await User.findOne({ id: user.lv1[0] })
    }

    const created = Date.now()
    const hashString = `${user.id}${transaction.amount}${created}`
    const hash = crypto.createHash('md5').update(hashString).digest('hex')
    const createdcoin = Math.floor(Date.now() / 1000)
    const lastcoin = await UserCoinLog.findOne().sort({ id: -1 })
    const newcoinId = lastcoin ? lastcoin.id + 1 : 1

    const usercoinlog = new UserCoinLog({
      id: newcoinId,
      user_id: transaction.user_id,
      amount: transaction.amount,
      reason: `Deposit ${transaction.code}`,
      previous: user.coins,
      check: hash,
      created: createdcoin,
      updated: createdcoin
    })
    await usercoinlog.save()
    user.coins += transaction.amount
    await user.save()

    if (daily1) {
      const created1 = Date.now()
      const hashString1 = `${daily1.id}${transaction.amount * 0.01}${created1}`
      const hash1 = crypto.createHash('md5').update(hashString1).digest('hex')
      const createdcoi1n = Math.floor(Date.now() / 1000)
      const lastcoin1 = await UserCoinLog.findOne().sort({ id: -1 })
      const newcoinId1 = lastcoin1 ? lastcoin1.id + 1 : 1
      const usercoinlogdaily = new UserCoinLog({
        id: newcoinId1,
        user_id: daily1.id,
        amount: transaction.amount * 0.01,
        reason: `Bonus 1% F`,
        previous: daily1.coins,
        check: hash1,
        created: createdcoi1n,
        updated: createdcoi1n
      })
      await usercoinlogdaily.save()
      daily1.coins += transaction.amount * 0.01
      await daily1.save()
    }

    transaction.status = 1

    await transaction.save()
    res.json(transaction)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' })
  }
})

router.post('/postduyetnapcrypto/:idgiaodich', async (req, res) => {
  try {
    const idgiaoddich = req.params.idgiaodich
    const { reason } = req.body
    const transaction = await Transactions.findById(idgiaoddich)
    const user = await User.findOne({ id: transaction.user_id })

    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' })
    }

    let daily1
    if (user.lv1.length > 0) {
      daily1 = await User.findOne({ id: user.lv1[0] })
    }

    const created = Date.now()
    const hashString = `${user.id}${transaction.amount}${created}`
    const hash = crypto.createHash('md5').update(hashString).digest('hex')
    const createdcoin = Math.floor(Date.now() / 1000)
    const lastcoin = await UserCoinLog.findOne().sort({ id: -1 })
    const newcoinId = lastcoin ? lastcoin.id + 1 : 1

    const usercoinlog = new UserCoinLog({
      id: newcoinId,
      user_id: transaction.user_id,
      amount: transaction.amount,
      reason,
      previous: user.coins,
      check: hash,
      created: createdcoin,
      updated: createdcoin
    })

    await usercoinlog.save()
    user.coins += Number(transaction.amount)
    await user.save()

    const totalTransactions = await Transactions.countDocuments({
      user_id: transaction.user_id,
      status: 1
    })

    let bonusPercent = 0
    let bonusReason = ''

    if (totalTransactions === 0) {
      bonusPercent = 0.09
      bonusReason = 'Bonus 9% Nạp đầu Crypto'
    } else if (totalTransactions === 1) {
      bonusPercent = 0.03
      bonusReason = 'Bonus 3% Nạp lần 2 Crypto'
    } else {
      bonusPercent = 0
      bonusReason = ''
    }

    if (bonusPercent > 0) {
      const bonusAmount = transaction.amount * bonusPercent

      const created1 = Date.now()
      const hashString1 = `${user.id}${bonusAmount}${created1}`
      const hash1 = crypto.createHash('md5').update(hashString1).digest('hex')
      const createdcoin1 = Math.floor(Date.now() / 1000)
      const lastcoin1 = await UserCoinLog.findOne().sort({ id: -1 })
      const newcoinId1 = lastcoin1 ? lastcoin1.id + 1 : 1

      const usercoinlog1 = new UserCoinLog({
        id: newcoinId1,
        user_id: transaction.user_id,
        amount: bonusAmount,
        reason: bonusReason,
        previous: user.coins,
        check: hash1,
        created: createdcoin1,
        updated: createdcoin1
      })

      await usercoinlog1.save()
      user.coins += Number(bonusAmount)
      await user.save()
    }

    if (daily1) {
      const created2 = Date.now()
      const hashString2 = `${daily1.id}${transaction.amount * 0.01}${created2}`
      const hash2 = crypto.createHash('md5').update(hashString2).digest('hex')
      const createdcoi2n = Math.floor(Date.now() / 1000)
      const lastcoin2 = await UserCoinLog.findOne().sort({ id: -1 })
      const newcoinId2 = lastcoin2 ? lastcoin2.id + 1 : 1
      const usercoinlogdaily = new UserCoinLog({
        id: newcoinId2,
        user_id: daily1.id,
        amount: transaction.amount * 0.01,
        reason: `Bonus 1% F`,
        previous: daily1.coins,
        check: hash2,
        created: createdcoi2n,
        updated: createdcoi2n
      })
      await usercoinlogdaily.save()
      daily1.coins += transaction.amount * 0.01
      await daily1.save()
    }

    transaction.status = 1
    await transaction.save()

    res.json(transaction)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' })
  }
})

router.post('/duyetnaplandau/:idgiaodich', async (req, res) => {
  try {
    const idgiaodich = req.params.idgiaodich
    const transaction = await Transactions.findById(idgiaodich)
    const lastcoin = await UserCoinLog.findOne().sort({ id: -1 })
    const newcoinId = lastcoin ? lastcoin.id + 1 : 1

    transaction.status = 2
    let sotien = transaction.amount * NAP_DAU

    if (sotien > 3000) {
      sotien = 3000
    }
    const user = await User.findOne({ id: transaction.user_id })

    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' })
    }

    const exists = await UserCoinLog.exists({
      user_id: transaction.user_id,
      reason: `Bonus First Deposit ${transaction.code}`
    })
    if (!exists) {
      const created = Date.now()
      const hashString = `${user.id}${transaction.amount}${created}`
      const hash = crypto.createHash('md5').update(hashString).digest('hex')
      const createdcoin = Math.floor(Date.now() / 1000)
      const usercoinlog = new UserCoinLog({
        id: newcoinId,
        user_id: transaction.user_id,
        amount: sotien,
        reason: `Bonus First Deposit ${transaction.code}`,
        previous: user.coins,
        check: hash,
        created: createdcoin,
        updated: createdcoin
      })

      await usercoinlog.save()
      user.coins += sotien
      await user.save()
    }

    await transaction.save()
    res.json({ message: 'duyệt nạp lần đầu thành công' })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' })
  }
})

router.post('/ruttien/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const { amount, mkruttien, type } = req.body
    const user = await User.findById(userid)
    if (!user) {
      return res.status(400).json({ error: 'Tài khoản không tồn tại' })
    }
    if (user.status < 1) {
      return res.status(400).json({ error: 'Tài khoản đã bị khóa' })
    }
    const timeNow = Math.floor(Date.now() / 1000)
    const userIP = await getPublicIP(req, res)

    const lasTransactions = await Transactions.findOne().sort({ id: -1 })
    const newId = lasTransactions ? lasTransactions.id + 1 : 2000
    const uniqueCode = await generateUniqueCode()
    if (user.coins < amount) {
      return res.status(400).json({ error: 'Số dư không đủ' })
    }
    if (Number(mkruttien) !== user.withdrawal_password) {
      return res.status(400).json({ error: 'Mật khẩu không chính xác' })
    }
    if (user.withdrawal_password === 0) {
      return res
        .status(400)
        .json({ error: 'Bạn chưa cập nhật mật khẩu rút tiền' })
    }
    if (
      !user.bank_name ||
      !user.bank_account_name ||
      !user.bank_account_number
    ) {
      return res
        .status(400)
        .json({ error: 'Bạn chưa cập nhật tài khoản ngân hàng' })
    }
    const code = `${uniqueCode}`
    const transactions = new Transactions({
      id: newId,
      code: code,
      user_id: user.id,
      amount,
      type: type,
      bank_account: user.bank_account_number,
      bank_name: user.bank_name,
      bank_account_name: user.bank_account_name,
      ip_address: userIP,
      created: timeNow,
      updated: timeNow
    })

    console.log(userIP)
    const created = Date.now()

    const hashString = `${user.id}${amount}${created}`
    const hash = crypto.createHash('md5').update(hashString).digest('hex')
    const lastcoin = await UserCoinLog.findOne().sort({ id: -1 })
    const newcoinId = lastcoin ? lastcoin.id + 1 : 1

    const usercoinlog = new UserCoinLog({
      id: newcoinId,
      user_id: user.id,
      amount: -amount,
      reason: handelReason(type, code),
      previous: user.coins,
      check: hash,
      created: timeNow,
      updated: timeNow
    })

    await usercoinlog.save()
    await User.updateOne({ id: user.id }, { $inc: { coins: -amount } })

    handelbot(
      `[RÚT TIỀN] mã GD: ${code} Yêu cầu rút tiền từ tài khoản ${user.username} với số tiền ${amount} coin`
    )
    await transactions.save()
    res.json(transactions)
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' })
  }
})

router.post('/huyrut/:idgiaodich', async (req, res) => {
  try {
    const idgiaodich = req.params.idgiaodich
    const { message } = req.body
    const transaction = await Transactions.findById(idgiaodich)
    const user = await User.findOne({ id: transaction.user_id })
    const created = Date.now()

    const hashString = `${user.id}${transaction.amount}${created}`
    const hash = crypto.createHash('md5').update(hashString).digest('hex')
    const timeNow = Math.floor(Date.now() / 1000)
    const lastcoin = await UserCoinLog.findOne().sort({ id: -1 })
    const newcoinId = lastcoin ? lastcoin.id + 1 : 1

    const usercoinlog = new UserCoinLog({
      id: newcoinId,
      user_id: transaction.user_id,
      amount: transaction.amount,
      reason: 'Reject Withdrawal',
      previous: user.coins,
      check: hash,
      created: timeNow,
      updated: timeNow
    })

    await usercoinlog.save()
    await User.updateOne(
      { id: user.id },
      { $inc: { coins: transaction.amount } }
    )
    transaction.status = -1
    transaction.message = message
    await transaction.save()
    res.json(transaction)
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' })
  }
})

module.exports = router
