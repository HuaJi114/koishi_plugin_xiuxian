import { Context } from 'koishi'
import { Config } from '../config'
import { formatAmount, randChoice } from '../utils'

/**
 * 洞天经营模块（满级/长线玩法 D）：
 * 1. 开辟洞府 —— 消耗灵石开辟个人洞府，获得洞府名称
 * 2. 灵气升级 —— 消耗灵石提升洞府灵气等级，等级越高闭关修炼加成越高
 * 3. 灵田种植 —— 消耗灵石播种药材，成熟后收获入背包
 * 4. 洞府信息 —— 查看洞府灵气、灵田、种植情况
 */

declare module 'koishi' {
  interface Tables {
    xiuxian_blessed: XiuxianBlessed
  }
}

/** 洞府数据表（种植状态），每名玩家一行 */
export interface XiuxianBlessed {
  userId: string
  /** 灵田正在种植的药材物品 ID（0 表示空闲） */
  plantId: number
  /** 灵田播种时间 */
  plantAt: Date
  /** 灵田成熟所需分钟数 */
  plantMinutes: number
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

export function applyBlessedSpot(ctx: Context, _config: Config) {
  const srv = ctx.xiuxian

  ctx.model.extend('xiuxian_blessed', {
    userId: 'string',
    plantId: { type: 'integer', initial: 0 },
    plantAt: 'timestamp',
    plantMinutes: { type: 'integer', initial: 0 },
  }, { primary: 'userId' })

  /** 获取或初始化洞府数据 */
  async function getBlessed(userId: string): Promise<XiuxianBlessed> {
    const [row] = await ctx.database.get('xiuxian_blessed', { userId })
    if (row) return row
    return ctx.database.create('xiuxian_blessed', { userId })
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
      await ctx.database.set('xiuxian_player', { userId }, { blessedSpotFlag: 1, blessedSpotName: spotName })
      await getBlessed(userId)
      return `道友耗灵石 ${formatAmount(OPEN_COST)} 枚，于灵脉之上开辟洞府【${spotName}】！自此可【灵气升级】提升修炼之速，亦可于【灵田种植】播撒药材，静待收成。`
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
      return `道友耗灵石 ${formatAmount(cost)} 枚，洞府灵气由【${spiritName(cur)}】升为【${spiritName(next)}】。闭关修为收益提升至 ${Math.round(SPIRIT_EXP_BONUS * next * 100)}%。`
    })

  // 3. 灵田种植
  ctx.command('xiuxian/灵田种植 [seed:text]', '消耗灵石播种药材（不填则随机，可填药材名）')
    .alias('洞府种植')
    .action(async ({ session }, seed) => {
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!player.blessedSpotFlag) return '道友还未开辟洞府，请先【开辟洞府】。'
      const blessed = await getBlessed(userId)
      if (blessed.plantId !== 0) {
        const remain = plantRemainMinutes(blessed)
        if (remain > 0) return `灵田已有作物生长中，还需 ${remain} 分钟方可收获。可【洞府信息】查看。`
        return '灵田作物已成熟，请先【灵田收获】。'
      }

      // 确定种子：优先按名称查找药材，否则随机取一件药材
      let seedId = 0
      let seedInfo
      if (seed && seed.trim()) {
        const found = srv.data.findItemsByName(seed.trim()).filter(([, info]) => info.item_type === '药材')
        if (found.length) {
          seedId = Number(found[0][0])
          seedInfo = found[0][1]
        } else {
          return `未找到名为【${seed.trim()}】的药材，可【查看修仙界物品 药材】浏览。`
        }
      } else {
        const herbs = srv.data.getItemsByType(['药材'])
        const ids = Object.keys(herbs)
        if (!ids.length) return '修仙界暂无药材可种。'
        seedId = Number(randChoice(ids))
        seedInfo = herbs[String(seedId)]
      }

      // 按药材品阶计算成本与成熟时间：品阶越高（rank 越小）越贵、越慢
      const rank = Number(seedInfo?.rank ?? 50)
      const tier = Math.max(Math.floor((50 - rank) / 5), 0) // 品阶档位 0~N
      const cost = PLANT_BASE_COST * (tier + 1)
      const minutes = PLANT_BASE_MINUTES * (tier + 1)
      const pf = session!.platform
      const stone = await srv.getStoneForUser(userId, pf)
      if (stone < cost) return `播种【${seedInfo!.name}】需灵石 ${formatAmount(cost)} 枚，道友灵石不足（当前 ${formatAmount(stone)} 枚）。`
      await srv.costStoneForUser(userId, cost, pf)
      await ctx.database.set('xiuxian_blessed', { userId }, {
        plantId: seedId,
        plantAt: new Date(),
        plantMinutes: minutes,
      })
      return `道友于灵田播下【${seedInfo!.name}】的种子，耗灵石 ${formatAmount(cost)} 枚，预计 ${minutes} 分钟后成熟，届时可【灵田收获】。`
    })

  // 4. 灵田收获
  ctx.command('xiuxian/灵田收获', '收获成熟的灵田作物')
    .alias('洞府收获')
    .action(async ({ session }) => {
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!player.blessedSpotFlag) return '道友还未开辟洞府，请先【开辟洞府】。'
      const blessed = await getBlessed(userId)
      if (blessed.plantId === 0) return '灵田空空如也，请先【灵田种植】。'
      const remain = plantRemainMinutes(blessed)
      if (remain > 0) return `灵田作物尚未成熟，还需 ${remain} 分钟方可收获。`
      const info = srv.data.getItem(blessed.plantId)
      const name = info?.name ?? '未知药材'
      const itemType = (info?.item_type as string) ?? '药材'
      await srv.sendBack(userId, blessed.plantId, name, itemType, 1)
      await ctx.database.set('xiuxian_blessed', { userId }, { plantId: 0, plantAt: new Date(0), plantMinutes: 0 })
      return `道友于灵田收成【${name}】×1，已存入背包。灵田空闲，可再次【灵田种植】。`
    })

  // 5. 洞府信息
  ctx.command('xiuxian/洞府信息', '查看洞府灵气、灵田与种植情况')
    .alias('我的洞府')
    .action(async ({ session }) => {
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!player.blessedSpotFlag) return '道友尚未开辟洞府，可【开辟洞府 <名称>】开创基业。'
      const buff = await srv.getBuff(userId)
      const blessed = await getBlessed(userId)
      const lines = [
        `【${player.blessedSpotName}】`,
        `灵气：${spiritName(buff.blessedSpot)}（闭关修为 +${Math.round(SPIRIT_EXP_BONUS * buff.blessedSpot * 100)}%）`,
      ]
      if (blessed.plantId !== 0) {
        const info = srv.data.getItem(blessed.plantId)
        const remain = plantRemainMinutes(blessed)
        const status = remain > 0 ? `生长中，还需 ${remain} 分钟` : '已成熟，可【灵田收获】'
        lines.push(`灵田：${info?.name ?? '未知作物'}（${status}）`)
      } else {
        lines.push('灵田：空闲')
      }
      return lines.join('\n')
    })

  ctx.command('xiuxian/洞府帮助', '洞天经营玩法帮助')
    .action(() => [
      '洞天经营玩法：',
      '1、开辟洞府 [名称]：耗灵石开辟个人洞府（不填名称则自动命名）',
      '2、灵气升级：耗灵石提升洞府灵气，每级提升闭关修为收益',
      '3、灵田种植 [药材名]：耗灵石播种药材（不填随机），成熟后收获入背包',
      '4、灵田收获：收获成熟的灵田作物',
      '5、洞府信息：查看洞府灵气与灵田状态',
    ].join('\n'))

  /** 计算灵田距成熟还剩余多少分钟 */
  function plantRemainMinutes(blessed: XiuxianBlessed): number {
    if (!blessed.plantId || !blessed.plantAt) return 0
    const elapsed = Math.floor((Date.now() - blessed.plantAt.getTime()) / 60000)
    return Math.max(blessed.plantMinutes - elapsed, 0)
  }
}
