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

    cmdCtx.command('xiuxian', '修仙模拟器')

    cmdCtx.command('xiuxian/修仙帮助', '查看修仙指令帮助')
      .action(() => [
        '【huaji-xiuxian 指令帮助】',
        '— 基础：我要修仙 / 修仙签到 / 我的修仙信息 / 我的状态 / 改名 / 重入仙途',
        '— 突破：我的突破概率 / 突破 / 直接突破 / 渡厄突破',
        '— 修炼：闭关 / 出关 / 灵石修炼 / 双修',
        '— 经济：灵石 / 送灵石 / 偷灵石 / 抢劫 / 查看战斗详情 / 排行榜',
        '— 背包：我的背包 / 使用 / 换装 / 查看修仙界物品 / 背包帮助',
        '— 坊市：坊市查看 / 坊市购买 / 坊市上架 / 坊市下架',
        '— 宗门：宗门帮助 / 宗门每日供奉 / 接取宗门任务 / 完成宗门任务',
        '— 悬赏：悬赏令帮助',
        '— 灵庄：灵庄帮助 / 灵庄信息 / 灵庄升级会员',
        '— 世界BOSS：世界boss帮助',
        '— 秘境：秘境帮助',
        '— 炼丹：炼丹帮助 / 炼丹 / 炼制',
        '— 传承：传承帮助 / 参悟传承',
        '— 炼体：炼体帮助 / 炼体查看 / 炼体',
      ].join('\n'))

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

    cmdCtx.middleware(async (session, next) => {
      const result = await next()
      if (typeof result === 'string') {
        return formatLongTextReply(root, config, result, session)
      }
      return result
    }, true)

    root.logger('huaji-xiuxian').info('huaji-xiuxian 插件已加载，发送 我要修仙 开始游戏~')
  })
}
