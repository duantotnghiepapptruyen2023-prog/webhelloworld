// if (resultHt && item.betType === '1_1') {
//   const [htH, htC] = resultHt.split(':').map(Number)
//   const [ftH, ftC] = item.gameKey.split('_').map(Number)

//   const canStillReach = htH <= ftH && htC <= ftC

//   if (!canStillReach) {
//     console.log(`FT 1_1 Bet ${item._id} Thắng sớm nhờ HT`)
//     await updateBetWin(item._id)
//     await Bet.findByIdAndUpdate(item._id, { updated: created })
//     continue
//   }
// }

// // if (resultHt && item.betType === '1_3') {
// //   const [htH, htC] = resultHt.split(':').map(Number)
// //   const betResult = item.gameKey

// //   const htOutcome = htH > htC ? 'H' : htH < htC ? 'A' : 'D'
// //   const goalDiff = Math.abs(htH - htC)

// //   if (goalDiff >= 3 && betResult !== htOutcome) {
// //     console.log(`FT 1_3 Bet ${item._id} Thắng sớm nhờ HT`)
// //     await updateBetWin(item._id)
// //     await Bet.findByIdAndUpdate(item._id, { updated: created })
// //     continue
// //   }
// // }
