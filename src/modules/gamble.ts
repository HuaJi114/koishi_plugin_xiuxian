import { Context, Session } from 'koishi'
import { Config } from '../config'
import { getAtId } from '../helpers'
import { todayStr } from '../daily-utils'
import { formatAmount, randInt } from '../utils'

/**
 * 娱乐小游戏模块：
 *  - 金银阁·猜大小：掷 3 骰子，4–10 小 / 11–17 大，三同点(豹子)庄家通杀，押中 1.9 倍返还。
 *  - 虚神界对决 / 俄罗斯轮盘：PvP 灵石赌注，发起后需对方发「接受对决」确认，
 *    6 轮轮盘（6 膛 1 发真弹，轮流开枪）必有一方暴毙，胜者通吃双方押注。
 *
 * 计数/待决对决均用进程内 Map（重启清零，日常限额无持久化影响，避免改动 player 表）。
 */

// 金银阁：每日次数 / 每日累计押注 / 冷却
const jinyinDailyCount = new Map<string, number>()
const jinyinDailyStone = new Map<string, number>()
const jinyinCdMap = new Map<string, number>()

// 虚神界对决：每日发起次数
const voidDuelDaily = new Map<string, number>()

interface PendingDuel {
  guildId: string
  challengerId: string
  targetId: string
  stake: number
  createdAt: number
  timer?: ReturnType<typeof setTimeout>
}
// key: `${guildId}:${challengerId}`（每位发起者同时仅一场未决对决）
const pendingDuels = new Map<string, PendingDuel>()

const PROMPT_MS = 60_000

/**
 * 金银阁判定（纯函数，便于测试）。
 * 三同点(豹子)庄家通杀；4–10 小、11–17 大；押中返回 'win'。
 */
export function judgeJinyinge(bet: '大' | '小', d1: number, d2: number, d3: number): 'win' | 'lose' | 'triple' {
  const triple = d1 === d2 && d2 === d3
  if (triple) return 'triple'
  const sum = d1 + d2 + d3
  const judge: '大' | '小' = sum >= 4 && sum <= 10 ? '小' : '大'
  return judge === bet ? 'win' : 'lose'
}

/**
 * 虚神界对决轮盘判定（纯函数，便于测试）。
 * 6 膛 1 发真弹随机分布；challenger 在奇数膛(1,3,5)开枪、target 在偶数膛(2,4,6)开枪。
 * 返回哪一方「暴毙」（bulletPos 为奇数 → challenger 死，偶数 → target 死）。
 */
export function rouletteDies(bulletPos: number): 'challenger' | 'target' {
  return bulletPos % 2 === 1 ? 'challenger' : 'target'
}

export function applyGamble(ctx: Context, config: Config) {
  const srv = ctx.xiuxian

  // ============ 金银阁·猜大小 ============
  ctx.command('xiuxian/金银阁', '【娱乐】掷骰猜大小赌灵石')
    .action(async ({ session }) => {
      if (!config.enableJinyinge) return '金银阁暂未开放（管理员已关闭该玩法）。'
      const s = session!
      const userId = s.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'

      const today = todayStr()
      const dk = `${userId}@${today}`
      const used = jinyinDailyCount.get(dk) ?? 0
      if (used >= config.jinyinDailyLimit) {
        return `今日金银阁次数已用尽（上限 ${config.jinyinDailyLimit}），明日再来~`
      }
      const last = jinyinCdMap.get(userId) ?? 0
      const now = Date.now()
      if (now - last < config.jinyinCd * 1000) {
        return `金银阁冷却中，请${Math.ceil((config.jinyinCd * 1000 - (now - last)) / 1000)}秒后再试`
      }

      await s.send('金银阁开张！请回复【大】或【小】压注：')
      const betRaw = (await s.prompt(PROMPT_MS))?.trim()
      if (!betRaw) return '已取消下注。'
      const bet: '大' | '小' | null = betRaw === '大' ? '大' : betRaw === '小' ? '小' : null
      if (!bet) return '请回复【大】或【小】！'

      await s.send(`压【${bet}】，请回复押注的灵石数量：`)
      const amtRaw = (await s.prompt(PROMPT_MS))?.trim()
      const amount = Number(amtRaw)
      if (!amtRaw || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
        return '请输入正确的灵石数量！'
      }
      if (amount > config.jinyinSingleLimit) {
        return `单次押注不能超过 ${formatAmount(config.jinyinSingleLimit)} 灵石！`
      }
      const stone = await srv.getStoneForUser(userId, s.platform)
      if (amount > stone) return '道友的灵石不足，无法下注！'
      const usedStone = jinyinDailyStone.get(dk) ?? 0
      if (usedStone + amount > config.jinyinDailyStoneLimit) {
        return `今日累计押注已达上限 ${formatAmount(config.jinyinDailyStoneLimit)}，无法再加注！`
      }

      // 扣注（先扣，赢则返还 1.9 倍）
      if (!(await srv.costStoneForUser(userId, amount, s.platform))) {
        return '道友的灵石不足，无法下注！'
      }

      const d = [randInt(1, 6), randInt(1, 6), randInt(1, 6)]
      const sum = d[0] + d[1] + d[2]
      const judge: '大' | '小' = sum >= 4 && sum <= 10 ? '小' : '大'
      const result = judgeJinyinge(bet, d[0], d[1], d[2])
      const triple = result === 'triple'
      const win = result === 'win'

      jinyinCdMap.set(userId, Date.now())
      jinyinDailyCount.set(dk, used + 1)
      jinyinDailyStone.set(dk, usedStone + amount)

      if (win) {
        const gain = Math.floor(amount * 1.9)
        await srv.gainStoneForUser(userId, gain, s.platform)
        return `骰子点数：${d.join('+')}=${sum}（${judge}）。\n恭喜道友押中【${bet}】，获得 ${formatAmount(gain)} 灵石（净赚 ${formatAmount(gain - amount)}）！`
      }
      if (triple) {
        return `骰子点数：${d.join('+')}=${sum}（豹子！庄家通杀）。\n道友押注 ${formatAmount(amount)} 灵石尽归金银阁~`
      }
      return `骰子点数：${d.join('+')}=${sum}（${judge}）。\n道友压【${bet}】未中，损失 ${formatAmount(amount)} 灵石。`
    })

  // ============ 虚神界对决 / 俄罗斯轮盘 ============
  ctx.command('xiuxian/虚神界对决 <amount:integer>', '【娱乐】向他人发起虚神界对决（俄罗斯轮盘）')
    .action(async ({ session }, amount) => {
      if (!config.enableVoidDuel) return '虚神界对决暂未开放（管理员已关闭该玩法）。'
      const s = session!
      const userId = s.userId!
      const challenger = await srv.getPlayer(userId)
      if (!challenger) return '修仙界没有道友的信息，请输入【我要修仙】加入！'

      const targetId = getAtId(s)
      if (!targetId) return '请 @ 要发起对决的道友！'
      if (targetId === userId) return '不能与自己对决！'
      const target = await srv.getPlayer(targetId)
      if (!target) return '对方未踏入修仙界，无法对决！'
      if (!amount || amount <= 0 || !Number.isInteger(amount)) return '请输入正确的灵石数量！'

      const today = todayStr()
      const dk = `${userId}@${today}`
      const used = voidDuelDaily.get(dk) ?? 0
      if (used >= config.voidDuelDailyLimit) {
        return `今日虚神界对决次数已用尽（上限 ${config.voidDuelDailyLimit}），明日再来~`
      }

      const guildId = s.guildId ?? 'private'
      const key = `${guildId}:${userId}`
      if (pendingDuels.has(key)) return '你已有一场未结束的对决，请等待对方接受或超时。'

      const myStone = await srv.getStoneForUser(userId, s.platform)
      if (amount > myStone) return '道友的灵石不足，无法发起对决！'
      const targetStone = await srv.getStoneForUser(targetId, target.platform)
      if (amount > targetStone) {
        return `${target.userName}道友灵石不足（需 ${formatAmount(amount)}），无法接受对决。`
      }

      const pending: PendingDuel = {
        guildId,
        challengerId: userId,
        targetId,
        stake: amount,
        createdAt: Date.now(),
      }
      pending.timer = setTimeout(() => {
        if (pendingDuels.get(key) === pending) {
          pendingDuels.delete(key)
          s.send(`【虚神界对决】${target.userName} 道友未及时接受，对决已取消，双方灵石未扣除。`).catch(() => {})
        }
      }, config.voidDuelAcceptTimeout * 1000)
      pending.timer?.unref?.()
      pendingDuels.set(key, pending)

      return [
        `【虚神界对决】你向 ${target.userName} 道友发起对决，押注 ${formatAmount(amount)} 灵石！`,
        `请对方发送【接受对决】确认（${config.voidDuelAcceptTimeout} 秒内有效）。`,
        '双方灵石将在接受时锁定，6 轮轮盘必有一方暴毙，胜者通吃双方押注。',
      ].join('\n')
    })

  ctx.command('xiuxian/接受对决', '【娱乐】接受他人发起的虚神界对决')
    .action(async ({ session }) => {
      if (!config.enableVoidDuel) return '虚神界对决暂未开放（管理员已关闭该玩法）。'
      const s = session!
      const userId = s.userId!
      const guildId = s.guildId ?? 'private'

      let foundKey: string | undefined
      let found: PendingDuel | undefined
      for (const [k, p] of pendingDuels) {
        if (p.targetId === userId && p.guildId === guildId) {
          foundKey = k
          found = p
          break
        }
      }
      if (!found || !foundKey) return '当前没有等待你接受的对决（可能已超时或不存在）。'

      const challenger = await srv.getPlayer(found.challengerId)
      const target = await srv.getPlayer(userId)
      if (!challenger || !target) {
        if (found.timer) clearTimeout(found.timer)
        pendingDuels.delete(foundKey)
        return '对决数据异常，已取消。'
      }
      const stake = found.stake
      const cStone = await srv.getStoneForUser(found.challengerId, challenger.platform)
      const tStone = await srv.getStoneForUser(userId, target.platform)
      if (stake > cStone || stake > tStone) {
        if (found.timer) clearTimeout(found.timer)
        pendingDuels.delete(foundKey)
        return '有一方灵石不足，对决已取消。'
      }

      // 锁定双方灵石
      await srv.costStoneForUser(found.challengerId, stake, challenger.platform)
      await srv.costStoneForUser(userId, stake, target.platform)

      // 模拟 6 轮俄罗斯轮盘：1 发真弹随机分布； challenger 在奇数膛(1,3,5)、target 在偶数膛(2,4,6) 开枪
      const bulletPos = randInt(1, 6)
      const challengerDies = rouletteDies(bulletPos) === 'challenger'
      const winnerId = challengerDies ? userId : found.challengerId
      const winner = winnerId === found.challengerId ? challenger : target
      const loser = winnerId === found.challengerId ? target : challenger

      // 胜者通吃双方押注（已各扣 stake，共 2*stake，全给胜者）
      await srv.gainStoneForUser(winnerId, stake * 2, winner.platform)

      const today = todayStr()
      const dk = `${found.challengerId}@${today}`
      voidDuelDaily.set(dk, (voidDuelDaily.get(dk) ?? 0) + 1)
      if (found.timer) clearTimeout(found.timer)
      pendingDuels.delete(foundKey)

      const whoShot = challengerDies ? challenger.userName : target.userName
      return [
        '【虚神界对决·轮盘结果】',
        `六发轮盘，第 ${bulletPos} 发膛藏着真弹。`,
        `${whoShot} 道友扣动扳机——轰！气数已尽。`,
        `胜者：${winner.userName} 道友，通吃双方押注，获得 ${formatAmount(stake * 2)} 灵石（净赚 ${formatAmount(stake)}）。`,
      ].join('\n')
    })
}
