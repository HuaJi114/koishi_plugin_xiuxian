import { Context } from 'koishi';
import { Config } from '../config';
/**
 * 秘境模块（简化移植）。
 * 原插件秘境为多阶段事件探索，这里实现为单次随机事件探索，
 * 保留奖励/惩罚/获得物品的核心玩法。
 */
export declare function applyRift(ctx: Context, _config: Config): void;
