import { Context } from 'koishi'
import { Config } from '../config'
import { formatAmount, randChoice } from '../utils'
import { XiuxianBack, XiuxianPlot } from '../types'

/**
 * 洞天经营模块（满级/长线玩法 D）：
 * 1. 开辟洞府 —— 消耗灵石开辟个人洞府，自动获得 1 块灵田
 * 2. 灵气升级 —— 消耗灵石提升洞府灵气等级，等级越高闭关修炼加成越高
 * 3. 灵田种植 —— 消耗背包中的 1 份药材，种到第一块空闲灵田（交互选择药材）
 * 4. 灵田收获 —— 成熟后收获，按洞府灵气等级随机获得 2~8 份药材
 * 5. 开垦灵田 —— 花费灵石扩建灵田（第 2 块 100 万，之后每块翻倍，上限 999 块）
 * 6. 洞府信息 / 灵田情况 —— 查看洞府与灵田状态
 */

declare module 'koishi' {
  interface Tables {
    xiuxian_plot: XiuxianPlot
  }
}

// ==================== 数值配置 ====================

/** 开辟洞府所需灵石 */
const OPEN_COST = 1000000
/** 灵气升级基础消耗（每级翻倍：L1→2 需 50 万，L2→3 需 100 万……） */
const SPIRIT_BASE_COST = 500000
/** 灵气等级上限 */
const SPIRIT_MAX_LEVEL = 5
/** 每级灵气对闭关修为的加成（百分比） */
const SPIRIT_EXP_BONUS = 0.05
/** 种植一次消耗的灵石（按种子 rank 加权） */
const PLANT_BASE_COST = 200000
/** 种植基础成熟时间（分钟） */
const PLANT_BASE_MINUTES = 60
/** 洞府改名消耗 */
const RENAME_COST = 10000
/** 第 2 块灵田开垦费用（之后每块翻倍） */
const PLOT_OPEN_BASE = 1000000
/** 灵田数量上限 */
const PLOT_MAX = 999

/** 洞府名称素材（古风） */
const SPOT_NAME_EPITHETS = ['云隐', '灵虚', '太清', '玉京', '青冥', '紫府', '玄都', '碧落', '赤霄', '沧溟']

/** 灵气等级名称 */
function spiritName(level: number): string {
  return ['未开辟', '微弱灵气', '稀薄灵气', '充裕灵气', '浓郁灵气', '仙灵之气'][Math.min(Math.max(level, 0), 5)]
}

/** 生成一个默认洞府名（用户未指定时） */
function defaultSpotName(userName: string): string {
  return `${randChoice(SPOT_NAME_EPITHETS)}·${userName}洞府`
}

/** 按洞府灵气等级（0~5）给出收获份数区间 [min, max] */
const HARVEST_RANGE: Record<number, [number, number]> = {
  0: [2, 3],
  1: [2, 3],
  2: [3, 4],
  3: [4, 5],
  4: [5, 6],
  5: [6, 8],
}

function harvestRange(level: number): [number, number] {
  return HARVEST_RANGE[Math.min(Math.max(level, 0), 5)] ?? [2, 3]
}

export function applyBlessedSpot(ctx: Context, _config: Config) {
  const srv = ctx.xiuxian

  ctx.model.extend('xiuxian_plot', {
    userId: 'string',
    plotIndex: { type: 'integer', initial: 1 },
    plantId: { type: 'integer', initial: 0 },
    plantAt: 'timestamp',
    plantMinutes: { type: 'integer', initial: 0 },
  }, { primary: ['userId', 'plotIndex'] })

  /** 获取用户全部灵田（按序号升序） */
  async function getPlots(userId: string): Promise<XiuxianPlot[]> {
    const rows = await ctx.database.get('xiuxian_plot', { userId })
    return rows.sort((a, b) => a.plotIndex - b.plotIndex)
  }

  /** 计算某块灵田距成熟还剩余多少分钟 */
  function plotRemainMinutes(plot: XiuxianPlot): number {
    if (!plot.plantId || !plot.plantAt) return 0
    const elapsed = Math.floor((Date.now() - plot.plantAt.getTime()) / 60000)
    return Math.max(plot.plantMinutes - elapsed, 0)
  }

  /** 收获某块已成熟的灵田，返回实际获得份数 */
  async function harvestPlot(userId: string, plot: XiuxianPlot): Promise<number> {
    const info = srv.data.getItem(plot.plantId)
    const name = info?.name ?? '未知药材'
    const itemType = (info?.item_type as string) ?? '药材'
    const buff = await srv.getBuff(userId)
    const [min, max] = harvestRange(buff.blessedSpot)
    const gain = Math.floor(Math.random() * (max - min + 1)) + min
    await srv.sendBack(userId, plot.plantId, name, itemType, gain)
    await ctx.database.set('xiuxian_plot', { userId, plotIndex: plot.plotIndex }, {
      plantId: 0, plantAt: new Date(0), plantMinutes: 0,
    })
    return gain
  }

  // 1. 开辟洞府
  ctx.command('xiuxian/开辟洞府 [name:text]', '消耗灵石开辟个人洞府')
    .alias('洞府开辟')
    .action(async ({ session }, name) => {
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (player.blessedSpotFlag) return '道友已拥有洞府，无需重复开辟。可【洞府信息】查看。'
      const pf = session!.platform
      const stone = await srv.getStoneForUser(userId, pf)
      if (stone < OPEN_COST) return `开辟洞府需灵石 ${formatAmount(OPEN_COST)} 枚，道友灵石不足（当前 ${formatAmount(stone)} 枚）。`
      await srv.costStoneForUser(userId, OPEN_COST, pf)
      const spotName = (name ?? '').trim() || defaultSpotName(player.userName)
      await ctx.database.set('xiuxian_player', { userId }, { blessedSpotFlag: 1, blessedSpotName: spotName, plotCount: 1 })
      await ctx.database.create('xiuxian_plot', {
        userId, plotIndex: 1, plantId: 0, plantAt: new Date(0), plantMinutes: 0,
      })
      return `道友耗灵石 ${formatAmount(OPEN_COST)} 枚，于灵脉之上开辟洞府【${spotName}】，获赠灵田 1 块！自此可【灵气升级】提升修炼之速，亦可于【灵田种植】播撒药材，静待收成。`
    })

  // 2. 灵气升级
  ctx.command('xiuxian/灵气升级', '消耗灵石提升洞府灵气，增加闭关修为收益')
    .alias('洞府升级')
    .action(async ({ session }) => {
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!player.blessedSpotFlag) return '道友还未开辟洞府，请先【开辟洞府】。'
      const buff = await srv.getBuff(userId)
      const cur = buff.blessedSpot
      if (cur >= SPIRIT_MAX_LEVEL) return `道友洞府灵气已臻至【${spiritName(cur)}】，无法再进。`
      const cost = SPIRIT_BASE_COST * Math.pow(2, cur)
      const pf = session!.platform
      const stone = await srv.getStoneForUser(userId, pf)
      if (stone < cost) return `灵气升级需灵石 ${formatAmount(cost)} 枚，道友灵石不足（当前 ${formatAmount(stone)} 枚）。`
      await srv.costStoneForUser(userId, cost, pf)
      const next = cur + 1
      await srv.setBlessedSpot(userId, next)
      return `道友耗灵石 ${formatAmount(cost)} 枚，洞府灵气由【${spiritName(cur)}】升为【${spiritName(next)}】。闭关修为收益提升至 ${Math.round(SPIRIT_EXP_BONUS * next * 100)}%，成熟灵田收成亦更丰。`
    })

  // 3. 开垦灵田
  ctx.command('xiuxian/开垦灵田', '花费灵石扩建灵田')
    .alias('洞府开垦')
    .action(async ({ session }) => {
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!player.blessedSpotFlag) return '道友还未开辟洞府，请先【开辟洞府】。'
      const count = player.plotCount ?? 0
      if (count >= PLOT_MAX) return `灵田已达上限（${PLOT_MAX} 块），无法继续开垦。`
      const cost = PLOT_OPEN_BASE * Math.pow(2, count - 1)
      const pf = session!.platform
      const stone = await srv.getStoneForUser(userId, pf)
      if (stone < cost) return `开垦第 ${count + 1} 块灵田需灵石 ${formatAmount(cost)} 枚，道友灵石不足（当前 ${formatAmount(stone)} 枚）。`
      await srv.costStoneForUser(userId, cost, pf)
      const next = count + 1
      await ctx.database.set('xiuxian_player', { userId }, { plotCount: next })
      await ctx.database.create('xiuxian_plot', {
        userId, plotIndex: next, plantId: 0, plantAt: new Date(0), plantMinutes: 0,
      })
      return `道友耗灵石 ${formatAmount(cost)} 枚，新辟第 ${next} 块灵田！当前共 ${next} 块灵田。`
    })

  // 4. 灵田种植
  ctx.command('xiuxian/灵田种植 [arg:text]', '消耗背包药材并种植到灵田')
    .alias('洞府种植')
    .action(async ({ session }, arg) => {
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!player.blessedSpotFlag) return '道友还未开辟洞府，请先【开辟洞府】。'

      const herbs = (await srv.getBack(userId)).filter((b) => {
        const info = srv.data.getItem(b.goodsId)
        return (info?.item_type === '药材') || b.goodsType === '药材'
      })
      if (!herbs.length) return '道友背包中无药材可种，可先获取药材（如探索秘境、悬赏令等）。'

      const plots = await getPlots(userId)
      const free = plots.find((p) => p.plantId === 0)
      if (!free) return '灵田已全部种满，可【开垦灵田】扩建后再种。'

      const parseChoice = (raw: string): XiuxianBack | undefined => {
        const t = (raw ?? '').trim()
        if (!t) return undefined
        if (/^\d+$/.test(t)) return herbs[parseInt(t, 10) - 1]
        return herbs.find((h) => h.goodsName === t || h.goodsName.includes(t))
      }

      let chosen: XiuxianBack | undefined
      if (arg && arg.trim()) {
        chosen = parseChoice(arg)
      } else {
        const list = herbs.map((h, i) => `${i + 1}. ${h.goodsName} ×${h.goodsNum}`).join('\n')
        await session!.send(`灵田可种药材（将消耗 1 份作为种子）：\n${list}\n请回复序号选择要种植的药材：`)
        const input = await session!.prompt(60000)
        chosen = parseChoice(input ?? '')
      }
      if (!chosen) return '未找到对应药材，请输入正确的序号或药材名。'

      await srv.reduceBack(userId, chosen.goodsId, 1, 0)
      const info = srv.data.getItem(chosen.goodsId)
      const rank = Number(info?.rank ?? 50)
      const tier = Math.max(Math.floor((50 - rank) / 5), 0)
      const minutes = PLANT_BASE_MINUTES * (tier + 1)
      await ctx.database.set('xiuxian_plot', { userId, plotIndex: free.plotIndex }, {
        plantId: chosen.goodsId,
        plantAt: new Date(),
        plantMinutes: minutes,
      })
      return `道友于第 ${free.plotIndex} 块灵田播下【${chosen.goodsName}】的种子（消耗 1 份），预计 ${minutes} 分钟后成熟，届时可【灵田收获】。`
    })

  // 5. 灵田收获
  ctx.command('xiuxian/灵田收获 [idx:integer]', '收获成熟的灵田作物')
    .alias('洞府收获')
    .action(async ({ session }, idx) => {
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!player.blessedSpotFlag) return '道友还未开辟洞府，请先【开辟洞府】。'
      const plots = await getPlots(userId)

      if (idx != null && !Number.isNaN(idx)) {
        const plot = plots.find((p) => p.plotIndex === idx)
        if (!plot) return `第 ${idx} 块灵田不存在。`
        if (plot.plantId === 0) return `第 ${idx} 块灵田空闲，暂无作物。`
        const remain = plotRemainMinutes(plot)
        if (remain > 0) return `第 ${idx} 块灵田作物尚未成熟，还需 ${remain} 分钟方可收获。`
        const info = srv.data.getItem(plot.plantId)
        const name = info?.name ?? '未知药材'
        const gain = await harvestPlot(userId, plot)
        return `道友于第 ${idx} 块灵田收成【${name}】×${gain}，已存入背包。灵田空闲，可再次【灵田种植】。`
      }

      const ready = plots.filter((p) => p.plantId !== 0 && plotRemainMinutes(p) <= 0)
      if (!ready.length) return '灵田暂无成熟作物，可【灵田情况】查看生长状态。'
      const lines = ['灵田迎来丰收：']
      for (const plot of ready) {
        const info = srv.data.getItem(plot.plantId)
        const name = info?.name ?? '未知药材'
        const gain = await harvestPlot(userId, plot)
        lines.push(`第 ${plot.plotIndex} 块灵田：收成【${name}】×${gain}`)
      }
      return lines.join('\n')
    })

  // 6. 灵田情况
  ctx.command('xiuxian/灵田情况', '查看各块灵田的种植状态')
    .alias('查看灵田')
    .action(async ({ session }) => {
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!player.blessedSpotFlag) return '道友尚未开辟洞府，可【开辟洞府 <名称>】开创基业。'
      const plots = await getPlots(userId)
      const lines = [`【${player.blessedSpotName}】灵田共 ${plots.length} 块：`]
      for (const plot of plots) {
        if (plot.plantId === 0) {
          lines.push(`第 ${plot.plotIndex} 块：空闲`)
          continue
        }
        const info = srv.data.getItem(plot.plantId)
        const remain = plotRemainMinutes(plot)
        const status = remain > 0 ? `生长中，还需 ${remain} 分钟` : '已成熟，可【灵田收获】'
        lines.push(`第 ${plot.plotIndex} 块：${info?.name ?? '未知作物'}（${status}）`)
      }
      return lines.join('\n')
    })

  // 7. 洞府信息
  ctx.command('xiuxian/洞府信息', '查看洞府灵气与灵田概况')
    .alias('我的洞府')
    .action(async ({ session }) => {
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!player.blessedSpotFlag) return '道友尚未开辟洞府，可【开辟洞府 <名称>】开创基业。'
      const buff = await srv.getBuff(userId)
      const plots = await getPlots(userId)
      const planted = plots.filter((p) => p.plantId !== 0).length
      return [
        `【${player.blessedSpotName}】`,
        `灵气：${spiritName(buff.blessedSpot)}（闭关修为 +${Math.round(SPIRIT_EXP_BONUS * buff.blessedSpot * 100)}%，成熟收成 2~8 份）`,
        `灵田：共 ${plots.length} 块，已种 ${planted} 块（【灵田情况】查看明细）`,
      ].join('\n')
    })

  // 8. 洞府改名
  ctx.command('xiuxian/洞府改名 <name:text>', '消耗灵石为洞府改名')
    .alias('重命名洞府')
    .action(async ({ session }, name) => {
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!player.blessedSpotFlag) return '道友尚未开辟洞府，可【开辟洞府 <名称>】开创基业。'
      const trimmed = (name ?? '').trim()
      if (!trimmed) return '请输入新的洞府名称！'
      const hanLen = [...trimmed].length
      if (hanLen > 12) return `洞府名称过长（当前 ${hanLen} 字），最长 12 个汉字，请精简。`
      const pf = session!.platform
      const stone = await srv.getStoneForUser(userId, pf)
      if (stone < RENAME_COST) return `改名需灵石 ${formatAmount(RENAME_COST)} 枚，道友灵石不足（当前 ${formatAmount(stone)} 枚）。`
      await srv.costStoneForUser(userId, RENAME_COST, pf)
      await ctx.database.set('xiuxian_player', { userId }, { blessedSpotName: trimmed })
      return `您的洞府名称已修改为${trimmed}`
    })

  ctx.command('xiuxian/洞府帮助', '洞天经营玩法帮助')
    .action(() => [
      '洞天经营玩法：',
      '1、开辟洞府 [名称]：耗灵石开辟个人洞府（送灵田 1 块，不填名称则自动命名）',
      '2、灵气升级：耗灵石提升洞府灵气，每级提升闭关修为收益与成熟收成',
      '3、灵田种植 [药材名]：消耗背包 1 份药材种到空闲灵田（不填则列出药材由你选序号）',
      '4、灵田收获 [编号]：收获成熟灵田（不填编号则收获全部成熟作物）',
      '5、开垦灵田：耗灵石扩建灵田（第 2 块 100 万，之后每块翻倍，上限 999 块）',
      '6、洞府信息 / 灵田情况：查看灵气、灵田状态',
      '7、洞府改名 <名称>：耗灵石为洞府更名（最长 12 字，每次 10000 灵石）',
    ].join('\n'))
}
