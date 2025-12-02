const axios = require('axios')

const BOT_TOKEN = '8456425771:AAEIZ7uSEQkH7R5Znrpy8XCPdprkf_mB7rI'

const CHAT_ID = '-4643481594'

async function handelbot (message) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${message}`
  try {
    const response = await axios.post(url)
    console.log('Message sent:', response.data)
  } catch (error) {
    console.error('Error sending message:', error)
  }
}

module.exports = { handelbot }
