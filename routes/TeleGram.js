const axios = require('axios')

const BOT_TOKEN = '8522167212:AAEg-olcZpDEeCSPjdKlUPkbR3di-9JP6kk'

const CHAT_ID = '-5030108189'

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
