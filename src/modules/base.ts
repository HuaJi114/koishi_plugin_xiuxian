import { Context, Session } from 'koishi'
import { Config } from '../config'
import { ADMIN_AUTHORITY, breakthrough, getAtId } from '../helpers'
import { formatPresetSectList, formatSectRegisterPrompt } from '../preset-sects'
import { buildFighter } from '../combat-stats'
import { BATTLE_DETAIL_HINT, getBattleDetail, storeBattleDetail } from '../battle-detail'
import { dateDiffSeconds, generateRoot, getPowerRate, isHeavilyInjured, numberTo, playerFight, randInt } from '../utils'

const REGISTER_PROMPT_MS = 120_000

const HEAVY_INJURY_HINT = '气血归零，已进入重伤状态，需【闭关】并【出关】后方可恢复。'

/** 建号后引导用户选择加入宗门或成为散修 */
async function promptSectChoice(session: Session, srv: Context['xiuxian']): Promise<string> {
  await session.send(formatSectRegisterPrompt())

  let choice = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    choice = (await session.prompt(REGISTER_PROMPT_MS))?.trim() ?? ''
    if (!choice) break
    if (choice === '加入宗门' || choice === '成为散修') break
    await session.send('请回复【加入宗门】或【成为散修】。')
  }

  if (!choice) {
    return '选择超时，你暂为散修。日后可发送【宗门列表】查看宗门，或使用【加入宗门 <编号>】加入。'
  }
  if (choice === '成为散修') {
    return '你已选择成为散修，逍遥天地间。发送【宗门列表】可查看宗门，或【创建宗门】开创基业。'
  }

  await session.send(formatPresetSectList())
  for (let attempt = 0; attempt < 5; attempt++) {
    const sectName = (await session.prompt(REGISTER_PROMPT_MS))?.trim() ?? ''
    if (!sectName) break
    const result = await srv.joinSectByName(session.userId!, sectName)
    if (result.startsWith('未找到宗门')) {
      await session.send(`${result}\n请重新回复宗门全名。`)
      continue
    }
    return result
  }
  return '选择超时，你暂为散修。请使用【宗门列表】查看编号后【加入宗门 <编号>】加入。'
}

/** 核心指令模块：账号、签到、突破、灵石互动、排行榜等 */
export function applyBase(ctx: Context, config: Config) {
  const srv = ctx.xiuxian

  ctx.command('xiuxian', '修仙模拟器')

  // 我要修仙
  ctx.command('xiuxian/我要修仙', '加入修仙世界')
    .alias('修仙')
    .action(async ({ session }) => {
      const [root, rootType] = generateRoot(srv.data)
      const rootSpeed = srv.data.roots[rootType]?.type_speeds ?? 1
      const power = Math.floor(100 * rootSpeed)
      const userName = session!.username || session!.userId!
      const result = await srv.createPlayer(session!, root, rootType, power, userName)
      if (result.includes('已迈入')) return result
      await session!.send(result)
      return promptSectChoice(session!, srv)
    })

  // 修仙签到
  ctx.command('xiuxian/修仙签到', '每日签到获取灵石')
    .action(async ({ session }) => srv.sign(session!.userId!, session!.platform))

  // 重入仙途（洗灵根）
  ctx.command('xiuxian/重入仙途', `清除全部修仙数据并重新建号（消耗 ${config.remakeCost} 灵石，保留灵石）`)
    .action(async ({ session }) => {
      const player = await srv.getPlayer(session!.userId!)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      return srv.wipeAndRemake(session!.userId!, session!.platform)
    })

  // 改名
  ctx.command('xiuxian/改名 <name:text>', '修改你的道号')
    .action(async ({ session }, name) => {
      const player = await srv.getPlayer(session!.userId!)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      name = (name ?? '').trim()
      if (!name) return '请输入要修改的道号！'
      if (Buffer.byteLength(name, 'utf-8') > 30) return '道号长度过长，请修改后重试！'
      return srv.setUserName(session!.userId!, name)
    })

  // 我的突破概率
  ctx.command('xiuxian/我的突破概率', '查询下次突破成功率')
    .alias('突破概率')
    .action(async ({ session }) => {
      const player = await srv.getPlayer(session!.userId!)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      const rate = srv.data.getLevelRate(player.level) + player.levelUpRate
      return `道友下一次突破成功概率为${rate}%`
    })

  // 突破（提示）
  ctx.command('xiuxian/突破', '准备突破境界')
    .action(async ({ session }) => {
      const player = await srv.getPlayer(session!.userId!)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      const cdMsg = checkLevelCd(player.levelUpCd, config.levelUpCd)
      if (cdMsg) return cdMsg
      const rate = srv.data.getLevelRate(player.level) + player.levelUpRate
      const backs = await srv.getBack(session!.userId!)
      const hasPill = backs.some((b) => Number(b.goodsId) === 1999)
      if (hasPill) {
        return `由于检测到背包有渡厄丹，突破已经准备就绪，请发送【渡厄突破】或【直接突破】来选择是否使用丹药突破！本次突破概率为：${rate}%`
      }
      return `由于检测到背包没有【渡厄丹】，突破已经准备就绪，请发送【直接突破】来突破！请注意，本次突破失败将会损失部分修为，本次突破概率为：${rate}%`
    })

  // 直接突破
  ctx.command('xiuxian/直接突破', '不使用丹药直接突破')
    .action(async ({ session }) => doBreakthrough(session!.userId!, false))

  // 渡厄突破
  ctx.command('xiuxian/渡厄突破', '使用渡厄丹突破')
    .action(async ({ session }) => doBreakthrough(session!.userId!, true))

  async function doBreakthrough(userId: string, useDuE: boolean): Promise<string> {
    const player = await srv.getPlayer(userId)
    if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
    if (!player.hp) await srv.resetState(userId)
    const cdMsg = checkLevelCd(player.levelUpCd, config.levelUpCd)
    if (cdMsg) return cdMsg
    const level = player.level
    const baseRate = srv.data.getLevelRate(level)
    const rate = baseRate + player.levelUpRate
    const result = breakthrough(srv.data, player.exp, rate, level)

    if (result.type === 'top') return '道友已是最高境界，无法突破！'
    if (result.type === 'lack') {
      return `道友的修为不足以突破！距离下次突破需要${result.needExp}修为！突破境界为：${result.nextLevel}`
    }

    if (result.type === 'success') {
      await srv.setLevel(userId, result.nextLevel)
      await srv.updatePower(userId)
      await srv.setLevelCd(userId)
      await srv.setLevelRate(userId, 0)
      await srv.resetState(userId)
      return `恭喜道友突破${result.nextLevel}成功`
    }

    // 失败
    await srv.setLevelCd(userId)
    const updateRate = Math.max(1, Math.floor(baseRate * config.levelUpProbability))
    const backs = await srv.getBack(userId)
    const hasPill = backs.some((b) => Number(b.goodsId) === 1999)
    if (useDuE && hasPill) {
      await srv.reduceBack(userId, 1999, 1, 1)
      await srv.setLevelRate(userId, player.levelUpRate + updateRate)
      return `道友突破失败，但是使用了渡厄丹，本次突破失败不扣除修为，下次突破成功率增加${updateRate}%，道友不要放弃！`
    }
    const percentage = randInt(config.levelPunishmentFloor, config.levelPunishmentLimit)
    const lostExp = Math.floor(player.exp * (percentage / 100))
    await srv.reduceExp(userId, lostExp)
    const nowHp = Math.max(player.hp - lostExp / 2, 1)
    const nowMp = Math.max(player.mp - lostExp, 1)
    await srv.setHpMp(userId, nowHp, nowMp)
    await srv.setLevelRate(userId, player.levelUpRate + updateRate)
    return `道友突破失败，境界受损，修为减少${lostExp}，下次突破成功率增加${updateRate}%，道友不要放弃！`
  }

  // 送灵石
  ctx.command('xiuxian/送灵石 <amount:integer>', '赠送灵石给他人')
    .action(async ({ session }, amount) => {
      const player = await srv.getPlayer(session!.userId!)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!amount || amount <= 0) return '请输入正确的灵石数量！'
      const targetId = getAtId(session!)
      if (!targetId) return '请 @ 要赠送的道友！'
      if (targetId === session!.userId) return '请不要送灵石给自己！'
      const target = await srv.getPlayer(targetId)
      if (!target) return '对方未踏入修仙界，不可赠送！'
      const pf = session!.platform
      const stone = await srv.getStoneForUser(player.userId, pf)
      if (amount > stone) return '道友的灵石不够，请重新输入！'
      const tax = Math.floor(amount * config.giveStoneTax)
      if (!(await srv.costStoneForUser(player.userId, amount, pf))) return '道友的灵石不够，请重新输入！'
      await srv.gainStoneForUser(target.userId, amount - tax, pf)
      return `共赠送${amount}枚灵石给${target.userName}道友！收取手续费${tax}枚`
    })

  // 偷灵石
  ctx.command('xiuxian/偷灵石', '尝试偷取他人灵石')
    .alias('飞龙探云手')
    .action(async ({ session }) => {
      const player = await srv.getPlayer(session!.userId!)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      const targetId = getAtId(session!)
      if (!targetId) return '请 @ 要下手的道友！'
      if (targetId === session!.userId) return '请不要偷自己刷成就！'
      const target = await srv.getPlayer(targetId)
      if (!target) return '对方未踏入修仙界，不要对杂修出手！'
      const pf = session!.platform
      const myStone = await srv.getStoneForUser(player.userId, pf)
      if (config.stealCost > myStone) return '道友的偷窃准备(灵石)不足，请打工之后再切格瓦拉！'
      const result = getPowerRate(player.power, target.power)
      if (typeof result === 'string') return result
      if (randInt(0, 100) > result) {
        await srv.costStoneForUser(player.userId, config.stealCost, pf)
        await srv.gainStoneForUser(target.userId, config.stealCost, pf)
        return `道友偷窃失手了，被对方发现并罚款${config.stealCost}灵石！`
      }
      const targetStone = await srv.getStoneForUser(target.userId, pf)
      let got = randInt(Math.floor(config.stealLowerLimit * targetStone), Math.floor(config.stealUpperLimit * targetStone))
      if (got > targetStone) got = targetStone
      if (got <= 0) return `${target.userName}道友身无分文，无从下手~`
      await srv.costStoneForUser(target.userId, got, pf)
      await srv.gainStoneForUser(player.userId, got, pf)
      return `共偷取${target.userName}道友${got}枚灵石！`
    })

  // 抢劫（决斗）
  ctx.command('xiuxian/抢劫', '与他人决斗抢夺灵石')
    .alias('抢灵石')
    .action(async ({ session }) => {
      let player = await srv.getRealPlayer(session!.userId!)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (player.root === '器师') return '目前职业无法抢劫！'
      const targetId = getAtId(session!)
      if (!targetId) return '请 @ 要抢劫的道友！'
      if (targetId === session!.userId) return '请不要抢自己刷成就！'
      let target = await srv.getRealPlayer(targetId)
      if (!target) return '没有对方的信息！'
      if (target.root === '器师') return '对方职业无法被抢劫！'
      const basePlayer = (await srv.getPlayer(session!.userId!))!
      const baseTarget = (await srv.getPlayer(targetId))!
      if (isHeavilyInjured(baseTarget.exp, baseTarget.hp)) return '对方重伤藏匿了，无法抢劫！'
      if (isHeavilyInjured(basePlayer.exp, basePlayer.hp)) return '重伤未愈，动弹不得！'

      const f1 = await buildFighter(srv, session!.userId!)
      const f2 = await buildFighter(srv, targetId)
      if (!f1 || !f2) return '战斗数据异常，请稍后再试！'
      const [log, victor, finalHp] = playerFight(f1, f2, srv.data)
      storeBattleDetail({
        kind: 'rob',
        userId: player.userId,
        otherId: target.userId,
        detail: log.join('\n'),
      })
      await srv.applyBattleHp(player.userId, finalHp[player.userId])
      await srv.applyBattleHp(target.userId, finalHp[target.userId])

      const pf = session!.platform
      const appendInjury = (msg: string, selfHp: number, foeHp: number, foeName: string): string => {
        if (selfHp <= 0) return `${msg}\n${HEAVY_INJURY_HINT}`
        if (foeHp <= 0) return `${msg}\n${foeName}气血归零，已进入重伤状态。`
        return msg
      }
      if (victor === player.userName) {
        const foeStone = await srv.getStoneForUser(target.userId, pf)
        const exps = Math.floor(target.exp * 0.005)
        await srv.addExp(player.userId, exps)
        await srv.reduceExp(target.userId, exps / 2)
        if (foeStone > 0) {
          const robbed = Math.floor(foeStone * 0.1)
          await srv.costStoneForUser(target.userId, robbed, pf)
          await srv.gainStoneForUser(player.userId, robbed, pf)
          return appendInjury(
            `大战一番，战胜对手，获取灵石${robbed}枚，修为增加${exps}，对手修为减少${Math.floor(exps / 2)}\n${BATTLE_DETAIL_HINT}`,
            finalHp[player.userId],
            finalHp[target.userId],
            target.userName,
          )
        }
        return appendInjury(
          `大战一番，战胜对手，结果对方是个穷光蛋，修为增加${exps}，对手修为减少${Math.floor(exps / 2)}\n${BATTLE_DETAIL_HINT}`,
          finalHp[player.userId],
          finalHp[target.userId],
          target.userName,
        )
      }
      const myStone = await srv.getStoneForUser(player.userId, pf)
      const exps = Math.floor(player.exp * 0.005)
      await srv.reduceExp(player.userId, exps)
      await srv.addExp(target.userId, exps / 2)
      if (myStone > 0) {
        const lost = Math.floor(myStone * 0.1)
        await srv.costStoneForUser(player.userId, lost, pf)
        await srv.gainStoneForUser(target.userId, lost, pf)
        return appendInjury(
          `大战一番，被对手反杀，损失灵石${lost}枚，修为减少${exps}\n${BATTLE_DETAIL_HINT}`,
          finalHp[player.userId],
          finalHp[target.userId],
          target.userName,
        )
      }
      return appendInjury(
        `大战一番，被对手反杀，修为减少${exps}\n${BATTLE_DETAIL_HINT}`,
        finalHp[player.userId],
        finalHp[target.userId],
        target.userName,
      )
    })

  ctx.command('xiuxian/查看战斗详情', '查看最近一场战斗过程（抢灵石/讨伐BOSS）')
    .alias('战斗详情')
    .action(async ({ session }) => {
      const userId = session!.userId!
      const record = getBattleDetail(userId)
      if (!record) return '暂无可查看的战斗详情，或已超过120秒有效期。'
      const title = record.kind === 'boss' ? '世界BOSS讨伐' : '抢灵石决斗'
      return `【${title}】\n${record.detail}`
    })

  // 排行榜
  ctx.command('xiuxian/排行榜 [type:string]', '查看各类排行榜')
    .alias('修仙排行榜', { args: ['境界'] })
    .alias('境界排行榜', { args: ['境界'] })
    .alias('灵石排行榜', { args: ['灵石'] })
    .alias('战力排行榜', { args: ['战力'] })
    .alias('宗门排行榜', { args: ['宗门'] })
    .action(async (_, type) => {
      type = type || '境界'
      if (type === '灵石') {
        const list = await srv.stoneTop()
        let msg = '✨位面灵石排行榜TOP10✨\n'
        list.forEach((i, n) => { msg += `第${n + 1}位  ${i.userName}  灵石：${numberTo(i.stone)}枚\n` })
        return msg
      }
      if (type === '战力') {
        const list = await srv.powerTop()
        let msg = '✨位面战力排行榜TOP10✨\n'
        list.forEach((i, n) => { msg += `第${n + 1}位  ${i.userName}  战力：${numberTo(i.power)}\n` })
        return msg
      }
      if (type === '宗门') {
        const list = await srv.sectScaleTop()
        let msg = '✨位面宗门建设排行榜TOP10✨\n'
        list.forEach((i, n) => { msg += `第${n + 1}位  ${i.sectName}  建设度：${numberTo(i.sectScale)}\n` })
        return msg
      }
      const list = await srv.realmTop()
      let msg = '✨位面境界排行榜TOP10✨\n'
      list.forEach((i, n) => { msg += `第${n + 1}位 ${i.userName} ${i.level}，修为${numberTo(i.exp)}\n` })
      return msg
    })

  // GM：神秘力量（增加灵石）
  ctx.command('xiuxian/神秘力量 <amount:integer>', '【管理】赠送灵石', { authority: ADMIN_AUTHORITY })
    .action(async ({ session }, amount) => {
      if (!amount || amount < 1 || amount > 100000000) return '请输入正确的灵石数量！'
      const targetId = getAtId(session!)
      if (targetId) {
        const target = await srv.getPlayer(targetId)
        if (!target) return '对方未踏入修仙界，不可赠送！'
        await srv.gainStoneForUser(target.userId, amount, session!.platform)
        return `共赠送${amount}枚灵石给${target.userName}道友！`
      }
      const players = await ctx.database.get('xiuxian_player', {})
      for (const p of players) await srv.gainStoneForUser(p.userId, amount, p.platform)
      return `全服通告：赠送所有用户${amount}灵石，请注意查收！`
    })

  // 重置状态
  ctx.command('xiuxian/重置状态', '【管理】重置玩家状态', { authority: ADMIN_AUTHORITY })
    .action(async ({ session }) => {
      const targetId = getAtId(session!)
      if (targetId) {
        await srv.resetState(targetId)
        return `${targetId}用户信息重置成功！`
      }
      await srv.resetState()
      return '所有用户信息重置成功！'
    })

  /** 校验突破 CD，返回提示信息或空 */
  function checkLevelCd(levelUpCd: Date | null, cdMinutes: number): string | undefined {
    if (!levelUpCd || levelUpCd.getTime() <= 0) return undefined
    const diff = dateDiffSeconds(new Date(), levelUpCd)
    if (diff < cdMinutes * 60) {
      return `目前无法突破，还需要${cdMinutes - Math.floor(diff / 60)}分钟`
    }
    return undefined
  }
}
