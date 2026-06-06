"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupDailyReset = setupDailyReset;
function msUntilNextMidnight() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next.getTime() - now.getTime();
}
/**
 * 注册每日 0 点刷新（签到、宗门供奉等单日一次指令的计数）。
 * 后续新增单日限次字段时，在 XiuxianService.resetDailyFlags 中一并重置。
 */
function setupDailyReset(ctx) {
    const logger = ctx.logger('huaji-xiuxian');
    const schedule = () => {
        const delay = msUntilNextMidnight();
        ctx.setTimeout(async () => {
            try {
                await ctx.xiuxian.resetDailyFlags();
                logger.info('每日 0 点刷新完成（签到、宗门供奉等）');
            }
            catch (err) {
                logger.warn('每日刷新失败：%s', err.message);
            }
            schedule();
        }, delay);
    };
    ctx.inject(['xiuxian'], () => {
        schedule();
        logger.info('已注册每日 0 点自动刷新任务');
    });
}
//# sourceMappingURL=daily-reset.js.map