const axios = require('axios')

const BOT_TOKEN = '8377036487:AAFHsbPacQFviE6pRbguRExWwCkDxBTEcnI'

const CHAT_ID = '-5155322959'

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
