const express = require('express')
const router = express.Router()
const User = require('../models/UserModel')
const crypto = require('crypto')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const moment = require('moment')
const { removeVietnameseAccents } = require('./XoaDauTiengViet')
const { createUser, deposit } = require('./CapNhatUserLaunchGame')
const UserCoinLog = require('../models/CoinLogModel')
const UserBonus = require('../models/UserBonusModel')
const { updateBetCoin } = require('./CapNhatUserLaunchGame')

const generateUniqueCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code
  let isDuplicate = true

  while (isDuplicate) {
    code = Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('')

    const existingUser = await User.findOne({ code })
    if (!existingUser) {
      isDuplicate = false
    }
  }

  return code
}

const getPublicIP = req => {
  try {
    const forwarded = req.headers['x-forwarded-for']
    const ip = forwarded
      ? forwarded.split(',')[0].trim() // Lấy IP đầu tiên
      : req.socket.remoteAddress
    return ip
  } catch (error) {
    console.error('Lỗi khi lấy IP:', error)
    return 'Không xác định'
  }
}

router.post('/postf1', async (req, res) => {
  try {
    const { usernamef0, usernamef1 } = req.body
    const f1 = await User.findOne({ username: usernamef1 })
    const f0 = await User.findOne({ username: usernamef0 })
    if (!f1) {
      return res.status(400).json({ message: 'f1 không tồn tại' })
    }
    if (!f0) {
      return res.status(400).json({ message: 'f0 không tồn tại' })
    }
    f1.lv1.push(f0.id)
    await f1.save()
    res.json(f1)
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/removef1', async (req, res) => {
  try {
    const { usernamef0, usernamef1 } = req.body
    const f1 = await User.findOne({ username: usernamef1 })
    const f0 = await User.findOne({ username: usernamef0 })

    if (!f1) {
      return res.status(400).json({ message: 'f1 không tồn tại' })
    }
    if (!f0) {
      return res.status(400).json({ message: 'f0 không tồn tại' })
    }

    f1.lv1 = f1.lv1.filter(id => id !== f0.id)
    await f1.save()

    res.json({ message: 'Đã xóa user khỏi lv1', f1 })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getip', async (req, res) => {
  const ip = await getPublicIP(req, res)
  res.json(ip)
})

router.post('/postlevel', async (req, res) => {
  try {
    const { type } = req.query
    const { username1, username2 } = req.body
    const user1 = await User.findOne({ username: username1 })
    const user2 = await User.findOne({ username: username2 })
    if (!user1 || !user2) {
      return res.status(400).json({ message: 'Người dùng không tồn tại' })
    }
    if (type === 'lv1') {
      user2.lv1 = [user1.id]
    }
    if (type === 'lv2') {
      user2.lv2 = [user1.id]
    }
    if (type === 'lv3') {
      user2.lv3 = [user1.id]
    }
    await user2.save()
    res.json(user2)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})

router.post('/register', async (req, res) => {
  try {
    const { username, password, code, phone } = req.body

    const existingUserByUsername = await User.findOne({ username })
    if (existingUserByUsername) {
      return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' })
    }

    const existingUserByPhone = await User.findOne({ phone })
    console.log(existingUserByPhone)
    if (existingUserByPhone) {
      return res.status(400).json({ message: 'Số điện thoại đã được đăng ký' })
    }

    const hashedPassword = crypto
      .createHash('md5')
      .update(`code-${password}-198`)
      .digest('hex')

    const uniqueCode = await generateUniqueCode()
    const timeNow = Math.floor(Date.now() / 1000)
    const userIP = await getPublicIP(req, res)

    let user
    let saved = false
    let attempts = 0
    const maxAttempts = 5

    while (!saved && attempts < maxAttempts) {
      try {
        const lastUser = await User.findOne().sort({ id: -1 })
        const newUserId = lastUser ? lastUser.id + 1 : 1

        user = new User({
          id: newUserId,
          username,
          phone,
          password: hashedPassword,
          code: uniqueCode,
          created: timeNow,
          updated: timeNow,
          last_ip: userIP,
          luotquay: 30
        })

        if (code) {
          const usercode = await User.findOne({ code: code })
          if (!usercode) {
            return res.status(400).json({ message: 'Mã mời không tồn tại' })
          }

          user.lv1 = [usercode.id]
          if (Array.isArray(usercode.lv1) && usercode.lv1.length > 0) {
            user.lv2 = [usercode.lv1[0]]
          }
          if (Array.isArray(usercode.lv2) && usercode.lv2.length > 0) {
            user.lv3 = [usercode.lv2[0]]
          }

          await usercode.save()
        }

        await user.save()
        saved = true
      } catch (err) {
        if (err.code === 11000 && err.keyPattern?.id) {
          attempts++
          continue
        } else if (err.code === 11000) {
          const field = Object.keys(err.keyValue)[0]
          return res.status(400).json({ message: `${field} đã tồn tại` })
        } else {
          console.error(err)
          return res
            .status(500)
            .json({ message: 'Lỗi máy chủ', error: err.message })
        }
      }
    }

    if (!saved) {
      return res
        .status(500)
        .json({ message: 'Tạo tài khoản thất bại sau nhiều lần thử' })
    }
    console.log(user)

    return res.json(user)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Lỗi máy chủ', error: error.message })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    const user = await User.findOne({ username })
    if (!user) {
      return res.json({ error: 'Tên đăng nhập không tồn tại' })
    }
    if (user.status === -1) {
      return res.json({ error: 'Tài khoản đã bị khóa' })
    }

    const hashedPassword = crypto
      .createHash('md5')
      .update(`code-${password}-198`)
      .digest('hex')

    if (hashedPassword !== user.password) {
      return res.json({ error: 'Mật khẩu không chính xác' })
    }

    const userIP = await getPublicIP(req, res)
    user.last_login = Math.floor(Date.now() / 1000)
    user.last_ip = userIP
    await user.save()
    console.log(userIP)

    res.json(user)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})
router.post('/postcoin/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const { coins, lydo } = req.body
    const user = await User.findById(userid)
    const createdcoin = Math.floor(Date.now() / 1000)
    const hashString = `${user.id}${Date.now()}${coins}`
    const hash = crypto.createHash('md5').update(hashString).digest('hex')
    const lastcoin = await UserCoinLog.findOne().sort({ id: -1 })
    const newcoinId = lastcoin ? lastcoin.id + 1 : 1
    const usercoin = new UserCoinLog({
      id: newcoinId,
      user_id: user.id,
      amount: coins,
      reason: lydo,
      previous: user.coins,
      created: createdcoin,
      updated: createdcoin,
      check: hash
    })
    await usercoin.save()
    user.coins += Number(coins)
    await user.save()
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

router.post('/addcoin', async (req, res) => {
  try {
    const { amount } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Số coin phải lớn hơn 0' })
    }

    const result = await User.updateMany({}, { $set: { coins: amount } })

    res.json({
      message: `Đã thêm ${amount} coin cho tất cả người dùng.`,
      modifiedCount: result.modifiedCount
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error })
  }
})

router.get('/getuser/:name', async (req, res) => {
  try {
    const name = req.params.name
    const user = await User.findOne({ username: name })
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

router.delete('/deletealluser', async (req, res) => {
  try {
    await User.deleteMany({})
    res.json({ message: 'Đã xóa toàn bộ dữ liệu trong collection User' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})
router.delete('/deleteusser/:id', async (req, res) => {
  try {
    const id = req.params.id
    await User.findByIdAndDelete(id)
    res.json({ message: 'xóa thành công' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: error.message })
  }
})

router.post('/clearuser/', async (req, res) => {
  try {
    await User.deleteMany({})
    res.json({ success: true, message: 'Đã xóa toàn bộ người dùng' })
  } catch (error) {
    console.error('Lỗi khi xóa người dùng:', error)
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
})

router.post('/import-json', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../backup/app_users.json')
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const users =
      jsonData.find(item => item.type === 'table' && item.name === 'app_users')
        ?.data || []

    const formattedUsers = users.map(user => ({
      id: parseInt(user.id, 10),
      name: user.name || null,
      username: user.username,
      password: user.password,
      withdrawal_password: parseInt(user.withdrawal_password, 10) || 0,
      country: user.country || null,
      code: user.code || null,
      email: user.email || null,
      email_verified: parseInt(user.email_verified, 10) || 0,
      phone: user.phone || null,
      phone_verified: parseInt(user.phone_verified, 10) || 0,
      coins: parseFloat(user.coins) || 0,
      bonus: parseFloat(user.bonus) || 0,
      has_bank: parseInt(user.has_bank, 10) || 0,
      bin_bank: user.bin_bank || '',
      bank_name: user.bank_name || null,
      bank_account_name: user.bank_account_name || null,
      bank_account_number: user.bank_account_number || null,
      vip: parseInt(user.vip, 10) || 0,
      lv1: user.lv1 ? [parseInt(user.lv1, 10)] : [],
      lv2: user.lv2 ? [parseInt(user.lv2, 10)] : [],
      lv3: user.lv3 ? [parseInt(user.lv3, 10)] : [],
      created: parseInt(user.created, 10) || 0,
      updated: parseInt(user.updated, 10) || 0,
      status: parseInt(user.status, 10) || 0,
      last_login: user.last_login ? parseInt(user.last_login, 10) : null,
      last_ip: user.last_ip || null
    }))

    await User.insertMany(formattedUsers)

    res.status(201).json({
      message: 'Dữ liệu từ JSON đã được nhập vào database thành công!',
      users: formattedUsers
    })
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/postuserdailygame', async (req, res) => {
  try {
    const data = {
      Username: 'VND1_dimonbet',
      Password: 'admin99hennry',
      Currency: 'VND',
      Min: 1,
      Max: 50000000,
      MaxPerMatch: 200000000,
      CasinoTableLimit: 1,
      CompanyKey: 'F1BAFEB7FE4B40E6864D4FF74F861E87',
      ServerId: '84.247.147.56'
    }

    axios
      .post(
        'https://ex-api-demo-yy.568win.com/web-root/restricted/agent/register-agent.aspx',
        data,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      .then(response => {
        console.log(response.data)
      })
      .catch(error => {
        console.error('Error:', error.message)
      })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/launch_game', async (req, res) => {
  try {
    const { portfolio, productId, device, gameProviderId, gameId, userData } =
      req.body
    if (!userData) return res.json({ link: 'https://akbet.live/login' })

    let username = removeVietnameseAccents(userData.username)
    const user = await User.findOne({ username: userData.username })
    if (!user) {
      return res.status(400).json({ message: 'Tài khoản không tồn tại' })
    }

    const companyKey = 'F1BAFEB7FE4B40E6864D4FF74F861E87'

    await createUser(username)
    await deposit(username, user.id, user.coins)

    const response = await axios.post(
      'https://ex-api-demo-yy.568win.com/web-root/restricted/player/login.aspx',
      {
        Username: username + 'akbet',
        Portfolio: portfolio,
        IsWapSports: false,
        CompanyKey: companyKey,
        ServerId: 'YY-production'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    const data = response.data
    let urlRes = 'https:' + data.url
    let urldevice = urlRes

    if (portfolio === 'Casino') {
      urldevice += `&device=${device}&productId=${productId}&locale=vi-VN`
    } else if (portfolio === 'SportsBook') {
      urldevice += `&device=${device}&lang=vi-VN`
    } else if (portfolio === 'ThirdPartySportsBook') {
      urldevice += `&gpid=${gameProviderId}&gameid=${gameId}&device=${device}&lang=vi-VN`
    } else if (portfolio === 'SeamlessGame') {
      if (gameProviderId == 7) {
        urldevice += `&gpid=${gameProviderId}&gameid=${gameId}&device=${device}&lang=vi-VN&betCode=7VND5500_7VND252500_7VND505000_7VND20010000_7VND100050000`
      } else {
        urldevice += `&gpid=${gameProviderId}&gameid=${gameId}&device=${device}&lang=vi-VN`
      }
    } else if (portfolio === 'Games') {
      urldevice += `&gameid=${gameId}&device=${device}&lang=vi-VN`
    }

    return res.json({
      status: 200,
      url: urldevice
    })
  } catch (error) {
    console.error('Lỗi khi khởi chạy game:', error.message)
    return res.status(500).json({ message: 'Có lỗi xảy ra' })
  }
})

router.post('/postdanhsachgame', async (req, res) => {
  try {
    const { GpId } = req.body
    const response = await axios.post(
      'https://ex-api-demo-yy.568win.com/web-root/restricted/information/get-game-list.aspx',
      {
        CompanyKey: 'F1BAFEB7FE4B40E6864D4FF74F861E87',
        ServerId: '207.148.116.51',
        GpId: GpId
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
    if (response.status === 200) {
      const data = response.data
      return res.json(data)
    }
  } catch (error) {
    console.error('Lỗi khi khởi chạy game:', error.message)
    return res.status(500).json({ message: 'Có lị giải xảy ra' })
  }
})


router.post('/withdraw-game', async (req, res) => {
  try {
    const { userData } = req.body
    if (!userData) {
      return res.status(400).json({ message: 'Chưa đăng nhập' })
    }

    const code = 'W2025' + Math.floor(Math.random() * 999999999999999)
    const userId = userData.id
    const username = removeVietnameseAccents(userData.username)
    const response = await axios.post(
      'https://ex-api-demo-yy.568win.com/web-root/restricted/player/withdraw.aspx',
      {
        Username: username + 'akbet',
        txnId: code,
        IsFullAmount: true,
        Amount: 0,
        CompanyKey: 'F1BAFEB7FE4B40E6864D4FF74F861E87',
        ServerId: 'YY-production'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    const data = response.data

    if (data.error.id === 0) {
      const balance = data.amount
      const parts = balance.toString().split('.')
      const beforeDot = parseInt(parts[0])

      if (balance !== 0) {
        await updateBetCoin(
          userId,
          beforeDot,
          `Rút Tiền Sảnh Game ${code}`,
          'refund'
        )
      }
    }

    return res.json({
      status: 200,
      data: data
    })
  } catch (error) {
    console.error('Lỗi khi rút tiền:', error.message)
    return res.status(500).json({ message: 'Có lỗi xảy ra' })
  }
})

router.get('/getchitietuser/:iduser', async (req, res) => {
  try {
    const iduser = req.params.iduser
    const user = await User.findById(iduser)
    console.log(user)
    let nguoigioithieu = []
    if (user.lv1) {
      if (Array.isArray(user.lv1) && user.lv1.length > 0) {
        nguoigioithieu = await User.findOne({ id: { $in: user.lv1 } })
      }
    }
    const userjson = {
      id: user.id,
      _id: user._id,
      username: user.username,
      coins: user.coins,
      code: user.code,
      bank_account_name: user.bank_account_name,
      bank_account_number: user.bank_account_number,
      bank_name: user.bank_name,
      created: user.created,
      nguoigioithieu: nguoigioithieu.username || '',
      withdrawal_password: user.withdrawal_password,
      crypto_wallet: user.cryto_wallet || '',
      phone: user.phone || '',
      luotquay: user.luotquay ? user.luotquay : 0,
      diemthuong: user.diemthuong ? user.diemthuong : 0
    }
    res.json(userjson)
  } catch (error) {
    console.log(error)
  }
})

router.get('/getfulluser', async (req, res) => {
  try {
    let { page, limit, type, sort } = req.query
    page = parseInt(page) || 1
    limit = parseInt(limit) || 20
    sort = parseInt(sort) || -1

    const skip = (page - 1) * limit

    const validSortFields = {
      STT: 'id',
      ID: 'id',
      name: 'username',
      Coin: 'coins',
      Phone: 'phone',
      Last_login: 'last_login',
      Last_ip: 'last_ip',
      Created: 'created'
    }

    const sortField = validSortFields[type] || 'id'
    const sortOrder = parseInt(sort) === 1 ? 1 : -1 // ép kiểu, mặc định là -1
    const sortCondition = { [sortField]: sortOrder }

    const query = User.find({ status: 1 })
      .sort(sortCondition)
      .skip(skip)
      .limit(limit)
      .lean()

    if (sortField === 'name') {
      query.collation({ locale: 'en', strength: 1 })
    }

    const users = await query

    const totalUsers = await User.countDocuments({ status: 1 })

    const totalCoinsResult = await User.aggregate([
      { $match: { status: 1 } },
      { $group: { _id: null, totalCoins: { $sum: '$coins' } } }
    ])

    const totalCoins =
      totalCoinsResult.length > 0 ? totalCoinsResult[0].totalCoins : 0

    const usersWithIndex = users.map((user, index) => ({
      stt: sort === -1 ? totalUsers - (skip + index) : skip + index + 1,
      ...user
    }))

    res.json({
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalCoins,
      totalUsers,
      users: usersWithIndex
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getfulluserexcel', async (req, res) => {
  try {
    const query = User.find({ status: 1 }).sort({ _id: -1 }).lean()
    const users = await query
    const totalUsers = users.length
    const usersWithIndex = users.map((user, index) => ({
      stt: totalUsers - index,
      ...user
    }))

    res.json(usersWithIndex)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getlockuser', async (req, res) => {
  try {
    let { page, limit, type, sort } = req.query
    page = parseInt(page) || 1
    limit = parseInt(limit) || 20
    const skip = (page - 1) * limit

    const validSortFields = {
      STT: 'id',
      ID: 'id',
      name: 'username',
      Coin: 'coins',
      Phone: 'phone',
      Last_login: 'last_login',
      Last_ip: 'last_ip',
      Created: 'created'
    }

    const sortField = validSortFields[type] || 'id'
    const sortOrder = parseInt(sort) === 1 ? 1 : -1 // ép kiểu, mặc định là -1
    const sortCondition = { [sortField]: sortOrder }

    const query = User.find({
      status: {
        $lt: 1
      }
    })
      .sort(sortCondition)
      .skip(skip)
      .limit(limit)
      .lean()

    if (sortField === 'name') {
      query.collation({ locale: 'en', strength: 1 })
    }

    const users = await query

    const totalUsers = await User.countDocuments({
      status: {
        $lt: 1
      }
    })

    res.json({
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
      users
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getlockuserexcel', async (req, res) => {
  try {
    const query = User.find({
      status: {
        $lt: 1
      }
    })
      .sort({ _id: -1 })
      .lean()

    const users = await query

    res.json(users)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/searchlockuser', async (req, res) => {
  try {
    let { page, limit } = req.query
    page = parseInt(page) || 1
    limit = parseInt(limit) || 20
    let query = { status: { $lt: 1 } }
    const { search } = req.body

    if (search && typeof search === 'string') {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { id: !isNaN(search) ? Number(search) : null }
      ]
    }

    const users = await User.find(query)
      .sort({ id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    const totalUsers = await User.countDocuments(query)

    res.json({
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
      users
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/postrepass/:iduser', async (req, res) => {
  try {
    const iduser = req.params.iduser
    const { password, password_old } = req.body
    const user = await User.findById(iduser)
    const hashedPassword1 = crypto
      .createHash('md5')
      .update(`code-${password_old}-198`)
      .digest('hex')
    if (hashedPassword1 !== user.password) {
      return res.status(400).json({ message: 'Mật khẩu cũ không đúng' })
    }
    const hashedPassword = crypto
      .createHash('md5')
      .update(`code-${password}-198`)
      .digest('hex')
    user.password = hashedPassword
    await user.save()
    res.json(user)
  } catch (error) {
    console.log(error)
  }
})

router.post('/checkphone', async (req, res) => {
  try {
    const { phone } = req.body
    const user = await User.findOne({ phone })
    if (!user) {
      return res.json({ error: 'Số điện thoại chưa được đăng ký' })
    }
    res.json({ message: 'success' })
  } catch (error) {
    console.log(error)
  }
})

router.post('/postquenmk', async (req, res) => {
  try {
    const { password, phone } = req.body
    const user = await User.findOne({ phone })

    if (!user) {
      return res.json({ error: 'Số điện thoại chưa được đăng ký' })
    }
    const hashedPassword = crypto
      .createHash('md5')
      .update(`code-${password}-198`)
      .digest('hex')
    user.password = hashedPassword
    await user.save()
    res.json(user)
  } catch (error) {
    console.log(error)
  }
})

router.post('/postrepassaadmin/:iduser', async (req, res) => {
  try {
    const iduser = req.params.iduser
    const { password } = req.body
    const user = await User.findById(iduser)
    const hashedPassword = crypto
      .createHash('md5')
      .update(`code-${password}-198`)
      .digest('hex')
    user.password = hashedPassword
    await user.save()
    res.json(user)
  } catch (error) {
    console.log(error)
  }
})

router.get('/getfulluserdaily/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const type = req.query.type || 'all' // f1, f2, f3, all

    const userlv1 = await User.findOne({ id: userid })

    let users = []

    if (type === 'f1') {
      users = await User.find({ 'lv1.0': userid })
    } else if (type === 'f2') {
      users = await User.find({ 'lv2.0': userid })
    } else if (type === 'f3') {
      users = await User.find({ 'lv3.0': userid })
    } else {
      users = await User.find({
        $or: [{ 'lv1.0': userid }, { 'lv2.0': userid }, { 'lv3.0': userid }]
      })
    }

    const userjson = users.map(user => {
      let level = ''

      if (
        type === 'f1' ||
        (Array.isArray(user.lv1) && user.lv1.includes(userid))
      ) {
        level = 'lv1'
      }
      if (
        type === 'f2' ||
        (Array.isArray(user.lv2) && user.lv2.includes(userid))
      ) {
        level = 'lv2'
      }
      if (
        type === 'f3' ||
        (Array.isArray(user.lv3) && user.lv3.includes(userid))
      ) {
        level = 'lv3'
      }

      return {
        daily: userlv1?.username || '',
        level,
        coin: user.coins,
        userdangky: user.username,
        created: moment.unix(user.created).format('DD-MM-YYYY')
      }
    })

    res.json(userjson)
  } catch (error) {
    console.error('Lỗi khi lấy danh sách user:', error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getf1/:userid', async (req, res) => {
  try {
    const userid = req.params.userid

    const users = await User.find({ 'lv1.0': userid })
    const userjson = users.map(user => {
      return {
        username: user.username,
        created: moment.unix(user.created).format('DD-MM-YYYY')
      }
    })

    res.json(userjson)
  } catch (error) {
    console.error('Lỗi khi lấy danh sách user:', error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/getf2f3/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const userlv1 = await User.findOne({ id: userid })

    const users = await User.find({
      $or: [{ 'lv2.0': userid }, { 'lv3.0': userid }]
    })

    const userjson = users.map(user => {
      let level = ''
      console.log(user.lv2[0])
      if (Array.isArray(user.lv2) && user.lv2.includes(userid)) {
        level = 'lv2'
      }
      if (Array.isArray(user.lv3) && user.lv3.includes(userid)) {
        level = 'lv3'
      }

      return {
        daily: userlv1.username,
        level: level,
        userdangky: user.username,
        created: moment.unix(user.created).format('DD-MM-YYYY')
      }
    })

    res.json(userjson)
  } catch (error) {
    console.error('Lỗi khi tìm user:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getsoluongf123/:userid', async (req, res) => {
  try {
    const userid = req.params.userid

    const [lv1Count, lv2Count, lv3Count] = await Promise.all([
      User.countDocuments({ 'lv1.0': userid }),
      User.countDocuments({ 'lv2.0': userid }),
      User.countDocuments({ 'lv3.0': userid })
    ])

    res.json({
      lv1: lv1Count,
      lv2: lv2Count,
      lv3: lv3Count
    })
  } catch (error) {
    console.error('Lỗi khi lấy số lượng user:', error)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/postbank/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const {
      bank_account_name,
      bank_name,
      bank_account_number,
      bank_swift_code
    } = req.body

    const user = await User.findById(userid)
    if (user.lv1.length > 0) {
      const usercode = await User.findOne({ id: user.lv1[0] })
      if (user.dacong === false) {
        usercode.luotquay += 3
        user.dacong = true
      }
      await usercode.save()
    }
    user.bank_account_name = bank_account_name
    user.bank_name = bank_name
    user.bank_account_number = bank_account_number
    user.bank_swift_code = bank_swift_code

    await user.save()
    res.json(user)
  } catch (error) {
    console.error('Lỗi :', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/postmkruttien/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const { withdrawal_password, withdrawal_password_old } = req.body

    const user = await User.findById(userid)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    if (user.withdrawal_password !== 0 && user.withdrawal_password) {
      if (!withdrawal_password_old) {
        return res
          .status(400)
          .json({ message: 'Bạn phải nhập mật khẩu rút tiền cũ' })
      }

      if (withdrawal_password_old !== user.withdrawal_password.toString()) {
        return res.status(401).json({ message: 'Mật khẩu cũ không đúng' })
      }
    }

    user.withdrawal_password = withdrawal_password
    await user.save()

    res.json({ message: 'Cập nhật mật khẩu rút tiền thành công' })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/postquenmkruttien', async (req, res) => {
  try {
    const { phone, withdrawal_password } = req.body
    const user = await User.findOne({ phone })
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }
    user.withdrawal_password = withdrawal_password
    await user.save()
    res.json({ message: 'Cập nhật mật khẩu rút tiền thành công' })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/postmkruttienadmin/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const { withdrawal_password } = req.body

    const user = await User.findById(userid)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    user.withdrawal_password = withdrawal_password
    await user.save()

    res.json({ message: 'Cập nhật mật khẩu rút tiền thành công' })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/kiemtramkbank/:userId', async (req, res) => {
  try {
    const userId = req.params.userId
    const user = await User.findById(userId)
    console.log(user)
    if (
      !user.bank_name ||
      !user.bank_account_name ||
      !user.bank_account_number
    ) {
      return res
        .status(400)
        .json({ tknh: 'Bạn chưa cập nhật tài khoản ngân hàng' })
    }

    if (user.withdrawal_password === 0) {
      return res
        .status(400)
        .json({ mkrt: 'Bạn chưa cập nhật mật khẩu rút tiền' })
    }
    res.json({ success: 'thành công' })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/kiemtramkbank2/:userId', async (req, res) => {
  try {
    const userId = req.params.userId
    const user = await User.findById(userId)
    if (
      !user.bank_name ||
      !user.bank_account_name ||
      !user.bank_account_number
    ) {
      return res
        .status(400)
        .json({ tknh: 'Bạn chưa cập nhật tài khoản ngân hàng' })
    }
    res.json({ success: 'thành công' })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/kiemtramkbankcrypto/:userId', async (req, res) => {
  try {
    const userId = req.params.userId
    const user = await User.findById(userId)
    if (!user.cryto_wallet) {
      return res.status(400).json({ crypto: 'Bạn chưa cập nhật ví điện tử' })
    }
    res.json({ success: 'thành công' })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/postphone/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const { phone } = req.body

    const user = await User.findById(userid)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }
    if (!phone) {
      return res.status(400).json({ message: 'Bạn chưa nhập số điện thoại' })
    }

    user.phone = phone
    await user.save()
    res.json(user)
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/postcryto_wallet/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const { cryto_wallet } = req.body
    const user = await User.findById(userid)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }
    if (!cryto_wallet) {
      return res
        .status(400)
        .json({ message: 'Bạn chưa nhập địa chỉ ví crypto' })
    }
    if (user.lv1.length > 0) {
      const usercode = await User.findOne({ id: user.lv1[0] })
      if (user.dacong === false) {
        usercode.luotquay += 3
        user.dacong = true
      }
      await usercode.save()
    }

    user.cryto_wallet = cryto_wallet
    await user.save()
    res.json(user)
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/postkhoauser/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const user = await User.findById(userid)

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }
    user.status = -1
    await user.save()
    res.json({ message: 'Khoá người dùng thành công' })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/postmokhoauser/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const user = await User.findById(userid)

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }
    user.status = 1
    await user.save()
    res.json({ message: 'Khoá người dùng thành công' })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getlichsudongtien/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const user = await User.findOne({ _id: userid }).select('id')
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    const [total, coinlog] = await Promise.all([
      UserCoinLog.countDocuments({ user_id: user.id }),
      UserCoinLog.find({ user_id: user.id })
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .lean()
    ])

    res.json({
      data: coinlog,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total
    })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/searchlichsudongtien/:userid', async (req, res) => {
  try {
    const userid = req.params.userid
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { search } = req.body

    // Kiểm tra user tồn tại
    const user = await User.findById(userid).lean()
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }

    // Xây dựng query
    const searchQuery = { user_id: user.id }
    if (search) {
      searchQuery.reason = { $regex: search, $options: 'i' }
    }

    // Dùng aggregation để gộp count và find
    const result = await UserCoinLog.aggregate([
      { $match: searchQuery },
      { $sort: { created: -1 } },
      {
        $facet: {
          paginatedData: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'total' }]
        }
      }
    ])

    const coinlog = result[0].paginatedData
    const total = result[0].totalCount[0]?.total || 0
    const totalPages = Math.ceil(total / limit)

    res.json({
      data: coinlog,
      currentPage: page,
      totalPages,
      totalRecords: total
    })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getlichsudongtienall/:userid', async (req, res) => {
  try {
    const userid = req.params.userid

    const user = await User.findById(userid)
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' })
    }
    const coinlog = await UserCoinLog.find({ user_id: user.id }).sort({
      _id: -1
    })

    res.json({
      data: coinlog
    })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/searchuser', async (req, res) => {
  try {
    const { keyword } = req.body
    const page = parseInt(req.query.page) || 1 // Mặc định trang 1
    const limit = parseInt(req.query.limit) || 20 // Mặc định 20 bản ghi mỗi trang

    const pageNumber = parseInt(page) || 1
    const limitNumber = parseInt(limit) || 20
    const skip = (pageNumber - 1) * limitNumber

    let query = { status: 1 }

    if (keyword) {
      const regex = new RegExp(keyword, 'i')
      query.$or = [{ username: regex }]

      if (!isNaN(keyword)) {
        query.$or.push({ id: parseInt(keyword) })
      }
    }

    const total = await User.countDocuments(query)

    const users = await User.find(query)
      .skip(skip)
      .limit(limitNumber)
      .sort({ createdAt: -1 })
      .lean() // Thêm lean() để tối ưu hiệu suất

    // Thêm STT đếm ngược
    const usersWithIndex = users.map((user, index) => ({
      stt: total - (skip + index),
      ...user
    }))

    res.json({
      currentPage: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      totalUsers: total,
      users: usersWithIndex
    })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getuserhavecoin', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, sort } = req.query
    const pageNumber = parseInt(page) || 1
    const limitNumber = parseInt(limit) || 20
    const skip = (pageNumber - 1) * limitNumber

    const total = await User.countDocuments({ coins: { $gt: 0 } })

    const validSortFields = {
      STT: 'id',
      ID: 'id',
      name: 'username',
      Coin: 'coins',
      Phone: 'phone',
      Last_login: 'last_login',
      Last_ip: 'last_ip',
      Created: 'created'
    }

    const sortField = validSortFields[type] || 'id'
    const sortOrder = parseInt(sort) === 1 ? 1 : -1
    const sortCondition = { [sortField]: sortOrder }

    const query = User.find({
      coins: {
        $gt: 0
      }
    })
      .sort(sortCondition)
      .skip(skip)
      .limit(limit)
      .lean()

    if (sortField === 'name') {
      query.collation({ locale: 'en', strength: 1 })
    }

    const users = await query

    const totalCoinsResult = await User.aggregate([
      { $match: { coins: { $gt: 0 } } },
      { $group: { _id: null, totalCoins: { $sum: '$coins' } } }
    ])

    const totalCoins =
      totalCoinsResult.length > 0 ? totalCoinsResult[0].totalCoins : 0

    res.json({
      currentPage: pageNumber,
      totalPages: Math.ceil(total / limitNumber),
      totalUsers: total,
      totalCoins,
      users
    })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getuserhavecoinexcel', async (req, res) => {
  try {
    const query = User.find({
      coins: {
        $gt: 0
      }
    })
      .sort({ id: -1 })
      .lean()

    const users = await query

    res.json(users)
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/searchuserhavecoin', async (req, res) => {
  try {
    const { keyword } = req.body
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    let query = { coins: { $gt: 0 } }

    if (keyword && keyword.trim() !== '') {
      const regex = new RegExp(keyword, 'i')
      query.$or = [{ username: regex }]

      if (!isNaN(keyword)) {
        query.$or.push({ id: parseInt(keyword) })
      }
    }

    const total = await User.countDocuments(query)

    const users = await User.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })

    res.json({
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total,
      users
    })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})
router.get('/getdaily', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    // Lấy toàn bộ user
    const users = await User.find({})
      .sort({ id: -1 })
      .select('id username coins code lv1 lv2 lv3 vip')
      .lean()

    // Lấy tất cả bonus
    const bonuses = await UserBonus.find({ status: 0 })
      .select('user_id bonus')
      .lean()

    // Tạo map tổng bonus
    const userBonusMap = new Map()
    bonuses.forEach(bonus => {
      const userId = bonus.user_id.toString()
      userBonusMap.set(userId, (userBonusMap.get(userId) || 0) + bonus.bonus)
    })

    // Tạo map thông tin user
    const userMap = new Map()
    users.forEach(user => {
      const userId = user.id.toString()
      userMap.set(userId, {
        _id: user._id,
        id: userId,
        username: user.username || '',
        coins: user.coins,
        totalBonus: userBonusMap.get(userId) || 0,
        magt: user.code || '',
        vip: user.vip || 0,
        lv1: 0,
        lv2: 0,
        lv3: 0
      })
    })

    // Tính lv1, lv2, lv3 dựa trên toàn bộ user
    users.forEach(user => {
      const userId = user.id.toString()
      user.lv1?.forEach(id => {
        const idStr = id.toString()
        if (userMap.has(idStr)) userMap.get(idStr).lv1++
      })
      user.lv2?.forEach(id => {
        const idStr = id.toString()
        if (userMap.has(idStr)) userMap.get(idStr).lv2++
      })
      user.lv3?.forEach(id => {
        const idStr = id.toString()
        if (userMap.has(idStr)) userMap.get(idStr).lv3++
      })
    })

    // Phân trang
    const result = Array.from(userMap.values())
    const totalUsers = result.length
    const paginatedResult = result.slice(skip, skip + limit)

    // Gán STT đếm ngược
    const usersWithIndex = paginatedResult.map((user, index) => ({
      stt: totalUsers - (skip + index),
      ...user
    }))

    res.json({
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
      users: usersWithIndex
    })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getdailyexcel', async (req, res) => {
  try {
    const users = await User.find({})
      .sort({ id: -1 })
      .select('id username coins code lv1 lv2 lv3 vip')
      .lean()

    const bonuses = await UserBonus.find({ status: 0 })
      .select('user_id bonus')
      .lean()

    const userBonusMap = new Map()
    bonuses.forEach(bonus => {
      const userId = bonus.user_id.toString()
      userBonusMap.set(userId, (userBonusMap.get(userId) || 0) + bonus.bonus)
    })

    const userMap = new Map()
    users.forEach(user => {
      const userId = user.id.toString()
      userMap.set(userId, {
        _id: user._id,
        id: userId,
        username: user.username || '',
        coins: user.coins,
        totalBonus: userBonusMap.get(userId) || 0,
        magt: user.code || '',
        vip: user.vip || 0,
        lv1: 0,
        lv2: 0,
        lv3: 0
      })
    })

    users.forEach(user => {
      user.lv1?.forEach(id => {
        const idStr = id.toString()
        if (userMap.has(idStr)) userMap.get(idStr).lv1++
      })
      user.lv2?.forEach(id => {
        const idStr = id.toString()
        if (userMap.has(idStr)) userMap.get(idStr).lv2++
      })
      user.lv3?.forEach(id => {
        const idStr = id.toString()
        if (userMap.has(idStr)) userMap.get(idStr).lv3++
      })
    })

    const result = Array.from(userMap.values())
    const totalUsers = result.length

    const usersWithIndex = result.map((user, index) => ({
      stt: totalUsers - index,
      ...user
    }))

    res.json(usersWithIndex)
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.get('/getReferrals/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { pageF1 = 1, limitF1 = 20, pageF2F3 = 1, limitF2F3 = 20 } = req.query

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User không tồn tại' })
    }

    const pageNumF1 = parseInt(pageF1)
    const limitNumF1 = parseInt(limitF1)
    const pageNumF2F3 = parseInt(pageF2F3)
    const limitNumF2F3 = parseInt(limitF2F3)

    const allF1 = await User.find(
      { lv1: user.id },
      'id username coins vip created'
    )
      .lean()
      .sort({ id: -1 })
    const totalF1 = allF1.length
    const F1 = allF1.slice((pageNumF1 - 1) * limitNumF1, pageNumF1 * limitNumF1)

    const allF2F3 = await User.find(
      { $or: [{ lv2: user.id }, { lv3: user.id }] },
      'id username coins vip created lv2 lv3 lv1'
    )
      .lean()
      .sort({ id: -1 })

    const lv1Ids = allF2F3
      .map(userItem => Number(userItem.lv1))
      .filter(id => !isNaN(id))

    const lv1Users = await User.find(
      { id: { $in: lv1Ids } },
      'id username'
    ).lean()

    const lv1Map = lv1Users.reduce((acc, item) => {
      acc[item.id] = item.username
      return acc
    }, {})

    const allF2F3WithLevel = allF2F3.map(userItem => ({
      ...userItem,
      hoicap: userItem.lv2.includes(user.id) ? '2' : '3',
      nguoigioithieu: lv1Map[userItem.lv1] || 'N/A'
    }))

    const totalF2F3 = allF2F3WithLevel.length

    const F2F3 = allF2F3WithLevel.slice(
      (pageNumF2F3 - 1) * limitNumF2F3,
      pageNumF2F3 * limitNumF2F3
    )

    res.json({
      F1: {
        data: F1,
        pagination: {
          currentPage: pageNumF1,
          totalPages: Math.ceil(totalF1 / limitNumF1),
          totalUsers: totalF1
        }
      },
      F2F3: {
        data: F2F3,
        pagination: {
          currentPage: pageNumF2F3,
          totalPages: Math.ceil(totalF2F3 / limitNumF2F3),
          totalUsers: totalF2F3
        }
      }
    })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/searchF1/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { page = 1, limit = 20 } = req.query
    const { query } = req.body

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User không tồn tại' })
    }

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)

    const searchCondition = {
      lv1: user.id,
      $or: isNaN(query)
        ? [{ username: { $regex: query, $options: 'i' } }]
        : [{ id: Number(query) }]
    }

    const totalF1 = await User.countDocuments(searchCondition)

    const allF1 = await User.find(
      searchCondition,
      'id username coins vip created'
    )
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean()
    console.log(allF1)
    res.json({
      F1: {
        data: allF1,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalF1 / limitNum),
          totalUsers: totalF1
        }
      }
    })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/searchF2F3/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { page = 1, limit = 20 } = req.query
    const { query } = req.body

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User không tồn tại' })
    }

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)

    const searchCondition = {
      $or: [{ lv2: user.id }, { lv3: user.id }],
      $or: isNaN(query)
        ? [{ username: { $regex: query, $options: 'i' } }]
        : [{ id: Number(query) }]
    }

    const totalF2F3 = await User.countDocuments(searchCondition)

    const allF2F3 = await User.find(
      searchCondition,
      'id username coins vip created lv2 lv3 lv1'
    )
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean()

    const lv1Ids = allF2F3
      .map(userItem => Number(userItem.lv1))
      .filter(id => !isNaN(id))

    const lv1Users = await User.find(
      { id: { $in: lv1Ids } },
      'id username'
    ).lean()

    const lv1Map = lv1Users.reduce((acc, item) => {
      acc[item.id] = item.username
      return acc
    }, {})

    const allF2F3WithLevel = allF2F3.map(userItem => ({
      ...userItem,
      hoicap: userItem.lv2.includes(user.id) ? '2' : '3',
      nguoigioithieu: lv1Map[userItem.lv1] || 'N/A'
    }))

    res.json({
      F2F3: {
        data: allF2F3WithLevel,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalF2F3 / limitNum),
          totalUsers: totalF2F3
        }
      }
    })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/postvip/:id', async (req, res) => {
  try {
    const id = req.params.id
    const { vip } = req.body
    const user = await User.findOne({ id })
    if (!user) {
      return res.status(404).json({ error: 'User không tồn tại' })
    }
    user.vip = vip
    await user.save()
    res.json({ message: 'Đã cập nhật thành công' })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/searchdaily', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { search } = req.body

    // Xây dựng query tìm kiếm
    const query = search
      ? {
          $or: [
            { username: new RegExp(search, 'i') },
            { code: new RegExp(search, 'i') }
          ]
        }
      : {}

    // Lấy danh sách user theo tìm kiếm
    const filteredUsers = await User.find(query)
      .select('id username coins code lv1 lv2 lv3 vip')
      .lean()

    if (filteredUsers.length === 0) {
      return res.json({
        currentPage: page,
        totalPages: 0,
        totalUsers: 0,
        users: []
      })
    }

    // Lấy toàn bộ user để tính lv1, lv2, lv3
    const allUsers = await User.find({})
      .select('id username coins code lv1 lv2 lv3 vip')
      .lean()

    // Lấy tất cả bonus
    const bonuses = await UserBonus.find({ status: 0 })
      .select('user_id bonus')
      .lean()

    // Tạo map tổng bonus
    const userBonusMap = new Map()
    bonuses.forEach(bonus => {
      const userId = bonus.user_id.toString()
      userBonusMap.set(userId, (userBonusMap.get(userId) || 0) + bonus.bonus)
    })

    // Tạo map thông tin user
    const userMap = new Map()
    allUsers.forEach(user => {
      const userId = user.id.toString()
      userMap.set(userId, {
        _id: user._id,
        id: userId,
        username: user.username || '',
        coins: user.coins,
        totalBonus: userBonusMap.get(userId) || 0,
        magt: user.code || '',
        vip: user.vip || 0,
        lv1: 0,
        lv2: 0,
        lv3: 0
      })
    })

    // Tính lv1, lv2, lv3 dựa trên toàn bộ user
    allUsers.forEach(user => {
      const userId = user.id.toString()
      user.lv1?.forEach(id => {
        const idStr = id.toString()
        if (userMap.has(idStr)) userMap.get(idStr).lv1++
      })
      user.lv2?.forEach(id => {
        const idStr = id.toString()
        if (userMap.has(idStr)) userMap.get(idStr).lv2++
      })
      user.lv3?.forEach(id => {
        const idStr = id.toString()
        if (userMap.has(idStr)) userMap.get(idStr).lv3++
      })
    })

    // Lọc kết quả theo danh sách tìm kiếm
    const result = filteredUsers.map(user => userMap.get(user.id.toString()))
    const totalUsers = result.length
    const paginatedResult = result.slice(skip, skip + limit)

    // Gán STT đếm ngược
    const usersWithIndex = paginatedResult.map((user, index) => ({
      stt: totalUsers - (skip + index),
      ...user
    }))

    res.json({
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
      users: usersWithIndex
    })
  } catch (error) {
    console.error('Lỗi:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

module.exports = router
