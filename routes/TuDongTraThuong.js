const Bet = require('../models/BetModel')
const TranDau = require('../models/TranDauModel')
const UserBonus = require('../models/UserBonusModel')
const UserCoinLog = require('../models/CoinLogModel')
const User = require('../models/UserModel')
const crypto = require('crypto')
const Counter = require('../models/CounterModel')
const {
  BET_FEE,
  AGENCY_LV1_BET_BONUS,
  AGENCY_LV2_BET_BONUS,
  AGENCY_LV3_BET_BONUS
} = require('../config/config')

// async function betUpdateAction (gameId) {
//   try {
//     const betData = await Bet.aggregate([
//       {
//         $match: { result: 0, status: { $gt: 0 }, gameId: gameId }
//       },
//       {
//         $lookup: {
//           from: 'trandaus',
//           localField: 'gameId',
//           foreignField: 'gameId',
//           as: 'gameData'
//         }
//       },
//       { $unwind: { path: '$gameData', preserveNullAndEmptyArrays: true } }
//     ])

//     if (betData.length === 0) return console.log('hello')

//     for (const item of betData) {
//       console.log(`Bet ID: ${item._id}`)
//       item.gameData = item.gameData
//         ? new TranDau(item.gameData).toObject({ virtuals: true })
//         : null

//       if (!item.gameData) {
//         console.log('Game không tồn tại')
//         await Bet.findByIdAndUpdate(item._id, { updated: Date.now() })
//         continue
//       }

//       const game = item.gameData
//       const {
//         resultFt,
//         resultHt,
//         resultH2t,
//         resultChanLe,
//         resultThangHoaThua,
//         resultThangHoaThuaHt
//       } = game

//       const created = Math.floor(Date.now() / 1000)

//       if (!resultFt) {
//         console.log('Game chưa có kết quả')
//         await Bet.findByIdAndUpdate(item._id, { updated: created })
//         continue
//       }

//       let result = ''
//       switch (item.betType) {
//         case '1_1':
//           result = resultFt.replace(':', '_')
//           break
//         case '1_2':
//           result = resultChanLe
//           break
//         case '1_3':
//           result = resultThangHoaThua
//           break
//         case '2_1':
//           result = resultHt.replace(':', '_')
//           break
//         case '2_3':
//           result = resultThangHoaThuaHt
//           break
//         case '3_1':
//           result = resultH2t.replace(':', '_')
//           break
//         default:
//           result = ''
//       }

//       if (result) {
//         if (['1_1', '2_1', '3_1'].includes(item.betType)) {
//           const resultConfig = [
//             '0_0',
//             '0_1',
//             '0_2',
//             '0_3',
//             '1_0',
//             '1_1',
//             '1_2',
//             '1_3',
//             '2_0',
//             '2_1',
//             '2_2',
//             '2_3',
//             '3_0',
//             '3_1',
//             '3_2',
//             '3_3'
//           ]
//           if (!resultConfig.includes(result)) {
//             result = 'Other'
//           }
//         }

//         if (result === item.gameKey) {
//           console.log(`Bet ${item._id} Thua, trận đấu ${gameId}`)
//           updateBetFailed(item._id)
//         } else {
//           console.log(`Bet ${item._id} Thắng, trận đấu ${gameId}`)
//           await updateBetWin(item._id)
//         }
//       }
//     }
//   } catch (error) {
//     console.error('Lỗi xử lý cược:', error)
//   }
// }

async function betUpdateAction (gameId) {
  try {
    const betData = await Bet.aggregate([
      {
        $match: { result: 0, status: { $gt: 0 }, gameId: gameId }
      },
      {
        $lookup: {
          from: 'trandaus',
          localField: 'gameId',
          foreignField: 'gameId',
          as: 'gameData'
        }
      },
      { $unwind: { path: '$gameData', preserveNullAndEmptyArrays: true } }
    ])

    if (betData.length === 0) return console.log('Không có kèo cần xử lý')

    for (const item of betData) {
      console.log(`Bet ID: ${item._id}`)
      item.gameData = item.gameData
        ? new TranDau(item.gameData).toObject({ virtuals: true })
        : null

      if (!item.gameData) {
        console.log('Game không tồn tại')
        await Bet.findByIdAndUpdate(item._id, { updated: Date.now() })
        continue
      }

      const game = item.gameData
      const {
        resultFt,
        resultHt,
        resultH2t,
        resultChanLe,
        resultThangHoaThua,
        resultThangHoaThuaHt
      } = game

      const created = Math.floor(Date.now() / 1000)

      if (['2_1', '2_3'].includes(item.betType)) {
        let result = ''
        if (item.betType === '2_1' && resultHt) {
          result = resultHt.replace(':', '_')
        } else if (item.betType === '2_3') {
          result = resultThangHoaThuaHt
        }

        if (result) {
          if (item.betType === '2_1') {
            const resultConfig = [
              '0_0',
              '0_1',
              '0_2',
              '0_3',
              '1_0',
              '1_1',
              '1_2',
              '1_3',
              '2_0',
              '2_1',
              '2_2',
              '2_3',
              '3_0',
              '3_1',
              '3_2',
              '3_3',
              '4_4'
            ]
            if (!resultConfig.includes(result)) result = 'Other'
          }

          if (result === item.gameKey) {
            console.log(`HT Bet ${item._id} Thua, trận đấu ${gameId}`)
            await updateBetFailed(item._id)
          } else {
            console.log(`HT Bet ${item._id} Thắng, trận đấu ${gameId}`)
            await updateBetWin(item._id)
          }

          await Bet.findByIdAndUpdate(item._id, { updated: created })
          continue
        }
      }

      if (!resultFt) {
        if (resultHt && item.betType === '1_1') {
          const [htH, htC] = resultHt.split(':').map(Number)
          const [ftH, ftC] = item.gameKey.split('_').map(Number)

          const canStillReach = htH <= ftH && htC <= ftC

          if (!canStillReach) {
            console.log(
              `FT 1_1 Bet ${item._id} Thắng sớm nhờ HT, trận đấu ${gameId}`
            )
            await updateBetWin(item._id)
            await Bet.findByIdAndUpdate(item._id, { updated: created })
            continue
          }
        }
      }

      let result = ''
      switch (item.betType) {
        case '1_1':
          result = resultFt.replace(':', '_')
          break
        case '1_2':
          result = resultChanLe
          break
        case '1_3':
          result = resultThangHoaThua
          break
        case '3_1':
          result = resultH2t.replace(':', '_')
          break
        default:
          result = ''
      }

      if (result) {
        if (['1_1', '3_1'].includes(item.betType)) {
          const resultConfig = [
            '0_0',
            '0_1',
            '0_2',
            '0_3',
            '1_0',
            '1_1',
            '1_2',
            '1_3',
            '2_0',
            '2_1',
            '2_2',
            '2_3',
            '3_0',
            '3_1',
            '3_2',
            '3_3',
            '4_4'
          ]
          if (!resultConfig.includes(result)) result = 'Other'
        }

        if (result === item.gameKey) {
          console.log(`FT Bet ${item._id} Thua, trận đấu ${gameId}`)
          await updateBetFailed(item._id)
        } else {
          console.log(`FT Bet ${item._id} Thắng, trận đấu ${gameId}`)
          await updateBetWin(item._id)
        }
      }
    }
  } catch (error) {
    console.error('Lỗi xử lý cược:', error)
  }
}

async function updateBetFailed (betID) {
  const betInfo = await Bet.findOne({ _id: betID, result: 0 })
  if (!betInfo) return false

  const { profit, amount, gameId, gameKey, user_id, created, check1 } = betInfo

  const game = await TranDau.findOne({ gameId: gameId })

  const hashString = `${user_id}${gameId}${gameKey}${amount}${profit}${created}`
  const hash = crypto.createHash('md5').update(hashString).digest('hex')
  const createdcoin = Math.floor(Date.now() / 1000)

  if (check1 === hash) return false

  if (game && game.baotoan) {
    if (
      game.baotoanvon.keo === betInfo.betType &&
      game.baotoanvon.tyso === betInfo.gameKey
    ) {
      console.log(
        `Trận đấu ${gameId} có bảo toàn, hoàn tiền cho user ${user_id}`
      )
      await updateBetCoin(
        user_id,
        amount,
        `Hoàn tiền cược mã ${betInfo.code} do bảo toàn trận đấu ${gameId}`,
        'refund'
      )
      await Bet.updateOne(
        { _id: betID },
        { result: -1, check1: hash, updated: createdcoin }
      )

      return true
    }
  }
  await Bet.updateOne(
    { _id: betID },
    { result: -1, check1: hash, updated: createdcoin }
  )

  return true
}

async function updateBetWin (betId) {
  const betInfo = await Bet.findOne({ _id: betId, result: 0 })

  const user = await User.findOne({ id: betInfo.user_id })

  if (!betInfo) return false

  const { profit, amount, gameId, gameKey, user_id, created, code, check1 } =
    betInfo
  let netProfit = ((amount * profit) / 100) * (1 - BET_FEE)
  if (netProfit < 0) netProfit = 0

  const hashString = `${user_id}${gameId}${gameKey}${amount}${profit}${created}`
  const hash = crypto.createHash('md5').update(hashString).digest('hex')
  const createdcoin = Math.floor(Date.now() / 1000)

  if (check1 === hash) {
    console.log(`Bỏ qua cập nhật vì đã tồn tại: ${betId}`)
    return false
  }

  await Bet.updateOne(
    { _id: betId },
    { result: 1, check1: hash, updated: createdcoin }
  )

  await updateBetCoin(
    user_id,
    amount + netProfit,
    `Thắng Cược Mã ${code}`,
    'add'
  )

  if (netProfit > 0 && user) {
    const { lv1, lv2, lv3 } = user

    if (lv1 && Array.isArray(lv1) && lv1.length > 0) {
      const lv1Id = lv1.length === 1 ? lv1[0] : lv1
      const addBonus = netProfit * AGENCY_LV1_BET_BONUS
      await updateBonus(lv1Id, addBonus)
      await addBetBonus(lv1Id, addBonus, code, user_id, 1, 'Thắng cược', 1)
    }

    if (lv2 && Array.isArray(lv2) && lv2.length > 0) {
      const lv2Id = lv2.length === 1 ? lv2[0] : lv2
      const addBonus = netProfit * AGENCY_LV2_BET_BONUS
      await addBetBonus(lv2Id, addBonus, code, user_id, 2, 'Thắng cược', 0)
    }

    if (lv3 && Array.isArray(lv3) && lv3.length > 0) {
      const lv3Id = lv3.length === 1 ? lv3[0] : lv3
      const addBonus = netProfit * AGENCY_LV3_BET_BONUS
      await addBetBonus(lv3Id, addBonus, code, user_id, 3, 'Thắng cược', 0)
    }
  }

  return true
}

async function getNextSequence (name) {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  )
  return counter.seq
}

async function updateBetCoin (userId, amount, reason, type = 'add') {
  let user = await User.findOne({ id: userId })
  if (!user) return false
  let updated = false
  const newcoinId = await getNextSequence('usercoinlog')

  const created = Date.now()
  const hashString = `${userId}${created}${amount}`
  const hash = crypto.createHash('md5').update(hashString).digest('hex')
  const createdcoin = Math.floor(Date.now() / 1000)

  if (type === 'add') {
    const exists = await UserCoinLog.exists({ user_id: userId, reason })
    if (!exists) {
      const updatedUser = await User.findOneAndUpdate(
        { id: userId },
        { $inc: { coins: amount } },
        { new: true }
      )

      const usercoinlog = new UserCoinLog({
        id: newcoinId,
        user_id: userId,
        amount,
        reason,
        previous: updatedUser.coins - amount,
        check: hash,
        created: createdcoin,
        updated: createdcoin
      })

      await usercoinlog.save()
      updated = true
    }
  }

  if (type === 'sub') {
    if (user.coins - amount >= 0) {
      const exists = await UserCoinLog.exists({ user_id: userId, reason })
      if (!exists) {
        const usercoinlog = new UserCoinLog({
          id: newcoinId,
          user_id: userId,
          amount,
          reason,
          previous: user.coins,
          check: hash,
          created: createdcoin,
          updated: createdcoin
        })

        user.coins -= amount
        await usercoinlog.save()
        await user.save()
        updated = true
      }
    }
  }

  if (type === 'refund') {
    const exists = await UserCoinLog.exists({ user_id: userId, reason })
    if (!exists) {
      const updatedUser = await User.findOneAndUpdate(
        { id: userId },
        { $inc: { coins: amount } },
        { new: true }
      )

      const usercoinlog = new UserCoinLog({
        id: newcoinId,
        user_id: userId,
        amount,
        reason,
        previous: updatedUser.coins - amount,
        check: hash,
        created: createdcoin,
        updated: createdcoin
      })
      await usercoinlog.save()

      console.log(updatedUser.coins)
      updated = true
    }
  }

  return updated
}

async function addBetBonus (
  userId,
  bonus,
  code,
  referrerId,
  level,
  description,
  status = 0
) {
  try {
    const existingBonus = await UserBonus.findOneAndUpdate(
      {
        user_id: userId,
        action: code,
        referrer_id: referrerId,
        level: level
      },
      {
        $setOnInsert: {
          user_id: userId,
          type: 'bet',
          target: 'agent',
          action: code,
          bonus: bonus,
          description: description,
          referrer_id: referrerId,
          level: level,
          status: status,
          created: Math.floor(Date.now() / 1000),
          updated: Math.floor(Date.now() / 1000)
        }
      },
      {
        upsert: true,
        returnDocument: 'before' // Trả về dữ liệu trước khi cập nhật
      }
    )

    if (!existingBonus) {
      console.log(
        `Thêm thưởng cược thành công cho User ${userId}, Action: ${code}`
      )
      return true
    } else {
      console.log(
        `Thưởng cược đã tồn tại, bỏ qua. User: ${userId}, Action: ${code}`
      )
      return false
    }
  } catch (error) {
    console.error('Lỗi khi thêm thưởng cược:', error)
    return false
  }
}

async function updateBonus (userId, amount) {
  try {
    const result = await User.updateOne(
      { id: userId, status: { $gt: 0 } },
      { $inc: { bonus: amount } }
    )
    return result.modifiedCount > 0
  } catch (error) {
    console.error('Lỗi khi cập nhật bonus:', error)
    return false
  }
}

async function bonusUpdateAction () {
  try {
    const bonusData = await UserBonus.find({ type: 'bet', status: 1 })
    if (bonusData.length === 0) {
      return false
    }

    for (const item of bonusData) {
      const locked = await UserBonus.updateOne(
        { _id: item._id, status: 1 },
        { $set: { status: 9 } }
      )
      if (locked.modifiedCount === 0) continue

      const result = await updateCoin(
        item.user_id,
        item.bonus,
        `Bonus cược thắng ${item.action}`
      )

      const finalStatus = result ? 2 : 1
      await UserBonus.updateOne(
        { _id: item._id },
        { $set: { status: finalStatus } }
      )
    }

    console.log('Bonus Update Action completed.')
  } catch (error) {
    console.error('Error in Bonus Update Action:', error)
  }
}

async function bonusUpdateAgentAction ({ fromTimestamp, toTimestamp }) {
  try {
    const bonusData = await UserBonus.find({
      type: 'bet',
      status: 0,
      created: {
        $gte: fromTimestamp,
        $lte: toTimestamp
      }
    })

    if (bonusData.length === 0) {
      console.log(
        'Không có dữ liệu thưởng trong khoảng thời gian được chỉ định.'
      )
      return false
    }

    const groupedByDate = bonusData.reduce((acc, item) => {
      const createdDate = new Date(item.created * 1000)
        .toISOString()
        .split('T')[0]

      if (!acc[createdDate]) {
        acc[createdDate] = {}
      }

      if (!acc[createdDate][item.user_id]) {
        acc[createdDate][item.user_id] = {
          user_id: item.user_id,
          totalBonus: 0,
          bonusIds: []
        }
      }

      acc[createdDate][item.user_id].totalBonus += item.bonus
      acc[createdDate][item.user_id].bonusIds.push(item._id)

      return acc
    }, {})

    for (const date of Object.keys(groupedByDate)) {
      const mergedBonuses = Object.values(groupedByDate[date])

      for (const item of mergedBonuses) {
        const hash = crypto
          .createHash('md5')
          .update(item.bonusIds.join(','))
          .digest('hex')
          .slice(0, 8)
        const reason = `Tổng nhận đại lý F2+F3 ngày ${date} - ${hash}`

        await updateCoin(item.user_id, item.totalBonus, reason)
      }
    }

    await UserBonus.updateMany(
      {
        type: 'bet',
        status: 0,
        created: {
          $gte: fromTimestamp,
          $lte: toTimestamp
        }
      },
      { $set: { status: 2, updated: Math.floor(Date.now() / 1000) } }
    )

    console.log('Bonus Update Action completed.')
  } catch (error) {
    console.error('Error in Bonus Update Action:', error)
  }
}

async function updateCoin (userId, amount, note = '') {
  try {
    const user = await User.findOne({ id: userId })
    if (!user) return false

    const createdcoin = Math.floor(Date.now() / 1000)

    const hashString = `${userId}${amount}${createdcoin}`
    const hash = crypto.createHash('md5').update(hashString).digest('hex')
    const lastcoin = await UserCoinLog.findOne().sort({ id: -1 })
    const newcoinId = lastcoin ? lastcoin.id + 1 : 1

    const exists = await UserCoinLog.exists({
      user_id: userId,
      amount,
      reason: note,
      previous: user.coins,
      check: hash,
      created: createdcoin,
      updated: createdcoin
    }).session()

    let updated = 0
    if (!exists) {
      const usercoinlog = new UserCoinLog({
        id: newcoinId,
        user_id: userId,
        amount,
        reason: note,
        previous: user.coins,
        check: hash,
        created: createdcoin,
        updated: createdcoin
      })

      try {
        await usercoinlog.save()
      } catch (error) {
        if (error.code === 11000) {
          console.log('Bản ghi trùng lặp, bỏ qua...')
          return false
        }
        throw error
      }

      const result = await User.updateOne(
        { id: userId },
        { $inc: { coins: amount } }
      )
      updated = result.modifiedCount
    }

    return updated > 0
  } catch (error) {
    console.error('Error in updateCoin:', error)
    return false
  }
}

async function updateBetWindephong (betId) {
  const betInfo = await Bet.findOne({ _id: betId, result: -1 })

  const user = await User.findOne({ id: betInfo.user_id })

  if (!betInfo) return false

  const { profit, amount, gameId, gameKey, user_id, created, code, check1 } =
    betInfo
  let netProfit = ((amount * profit) / 100) * (1 - BET_FEE)
  if (netProfit < 0) netProfit = 0

  const hashString = `${user_id}${gameId}${gameKey}${amount}${profit}${created}`
  const hash = crypto.createHash('md5').update(hashString).digest('hex')
  const createdcoin = Math.floor(Date.now() / 1000)

  // if (check1 === hash) {
  //   console.log(`Bỏ qua cập nhật vì đã tồn tại: ${betId}`)
  //   return false
  // }

  await Bet.updateOne(
    { _id: betId },
    { result: 1, check1: hash, updated: createdcoin }
  )

  await updateBetCoin(
    user_id,
    amount + netProfit,
    `Thắng Cược Mã ${code}`,
    'add'
  )

  if (netProfit > 0 && user) {
    const { lv1, lv2, lv3 } = user

    if (lv1 && Array.isArray(lv1) && lv1.length > 0) {
      const lv1Id = lv1.length === 1 ? lv1[0] : lv1
      const addBonus = netProfit * AGENCY_LV1_BET_BONUS
      await updateBonus(lv1Id, addBonus)
      await addBetBonus(lv1Id, addBonus, code, user_id, 1, 'Thắng cược', 1)
    }

    if (lv2 && Array.isArray(lv2) && lv2.length > 0) {
      const lv2Id = lv2.length === 1 ? lv2[0] : lv2
      const addBonus = netProfit * AGENCY_LV2_BET_BONUS
      await addBetBonus(lv2Id, addBonus, code, user_id, 2, 'Thắng cược', 0)
    }

    if (lv3 && Array.isArray(lv3) && lv3.length > 0) {
      const lv3Id = lv3.length === 1 ? lv3[0] : lv3
      const addBonus = netProfit * AGENCY_LV3_BET_BONUS
      await addBetBonus(lv3Id, addBonus, code, user_id, 3, 'Thắng cược', 0)
    }
  }

  return true
}

async function updateBetFailedDephong (betID) {
  const betInfo = await Bet.findOne({ _id: betID, result: 1 })
  if (!betInfo) return false

  const { profit, amount, gameId, gameKey, user_id, created } = betInfo

  const game = await TranDau.findOne({ gameId: gameId })

  const hashString = `${user_id}${gameId}${gameKey}${amount}${profit}${created}`
  const hash = crypto.createHash('md5').update(hashString).digest('hex')
  const createdcoin = Math.floor(Date.now() / 1000)

  // if (check1 === hash) return false

  // if (game && game.baotoan) {
  //   if (
  //     game.baotoanvon.keo === betInfo.betType &&
  //     game.baotoanvon.tyso === betInfo.gameKey
  //   ) {
  //     console.log(
  //       `Trận đấu ${gameId} có bảo toàn, hoàn tiền cho user ${user_id}`
  //     )
  //     await updateBetCoin(
  //       user_id,
  //       amount,
  //       `Hoàn tiền cược mã ${betInfo.code} do bảo toàn trận đấu ${gameId}`,
  //       'refund'
  //     )
  //     await Bet.updateOne(
  //       { _id: betID },
  //       { result: -1, check1: hash, updated: createdcoin }
  //     )

  //     return true
  //   }
  // }
  await Bet.updateOne(
    { _id: betID },
    { result: -1, check1: hash, updated: createdcoin }
  )

  return true
}

module.exports = {
  betUpdateAction,
  bonusUpdateAction,
  bonusUpdateAgentAction,
  updateBetWindephong,
  updateBetFailedDephong
}
