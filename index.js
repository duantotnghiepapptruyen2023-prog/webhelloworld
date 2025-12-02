const express = require('express')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const session = require('express-session')
const methodOverride = require('method-override')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const MongoStore = require('connect-mongo')
const passport = require('passport')
const imagecapcha = require('./routes/ImageCapChaRoutes')
const userRoutes = require('./routes/UserRoutes')
const trandauRoutes = require('./routes/TranDauRoutes')
const coinlogRoutes = require('./routes/CoinLogRoutes')
const pageRoutes = require('./routes/pageRoutes')
const khuyenMaiRoutes = require('./routes/KhuyenMaiRoutes')
const betroutes = require('./routes/BetRoutes')
const lichsucuoc = require('./routes/LichSuCuocRoutes')
const soccerbetroutes = require('./routes/SoccerBetRoutes')
const useradmin = require('./routes/UserAdminRoutes')
const transactions = require('./routes/TransactionsRoutes')
const userbonus = require('./routes/UserBonusRoutes')
const configroutes = require('./routes/ConfigRoutes')
const lichsugiaodich = require('./routes/LichSuGiaoDichRoutes')
const quaythuongroutes = require('./routes/QuayThuongRoutes')
const linkdomain = require('./routes/LinkdomainRoutes')
const { router } = require('./routes/sendEvent')
const { initializeNotificationAudio } = require('./routes/khoitaoamthanh')
const { doLogin, NapTuDong } = require('./routes/apibank')
const sendotp = require('./routes/sendotp')
const moment = require('moment-timezone')
require('dotenv').config()

const {
  betUpdateAction,
  bonusUpdateAction,
  bonusUpdateAgentAction
} = require('./routes/TuDongTraThuong')
const TranDau = require('./models/TranDauModel')
const { sendEvent } = require('./routes/sendEvent')

const cron = require('node-cron')

const { fetchAndSaveMatches } = require('./routes/DaoTranDau')

var path = require('path')
var app = express()
app.use(methodOverride('_method'))
const uri = process.env.mongo_db

mongoose
  .connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    maxPoolSize: 1000
  })
  .then(console.log('kết nối thành công'))

const mongoStoreOptions = {
  mongooseConnection: mongoose.connection,
  mongoUrl: uri,
  collection: 'sessions'
}

app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, '/public')))
app.use(express.static(path.join(__dirname, '/uploads')))
app.use(express.static(path.join(__dirname, '/images')))
app.use(express.static(path.join(__dirname, '/app')))

app.use(
  session({
    secret: 'mysecretkey',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create(mongoStoreOptions),
    cookie: {
      secure: false
    }
  })
)

app.use(passport.initialize())
app.use(passport.session())

app.use(
  cors({
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
)

// const allowedOrigins = [
//   'http://localhost:3000'
// ]
// const allowedIPs = ['::1', ]

// const normalizeIP = ip => {
//   if (ip?.startsWith('::ffff:')) {
//     return ip.split('::ffff:')[1]
//   }
//   return ip
// }

// app.use((req, res, next) => {
//   const origin = req.headers.origin
//   const clientIP = normalizeIP(req.ip)
//   if (!origin) {
//     return next()
//   }

//   if (origin && allowedOrigins.includes(origin)) {
//     return next()
//   }

//   if (allowedIPs.includes(clientIP)) {
//     return next()
//   }

//   return res.status(403).json({ message: 'Bạn không có quyền truy cập API' })
// })

app.use('/', imagecapcha)
app.use('/', userRoutes)
app.use('/', trandauRoutes)
app.use('/', coinlogRoutes)
app.use('/pages', pageRoutes)
app.use('/promo', khuyenMaiRoutes)
app.use('/', betroutes)
app.use('/', lichsucuoc)
app.use('/', soccerbetroutes)
app.use('/', useradmin)
app.use('/', transactions)
app.use('/', userbonus)
app.use('/', configroutes)
app.use('/', lichsugiaodich)
app.use('/', configroutes)
app.use('/', quaythuongroutes)
app.use('/', sendotp)
app.use('/', router)
app.use('/', linkdomain)

let isRunning = false
let isRunningLogin = false
// setInterval(async () => {
//   if (isRunning) return
//   isRunning = true
//   try {
//     // await betUpdateAction()
//     // await bonusUpdateAction()
//           await bonusUpdateAgentAction()

//   } catch (error) {
//     console.error('Lỗi khi cập nhật cược:', error)
//   }
//   isRunning = false
// }, 3000)

// await betUpdateAction()
// await bonusUpdateAction()

cron.schedule(
  '0 0 * * 1',
  async () => {
    if (isRunning) return
    isRunning = true

    console.log('Đang chạy bonusUpdateAction vào thứ 2')

    try {
      const now = moment().tz('Asia/Ho_Chi_Minh')
      const startOfLastWeek = now.clone().subtract(7, 'days').startOf('day')
      const endOfLastWeek = now.clone().subtract(1, 'days').endOf('day')

      await bonusUpdateAgentAction({
        fromTimestamp: Math.floor(startOfLastWeek.valueOf() / 1000),
        toTimestamp: Math.floor(endOfLastWeek.valueOf() / 1000)
      })

      console.log('Bonus update hoàn tất.')
    } catch (error) {
      console.error('Lỗi khi chạy bonusUpdateAction:', error)
    }

    isRunning = false
  },
  {
    scheduled: true,
    timezone: 'Asia/Ho_Chi_Minh' // Múi giờ Việt Nam
  }
)

// cron.schedule(
//   '*/10 * * * *',
//   async () => {
//     if (isRunningLogin) {
//       console.log('Cron job đang chạy, bỏ qua lần này.')
//       return
//     }
//     isRunningLogin = true

//     await doLogin()
//     isRunningLogin = false
//   },
//   {
//     scheduled: true,
//     timezone: 'Asia/Ho_Chi_Minh' // Múi giờ Việt Nam
//   }
// )

// cron.schedule(
//   '*/20 * * * * *',
//   async () => {
//     if (isRunning) {
//       console.log('Cron job đang chạy, bỏ qua lần này.')
//       return
//     }

//     isRunning = true
//     await NapTuDong()
//     isRunning = false
//   },
//   {
//     scheduled: true,
//     timezone: 'Asia/Ho_Chi_Minh'
//   }
// )

// doLogin()

// initializeNotificationAudio().catch(err =>
//   console.error('Error initializing audio:', err)
// )

// cron.schedule(
//   '0 8,14,23 * * *',
//   async () => {
//     console.log('Chạy cron job để lấy dữ liệu trận đấu...')
//     await fetchAndSaveMatches()
//     console.log('Hoàn thành việc lấy dữ liệu trận đấu.')
//   },
//   {
//     scheduled: true,
//     timezone: 'Asia/Ho_Chi_Minh'
//   }
// )

setInterval(async () => {
  const TIME_NOW = Math.floor(Date.now() / 1000)
  const TIME_OFFSET = 50 * 60

  const pendingGames = await TranDau.countDocuments({
    status: { $gt: 0 },
    started: { $lt: TIME_NOW - TIME_OFFSET },
    resultUpdate: 0
  })

  if (pendingGames > 0) {
    sendEvent({ event: 'có trận đấu chờ kết quả cần xử lý' })
  }
}, 72000)



if (require.main === module) {
  app.listen(3100, () => {
    console.log('kết nối thành công 3100')
  })
}
