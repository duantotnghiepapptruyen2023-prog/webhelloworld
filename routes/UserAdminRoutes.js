const express = require('express')
const router = express.Router()
const UserAdmin = require('../models/UserAdminModel')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')
const checkAuth = require('../checkAuth/checkAuth')

function encryptAdminPassword (password) {
  const firstHash = crypto.createHash('md5').update(password).digest('hex')
  return crypto.createHash('md5').update(`vn-${firstHash}-1990`).digest('hex')
}
const handelrole = role => {
  if (role === 'root') {
    return 'Super Admin'
  } else if (role === 'admin') {
    return 'Admin'
  } else {
    return 'Quản lý'
  }
}

const getPublicIP = req => {
  try {
    const forwarded = req.headers['x-forwarded-for']
    const ip = forwarded
      ? forwarded.split(',')[0].trim()
      : req.socket.remoteAddress
    return ip
  } catch (error) {
    console.error('Lỗi khi lấy IP:', error)
    return 'Không xác định'
  }
}

router.post('/import-admin-users', async (req, res) => {
  try {
    console.log('Bắt đầu import dữ liệu từ JSON...')

    const filePath = path.join(__dirname, '../backup/__admin_users.json')

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File backup không tồn tại' })
    }

    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

    const users =
      jsonData.find(
        item => item.type === 'table' && item.name === '__admin_users'
      )?.data || []

    if (!users.length) {
      return res.status(400).json({ error: 'Không có dữ liệu để import' })
    }

    const formattedUsers = users.map(user => ({
      id: parseInt(user.id, 10),
      role: user.role || 'user',
      name: user.name || '',
      email: user.email || '',
      password: user.password || '',
      birthday: user.birthday || null,
      gender: user.gender || null,
      address: user.address || '',
      phone: user.phone || '',
      avatar: user.avatar || null,
      reset_token: user.reset_token || null,
      reset_expiration: user.reset_expiration
        ? parseInt(user.reset_expiration, 10)
        : null,
      created: user.created ? parseInt(user.created, 10) : null,
      updated: user.updated ? parseInt(user.updated, 10) : null,
      status: parseInt(user.status, 10) || 0
    }))

    const bulkOps = formattedUsers.map(user => ({
      updateOne: {
        filter: { id: user.id },
        update: { $set: user },
        upsert: true
      }
    }))

    await UserAdmin.bulkWrite(bulkOps)

    console.log('Import dữ liệu thành công!')
    res.status(201).json({
      message: 'Dữ liệu đã được import vào database thành công!',
      importedCount: formattedUsers.length
    })
  } catch (error) {
    console.error('Lỗi khi import dữ liệu:', error)
    res.status(500).json({ error: 'Lỗi server', details: error.message })
  }
})

router.post('/loginadmin', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await UserAdmin.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: 'Tài khoản không tồn tại' })
    }

    const hashedPassword = encryptAdminPassword(password)

    if (hashedPassword !== user.password) {
      return res.status(400).json({ message: 'Mật khẩu không chính xác' })
    }
    if (user.status === -1) {
      return res.status(400).json({ message: 'Tài khoản của bạn đã bị khóa' })
    }

    const userIP = await getPublicIP(req, res)
    user.last_login = Math.floor(Date.now() / 1000)
    user.last_ip = userIP
    await user.save()
    const token = jwt.sign({ userId: user._id, role: user.role }, 'mysecretkey')
    req.session.token = token
    await req.session.save()
    console.log('Session after saving:', req.session)

    res.json(user)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})
router.get('/auth/check', checkAuth, (req, res) => {
  res.json({
    authenticated: true,
    user: req.userData
  })
})

router.post('/postquantrivien', async (req, res) => {
  try {
    const { role, name, email, password, phone, address } = req.body
    const lastadmin = await UserAdmin.findOne().sort({ id: -1 })

    const lastcoinId = lastadmin?.id ?? 0 // Nếu không có, mặc định là 0
    const newcoinId =
      Number.isInteger(lastcoinId) && lastcoinId > 0 ? lastcoinId + 1 : 1

    const hashedPassword = encryptAdminPassword(password)
    const created = Math.floor(Date.now() / 1000).toString()
    const useradmin = await UserAdmin.findOne({ email })
    if (useradmin) {
      return res.json({ message: 'Email đã tồn tại' })
    }

    const user = new UserAdmin({
      id: newcoinId,
      role,
      name,
      email,
      password: hashedPassword,
      phone,
      address,
      created,
      updated: created
    })
    await user.save()
    res.json(user)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})



router.get('/getquantrivien', async (req, res) => {
  try {
    let { page, limit } = req.query

    page = parseInt(page) || 1
    limit = parseInt(limit) || 10

    const skip = (page - 1) * limit

    const quantrivien = await UserAdmin.find().skip(skip).limit(limit).lean()
    const total = await UserAdmin.countDocuments()

    const quantrivienjson = quantrivien.map(atv => ({
      _id: atv._id,
      id: atv.id,
      role: handelrole(atv.role),
      name: atv.name,
      email: atv.email,
      phone: atv.phone,
      address: atv.address,
      created: atv.created,
      updated: atv.updated,
      status: atv.status
    }))

    res.json({
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: quantrivienjson
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/getchitietadmin/:qtvid', async (req, res) => {
  try {
    const qtvid = req.params.qtvid
    const admin = await UserAdmin.findById(qtvid).lean()
    res.json(admin)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/updatequantrivien/:qtvid', async (req, res) => {
  try {
    const qtvid = req.params.qtvid
    const updated = Math.floor(Date.now() / 1000).toString()
    const updateData = {}

    if (req.body.role) updateData.role = req.body.role
    if (req.body.name) updateData.name = req.body.name
    if (req.body.email) updateData.email = req.body.email
    if (req.body.phone) updateData.phone = req.body.phone
    if (req.body.address) updateData.address = req.body.address
    if (req.body.password) {
      const hashedPassword = encryptAdminPassword(req.body.password)
      updateData.password = hashedPassword
    }

    updateData.updated = updated

    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({ error: 'Không có dữ liệu cần cập nhật' })
    }

    const useradmin = await UserAdmin.findByIdAndUpdate(qtvid, updateData, {
      new: true
    })

    if (!useradmin) {
      return res.status(404).json({ error: 'Không tìm thấy quản trị viên' })
    }

    res.json(useradmin)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/lockquantrivien/:qtvid', async (req, res) => {
  try {
    const qtvid = req.params.qtvid

    await UserAdmin.findByIdAndUpdate(qtvid, { status: -1 })
    res.json({ message: 'Đã khóa quản trị viên' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
