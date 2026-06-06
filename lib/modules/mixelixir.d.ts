import { Context } from 'koishi';
import { Config } from '../config';
/**
 * 炼丹模块（简化移植）。
 * 原插件炼丹需药材+丹方+丹炉，这里实现为消耗灵石与修为凝练一枚随机丹药，
 * 保留"产出丹药入背包"的核心玩法，后续可接入完整丹方系统。
 */
export declare function applyMixElixir(ctx: Context, _config: Config): void;
