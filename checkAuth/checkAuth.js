const jwt = require('jsonwebtoken')

const checkAuth = (req, res, next) => {
  if (!req.session || !req.session.token) {
    return res.status(401).json({ message: 'Chưa đăng nhập!' })
  }

  try {
    const decoded = jwt.verify(req.session.token, 'mysecretkey', { expiresIn: '1h' })

    req.userData = decoded

    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      req.session.destroy()
      return res
        .status(401)
        .json({
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!'
        })
    } else {
      console.error(error)
      return res.status(500).json({ message: 'Đã xảy ra lỗi.' })
    }
  }
}

module.exports = checkAuth
