import { Context } from 'koishi';
/**
 * 注册每日 0 点刷新（签到、宗门供奉等单日一次指令的计数）。
 * 后续新增单日限次字段时，在 XiuxianService.resetDailyFlags 中一并重置。
 */
export declare function setupDailyReset(ctx: Context): void;
