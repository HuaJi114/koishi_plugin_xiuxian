"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupDailyReset = setupDailyReset;
const daily_utils_1 = require("./daily-utils");
const timezone_1 = require("./timezone");
/**
 * 注册每日 0 点刷新；启动时补跑；每小时校验跨日。
 */
function setupDailyReset(ctx) {
    const logger = ctx.logger('huaji-xiuxian');
    const runReset = async (reason) => {
        try {
            await ctx.xiuxian.resetDailyFlags();
            logger.info('每日刷新完成（%s）', reason);
        }
        catch (err) {
            logger.warn('每日刷新失败：%s', err.message);
        }
    };
    ctx.inject(['xiuxian'], async () => {
        await ctx.xiuxian.ensureDailyResetIfNeeded();
        logger.info('已校验每日重置状态（last=%s, today=%s）', await ctx.xiuxian.getMeta(daily_utils_1.META_LAST_DAILY_RESET), (0, daily_utils_1.todayStr)());
    });
    const scheduleMidnight = () => {
        ctx.setTimeout(async () => {
            await runReset('0点定时');
            scheduleMidnight();
        }, (0, timezone_1.msUntilShanghaiMidnight)());
    };
    ctx.inject(['xiuxian'], () => {
        scheduleMidnight();
        ctx.setInterval(async () => {
            await ctx.xiuxian.ensureDailyResetIfNeeded();
        }, 60 * 60 * 1000);
        logger.info('已注册每日 0 点自动刷新与每小时跨日校验');
    });
}
//# sourceMappingURL=daily-reset.js.map