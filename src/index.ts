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
import { ensureAdminAuthority, syncAllAdminAuthority } from './helpers'
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
    '— 长线玩法：参悟天机 / 飞升转世 / 我的转世 / 宗门贡献兑换',
  ].join('\n')
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
    // 群聊限定：通过过滤上下文限定所有指令仅在群聊响应
    const cmdCtx = config.groupOnly ? root.guild() : root

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

    cmdCtx.command('xiuxian', '修仙模拟器')
      .action(() => formatHelpMain())

    cmdCtx.command('xiuxian/修仙帮助', '查看修仙指令帮助')
      .alias('帮助')
      .action(() => formatHelpMain())

    applyBase(cmdCtx, config)
    applyInfo(cmdCtx, config)
    applyCultivate(cmdCtx, config)
    applyBack(cmdCtx, config)
    applySect(cmdCtx, config)
    applyWork(cmdCtx, config)
    applyBank(cmdCtx, config)
    applyBoss(cmdCtx, config)
    applyRift(cmdCtx, config)
    applyMixElixir(cmdCtx, config)
    applyImpart(cmdCtx, config)
    applyExercises(cmdCtx, config)
    applyShop(cmdCtx, config)
    applyEndgame(cmdCtx, config)
    applyBlessedSpot(cmdCtx, config)

    cmdCtx.middleware(async (_session, next) => {
      const result = await next()
      if (typeof result === 'string') {
        return formatLongTextReply(root, config, result)
      }
      return result
    }, true)

    root.logger('huaji-xiuxian').info('huaji-xiuxian 插件已加载，发送 我要修仙 开始游戏~')
  })
}
