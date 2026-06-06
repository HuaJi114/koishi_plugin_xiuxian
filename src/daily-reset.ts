import { Context } from 'koishi'
import { XiuxianService } from './service'
function msUntilNextMidnight(): number {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return next.getTime() - now.getTime()
}

/**
 * 注册每日 0 点刷新（签到、宗门供奉等单日一次指令的计数）。
 * 后续新增单日限次字段时，在 XiuxianService.resetDailyFlags 中一并重置。
 */
export function setupDailyReset(ctx: Context): void {
  const logger = ctx.logger('huaji-xiuxian')

  const schedule = () => {
    const delay = msUntilNextMidnight()
    ctx.setTimeout(async () => {
      try {
        await ctx.xiuxian.resetDailyFlags()
        logger.info('每日 0 点刷新完成（签到、宗门供奉等）')
      } catch (err) {
        logger.warn('每日刷新失败：%s', (err as Error).message)
      }
      schedule()
    }, delay)
  }

  ctx.inject(['xiuxian'], () => {
    schedule()
    logger.info('已注册每日 0 点自动刷新任务')
  })
}
