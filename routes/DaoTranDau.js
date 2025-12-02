const axios = require('axios')
const mongoose = require('mongoose')
const TranDau = require('../models/TranDauModel')
const moment = require('moment')

const fetchAndSaveMatches = async () => {
  try {
    console.log('Bắt đầu lấy dữ liệu trận đấu...')

    for (let i = 0; i < 5; i++) {
      const date = moment().add(i, 'days').format('YYYY-MM-DD')
      console.log(`Đang lấy dữ liệu ngày: ${date}`)

      const response = await axios.get(
        `https://demo3.demoshopecom.online/game-list?date=${date}`
      )
      const games = response.data

      if (!games || games.length === 0) {
        console.log(`Không có dữ liệu trận đấu cho ngày ${date}`)
        continue
      }

      for (const game of games) {
        const existingMatch = await TranDau.findOne({ gameId: game.gameId })

        if (existingMatch) {
          console.log(`Bỏ qua trận đấu đã tồn tại: ${game.gameId} (${date})`)
          continue
        }
        const newMatch = new TranDau({
          id: game.id,
          gameId: game.gameId,
          started: game.started,
          leagueName: game.leagueName,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          tradeVolume: game.tradeVolume,
          homeIcon: game.homeIcon,
          awayIcon: game.awayIcon,
          resultH: game.resultH,
          resultC: game.resultC,
          resultUpH: game.resultUpH,
          resultUpC: game.resultUpC,
          resultUpdate: game.resultUpdate,
          created: game.created,
          updated: game.updated,
          message: game.message,
          status: game.status
        })

        await newMatch.save()
        console.log(`Đã lưu trận đấu mới: ${game.gameId} (${date})`)
      }
    }
  } catch (error) {
    console.error('Lỗi khi lấy và lưu trận đấu:', error)
  } finally {
    console.log('Hoàn thành cron job, giữ kết nối MongoDB mở.')
  }
}

module.exports = { fetchAndSaveMatches }
