const express = require('express')
const router = express.Router()
const sendOtpSMS = require('../sendOTP/sendOtp')

router.post('/send-otp', async (req, res) => {
  const { phone } = req.body
  const otp = Math.floor(100000 + Math.random() * 900000) 


  const result = await sendOtpSMS(phone, otp)

  if (result && result.CodeResult === '100') {
    res.json({ success: true, message: 'OTP sent!' })
  } else {
    res
      .status(500)
      .json({
        success: false,
        message: result?.ErrorMessage || 'SMS sending failed'
      })
  }
})

module.exports = router
