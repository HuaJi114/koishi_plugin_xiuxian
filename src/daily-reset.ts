import { Context } from 'koishi'
import { todayStr, META_LAST_DAILY_RESET } from './daily-utils'

function msUntilNextMidnight(): number {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return next.getTime() - now.getTime()
}

/**
 * 注册每日 0 点刷新；启动时补跑；每小时校验跨日。
 */
export function setupDailyReset(ctx: Context): void {
  const logger = ctx.logger('huaji-xiuxian')

  const runReset = async (reason: string) => {
    try {
      await ctx.xiuxian.resetDailyFlags()
      logger.info('每日刷新完成（%s）', reason)
    } catch (err) {
      logger.warn('每日刷新失败：%s', (err as Error).message)
    }
  }

  ctx.inject(['xiuxian'], async () => {
    await ctx.xiuxian.ensureDailyResetIfNeeded()
    logger.info('已校验每日重置状态（last=%s, today=%s）',
      await ctx.xiuxian.getMeta(META_LAST_DAILY_RESET), todayStr())
  })

  const scheduleMidnight = () => {
    ctx.setTimeout(async () => {
      await runReset('0点定时')
      scheduleMidnight()
    }, msUntilNextMidnight())
  }

  ctx.inject(['xiuxian'], () => {
    scheduleMidnight()
    ctx.setInterval(async () => {
      await ctx.xiuxian.ensureDailyResetIfNeeded()
    }, 60 * 60 * 1000)
    logger.info('已注册每日 0 点自动刷新与每小时跨日校验')
  })
}
