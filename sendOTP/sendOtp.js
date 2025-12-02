const axios = require('axios')

async function sendOtpSMS (phone, otpCode) {
  const API_KEY = 'AD092DD96B675B2FE87F95084CE6F3'
  const SECRET_KEY = '607E079F171AF45FBDB6877A60073F'
  const BRANDNAME = ''

  const content = `Ma xac nhan cua ban la: ${otpCode}`

  const params = new URLSearchParams()
  params.append('ApiKey', API_KEY)
  params.append('SecretKey', SECRET_KEY)
  params.append('Phone', phone)
  params.append('Content', content)
  params.append('SmsType', '4') // 2 = OTP
  params.append('Brandname', BRANDNAME)

  try {
    const response = await axios.get(
      'https://api.esms.vn/MainService.svc/json/SendMultipleMessage_V4_get',
      { params }
    )
    return response.data
  } catch (err) {
    console.error('Error sending SMS:', err)
    return null
  }
}

module.exports = sendOtpSMS
