const User = require('../models/UserModel')
const Bet = require('../models/BetModel')
const UserBonus = require('../models/UserBonusModel')

const getTimeRange = date => {
  const now = new Date()
  const startOfToday = Math.floor(now.setHours(0, 0, 0, 0) / 1000)
  if (date === 'today') return { startTime: startOfToday }
  if (date === 'yesterday')
    return { startTime: startOfToday - 86400, endTime: startOfToday }
  return {}
}

const getReferredByUser = async (userid, type, date, result) => {
  const numericUserId = Number(userid)
  const { startTime, endTime } = getTimeRange(date)

  let matchConditions = {
    status: {
      $gt: 0
    }
  }
  if (type === 'direct') {
    matchConditions.lv1 = numericUserId
  } else {
    matchConditions.$or = [{ lv2: numericUserId }, { lv3: numericUserId }]
  }
  if (startTime) {
    matchConditions.created = endTime
      ? { $gte: startTime, $lt: endTime }
      : { $gte: startTime }
  }

  const filteredUsers = await User.find(matchConditions)
    .select('id') 
    .lean()

  if (!filteredUsers.length) return 0

  if (result === 'count') {
    return filteredUsers.length
  }
  if (result === 'bet') {
    const userIds = filteredUsers.map(user => user.id)
    return await getResultBetByUserIds(userIds, date)
  }

  return 0
}

const getResultBetByUserIds = async (userIds, date) => {
  if (!userIds.length) return 0

  const { startTime, endTime } = getTimeRange(date)
  const matchConditions = {
    user_id: { $in: userIds },
    status: { $gt: 0 }
  }
  if (startTime) {
    matchConditions.created = endTime
      ? { $gte: startTime, $lt: endTime }
      : { $gte: startTime }
  }

  const uniqueUserIds = await Bet.aggregate([
    { $match: matchConditions },
    { $group: { _id: '$user_id' } },
    { $count: 'uniqueUsers' }
  ])

  return uniqueUserIds.length > 0 ? uniqueUserIds[0].uniqueUsers : 0
}

const getBonusByUser = async (uid, type, date) => {
  const numericUid = Number(uid)
  const { startTime, endTime } = getTimeRange(date)

  let matchConditions = { user_id: numericUid }
  if (type === 'direct') {
    matchConditions.level = 1
  } else {
    matchConditions.level = { $in: [2, 3] }
  }
  if (startTime) {
    matchConditions.created = endTime
      ? { $gte: startTime, $lt: endTime }
      : { $gte: startTime }
  }

  const bonusResult = await UserBonus.aggregate([
    { $match: matchConditions },
    { $group: { _id: null, totalBonus: { $sum: '$bonus' } } }
  ])

  const totalBonus = bonusResult.length > 0 ? bonusResult[0].totalBonus : 0
  return parseFloat(totalBonus.toFixed(2))
}

module.exports = { getReferredByUser, getBonusByUser }
