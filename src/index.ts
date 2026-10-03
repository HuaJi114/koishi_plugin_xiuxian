import { Context } from 'koishi'
import { Config } from './config'
import { XiuxianService } from './service'
import { applyBase } from './modules/base'
import { applyInfo } from './modules/info'
import { applyCultivate } from './modules/cultivate'
import { applyBack } from './modules/back'
import { applySect } from './modules/sect'
import { applyWork } from './modules/work'
import { applyBank } from './modules/bank'
import { applyBoss } from './modules/boss'
import { applyRift } from './modules/rift'
import { applyMixElixir } from './modules/mixelixir'
import { applyImpart } from './modules/impart'
import { applyExercises } from './modules/exercises'
import { applyShop } from './modules/shop'
import { applyEndgame } from './modules/endgame'
import { applyBlessedSpot } from './modules/blessed-spot'
import { applyGamble } from './modules/gamble'
import { pushCommandPanel } from './modules/panel'
import { applySlashCompat } from './slash'
import { ensureAdminAuthority, syncAllAdminAuthority, normalizePlatformId } from './helpers'
import { setupDailyReset } from './daily-reset'
import { formatLongTextReply } from './message-reply'

export const name = 'huaji-xiuxian'

export const inject = {
  required: ['database', 'monetary'],
  optional: ['markdownToImage'],
}

export { Config }

export const usage = `
## huaji-xiuxian

群聊修仙模拟器，由 [nonebot-plugin-xiuxian-2](https://github.com/luolianxiyou/nonebot-plugin-xiuxian-2) 移植重构而来。

灵石经济通过 [monetary](/market?keyword=monetary) 服务实现，请确保已安装并启用 \`database\` 与 \`monetary\` 服务。

发送 **我要修仙** 加入修仙世界，发送 **修仙帮助** 查看指令列表。
`

/** 板块导航总目录：常用命令 + 各板块入口 */
function formatHelpMain(): string {
  return [
    '【huaji-xiuxian 指令总览】',
    '',
    '◆ 常用命令',
    '我要修仙 / 修仙签到 / 我的修仙信息 / 我的状态',
    '我的背包 / 闭关 / 出关 / 突破',
    '',
    '◆ 板块帮助（发送对应命令查看细分指令）',
    '— 背包与坊市：背包帮助',
    '— 宗门：宗门帮助',
    '— 悬赏令：悬赏令帮助',
    '— 灵庄：灵庄',
    '— 世界BOSS：世界boss帮助',
    '— 秘境：秘境帮助',
    '— 炼丹：炼丹帮助',
    '— 传承：传承帮助',
    '— 炼体：炼体帮助',
    '— 洞天：洞府帮助',
    '— 娱乐小游戏：金银阁 / 虚神界对决（俄罗斯轮盘）',
    '— 长线玩法：参悟天机 / 飞升转世 / 我的转世 / 宗门贡献兑换',
  ].join('\n')
}

/** 仅用于上下文过滤器的极简会话结构 */
type FilterSession = { guildId?: string; userId?: string }

/** 已被白名单静默拦截、且已打印过提示的 guildId（进程内去重，避免刷屏） */
const loggedBlockedGuilds = new Set<string>()

/** 自定义上下文过滤器：按「规范化后的 guildId」命中白名单集合（兼容 qq:123 / mock:123 等平台前缀） */
function makeGuildFilter(ids: Set<string>, logger?: import('koishi').Logger) {
  return (session: FilterSession) => {
    if (!session.guildId) return false
    const norm = normalizePlatformId(session.guildId)
    if (ids.has(norm)) return true
    // 白名单开启但该群未命中：记一条日志，便于管理员拿到 group_openid 填入白名单（进程内去重）
    if (logger && !loggedBlockedGuilds.has(session.guildId)) {
      loggedBlockedGuilds.add(session.guildId)
      logger.info('白名单未命中，已静默拦截群 guildId=%s（规范化后=%s）；如需放行，请将规范化后的值加入「群聊白名单」', session.guildId, norm)
    }
    return false
  }
}

/** 自定义上下文过滤器：按「规范化后的 userId」命中黑名单集合（跨私聊与群聊） */
function makeUserFilter(ids: Set<string>) {
  return (session: FilterSession) => !!session.userId && ids.has(normalizePlatformId(session.userId))
}

export function apply(ctx: Context, config: Config) {
  ctx.plugin(XiuxianService, config)
  setupDailyReset(ctx)

  // 启动时为已入库的管理员 QQ 同步 authority 999
  ctx.inject(['database', 'xiuxian'], () => {
    syncAllAdminAuthority(ctx, config).catch((err) => {
      ctx.logger('huaji-xiuxian').warn('同步管理员 authority 失败：%s', (err as Error).message)
    })
    ctx.xiuxian.normalizeAllPlayerHpMp().catch((err) => {
      ctx.logger('huaji-xiuxian').warn('气血真元校正失败：%s', (err as Error).message)
    })
    ctx.xiuxian.ensureExistingPlayersAsFreelancer().catch((err) => {
      ctx.logger('huaji-xiuxian').warn('已有账号归一散修失败：%s', (err as Error).message)
    })
    ctx.xiuxian.normalizeFreelancerState().catch((err) => {
      ctx.logger('huaji-xiuxian').warn('散修状态校验失败：%s', (err as Error).message)
    })
    ctx.xiuxian.ensurePresetSects().catch((err) => {
      ctx.logger('huaji-xiuxian').warn('初始化预设宗门失败：%s', (err as Error).message)
    })
    ctx.xiuxian.migrateSkillsFromBuff().catch((err) => {
      ctx.logger('huaji-xiuxian').warn('功法数据迁移失败：%s', (err as Error).message)
    })
    ctx.xiuxian.ensureDailyResetIfNeeded().catch((err) => {
      ctx.logger('huaji-xiuxian').warn('每日重置校验失败：%s', (err as Error).message)
    })
  })

  // 管理员首次发消息时补同步 authority（binding 可能尚未建立）
  ctx.middleware(async (session, next) => {
    const userId = session.userId
    if (userId && config.adminQQ.includes(userId)) {
      await ensureAdminAuthority(ctx, session.platform, userId)
    }
    return next()
  })

  ctx.inject(['xiuxian'], (root) => {
    const wlSet = new Set(config.groupWhitelist.map(normalizePlatformId).filter(Boolean))
    const blSet = new Set(config.userBlacklist.map(normalizePlatformId).filter(Boolean))
    const logger = root.logger('huaji-xiuxian')

    // 启动自动推送 QQ 群「指令面板」（仅官方 QQ 机器人 adapter-qq，且配置开启时）
    if (config.enablePanel) {
      const tryPush = (bot: any) => {
        if (!bot || bot.platform !== 'qq') return
        // 延迟 3s，确保机器人已完成初始化并拿到 access_token
        const t = setTimeout(() => {
          pushCommandPanel(bot, config, logger).catch((err) => {
            logger.warn('指令面板：自动推送失败（%s）：%s', bot.selfId ?? bot.config?.id ?? '', (err as Error).message)
          })
        }, 3000)
        t.unref?.()
      }
      root.on('bot-added', tryPush)
      for (const bot of root.bots.values()) tryPush(bot)
    }

    // 游玩上下文（playCtx）：普通玩家指令在此注册，受「白名单 + 黑名单」约束
    let playCtx: Context
    if (!config.groupWhitelistEnabled) {
      // 白名单未开启：延续原 groupOnly 行为
      playCtx = config.groupOnly ? root.guild() : root
    } else if (wlSet.size === 0) {
      // 白名单开启但列表为空：全部禁止（静默）
      playCtx = root.never()
    } else {
      // 白名单开启且非空：仅白名单群可玩
      let base = root.guild().intersect(makeGuildFilter(wlSet, logger))
      if (config.allowPrivateChat) {
        // 允许私聊时，私聊也纳入（仍受黑名单约束）
        base = base.union(root.private())
      }
      playCtx = base
    }
    // 黑名单对所有上下文生效（跨私聊与群聊）
    if (blSet.size) {
      playCtx = playCtx.exclude(root.intersect(makeUserFilter(blSet)))
    }

    // 管理上下文（adminCtx）：豁免白名单，仍受黑名单与 groupOnly 约束
    let adminCtx: Context = config.groupOnly ? root.guild() : root
    if (blSet.size) {
      adminCtx = adminCtx.exclude(root.intersect(makeUserFilter(blSet)))
    }

    // 全局指令冷却：同一群内，任一玩家触发某指令后，所有玩家对该指令进入冷却（防刷屏）
    const globalCdMap = new Map<string, number>()
    root.on('command/before-execute', (argv: import('koishi').Argv) => {
      const cd = config.globalCommandCd
      if (!cd || cd <= 0) return
      // 判断命令是否属于 xiuxian 树（遍历 parent 链，兼容父命令本身）
      let cmd = argv.command
      let isXiuxian = false
      while (cmd) {
        if (cmd.name === 'xiuxian') {
          isXiuxian = true
          break
        }
        cmd = cmd.parent
      }
      if (!isXiuxian) return
      const session = argv.session
      if (!session) return
      const key = `${session.guildId ?? session.cid}:${argv.command!.name}`
      const last = globalCdMap.get(key)
      const now = Date.now()
      if (last && now - last < cd * 1000) {
        return `本指令冷却中，请${Math.ceil((cd * 1000 - (now - last)) / 1000)}秒后再试`
      }
      globalCdMap.set(key, now)
    })

    // 父命令与帮助（普通玩家指令，注册在 playCtx）
    playCtx.command('xiuxian', '修仙模拟器')
      .action(() => formatHelpMain())

    playCtx.command('xiuxian/修仙帮助', '查看修仙指令帮助')
      .alias('帮助')
      .action(() => formatHelpMain())

    // 普通玩法模块：全部注册在 playCtx
    applyBase(playCtx, config, adminCtx)
    applyInfo(playCtx, config)
    applyCultivate(playCtx, config)
    applyBack(playCtx, config)
    applySect(playCtx, config)
    applyWork(playCtx, config)
    applyBank(playCtx, config)
    applyBoss(playCtx, config, adminCtx)
    applyRift(playCtx, config)
    applyMixElixir(playCtx, config)
    applyImpart(playCtx, config)
    applyExercises(playCtx, config)
    applyShop(playCtx, config, adminCtx)
    applyEndgame(playCtx, config)
    applyBlessedSpot(playCtx, config)
    applyGamble(playCtx, config)

    // QQ 官方机器人「指令面板」点击后会填入 `/命令名`（不会自动 @、不剥离 `/`），
    // 若不处理则命令名不匹配 → 用户点了面板却毫无反应。
    // 这里用前置中间件在命令解析前剥离开头的 `/`，对 playCtx/adminCtx 零副作用，
    // 且自动覆盖全部已注册命令（含链式别名与未来新增命令）。
    applySlashCompat(root)

    // 长文本转图中间件：playCtx 与 adminCtx 均需覆盖
    const longTextMw = async (_session: import('koishi').Session, next: () => Promise<any>) => {
      const result = await next()
      if (typeof result === 'string') {
        return formatLongTextReply(root, config, result)
      }
      return result
    }
    playCtx.middleware(longTextMw, true)
    adminCtx.middleware(longTextMw, true)

    root.logger('huaji-xiuxian').info('huaji-xiuxian 插件已加载，发送 我要修仙 开始游戏~')
  })
}
