const axios = require('axios')
const Transactions = require('../models/TransactionsModel')
const User = require('../models/UserModel')
const UserCoinLog = require('../models/CoinLogModel')
const crypto = require('crypto')
async function doLogin () {
  try {
    const response = await axios.post('https://api.ae8.club/login', {
      username: '25905194THINHLV',
      password: '@Nguyenvietanh1',
      accountNumber: '8640056119'
    })

    console.log('Kết quả trả về:', response.data)
  } catch (error) {
    console.error('Lỗi khi gửi request login:', error.message)
  }
}

async function transaction () {
  try {
    const response = await axios.post('https://api.ae8.club/transactions', {
      username: '25905194THINHLV',
      password: '@Nguyenvietanh1',
      accountNumber: '8640056119'
    })

    console.log('Kết quả trả về:', response.data)
  } catch (error) {
    console.error('Lỗi khi gửi request login:', error.message)
  }
}

async function DuyetNap (idgiaoddich) {
  try {
    const transaction = await Transactions.findById(idgiaoddich)
    const user = await User.findOne({ id: transaction.user_id })

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

    transaction.status = 1

    await transaction.save()
    res.json(transaction)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi khi lấy dữ liệu' })
  }
}

async function NapTuDong () {
  try {
    const pendingTransactions = await Transactions.find({ status: 0 })
    if (pendingTransactions.length === 0) {
      console.log('Không có giao dịch chờ duyệt.')
      isRunning = false
      return
    }

    const response = await axios.post('https://api.ae8.club/transactions', {
      username: '25905194THINHLV',
      password: '@Nguyenvietanh1',
      accountNumber: '8640056119'
    })
    const transactionsFromAPI = response.data.data.data.items

    for (const pending of pendingTransactions) {
      const code = pending.code
      const amount = pending.amount

      const matchedTransaction = transactionsFromAPI.find(
        apiTrans => apiTrans.content && apiTrans.content.includes(code)
      )

      if (matchedTransaction) {
        const creditAmount = parseFloat(
          matchedTransaction.creditAmount.replace(/,/g, '')
        )

        if (amount === creditAmount / 1000) {
          console.log(
            `Tìm thấy giao dịch khớp cho code: ${code}. Đang duyệt...`
          )

          await DuyetNap(pending._id)

          console.log(`Duyệt thành công giao dịch: ${pending._id}`)
        } else {
          console.log(
            `Giao dịch ${pending._id} có số tiền không khớp, chuyển trạng thái thành -1`
          )
          pending.status = -1
          await pending.save()
        }
      }
    }
  } catch (error) {
    console.error('Lỗi khi kiểm tra hoặc duyệt giao dịch:', error.message)
  }
}

module.exports = {
  doLogin,
  transaction,
  NapTuDong
}
