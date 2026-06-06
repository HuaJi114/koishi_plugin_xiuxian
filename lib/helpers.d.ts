import { Context, Session } from 'koishi';
import { Config } from './config';
import { GameData } from './data';
/** 管理指令所需的 Koishi authority 等级 */
export declare const ADMIN_AUTHORITY = 999;
/** 将指定平台用户提升为管理员 authority（若 binding 已存在） */
export declare function ensureAdminAuthority(ctx: Context, platform: string, userId: string): Promise<void>;
/** 插件启动时，为配置的管理员 QQ 同步 authority 等级 */
export declare function syncAllAdminAuthority(ctx: Context, config: Config): Promise<void>;
/** 解析消息中第一个被 @ 的用户平台 ID */
export declare function getAtId(session: Session): string | undefined;
/** 突破判定结果 */
export type BreakthroughResult = {
    type: 'top';
} | {
    type: 'lack';
    needExp: number;
    nextLevel: string;
} | {
    type: 'fail';
} | {
    type: 'success';
    nextLevel: string;
};
/**
 * 突破判定，对应原 OtherSet.get_type。
 * @param exp 当前修为
 * @param rate 突破成功率（含失败加成）
 * @param level 当前境界
 */
export declare function breakthrough(data: GameData, exp: number, rate: number, level: string): BreakthroughResult;
