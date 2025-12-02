const gTTS = require('gtts')
const path = require('path')
const fs = require('fs')

const initializeNotificationAudio = async () => {
  const textToSpeak = 'Có trận đấu chờ kết quả cần xử lý'
  const fileName = 'trandau_notification.mp3'
  const filePath = path.join(__dirname, 'public', fileName)

  if (!fs.existsSync(filePath)) {
    const gtts = new gTTS(textToSpeak, 'vi')
    await new Promise((resolve, reject) => {
      gtts.save(filePath, err => {
        if (err) reject(err)
        else resolve()
      })
    })
    console.log(`Created ${fileName}`)
  }
}

module.exports = { initializeNotificationAudio }
