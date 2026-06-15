import { GameData } from './data';
import { Fighter } from './types';
/**
 * 展示用整数格式化（禁止万/亿缩写与四舍五入）。
 * 用于灵石、修为、气血、真元等所有玩家可见数值。
 */
export declare function formatAmount(num: number): string;
/** @deprecated 请使用 formatAmount */
export declare function numberTo(num: number): string;
/** 区间内随机整数（含两端） */
export declare function randInt(min: number, max: number): number;
/** 从数组中随机取一个元素 */
export declare function randChoice<T>(list: T[]): T;
/** 从数组中随机取 n 个不重复元素 */
export declare function randSample<T>(list: T[], n: number): T[];
/**
 * 轮盘概率计算，对应原 OtherSet.calculated。
 * 各键的权重越大被抽中概率越高。
 */
export declare function rouletteSelect(rate: Record<string, number>): string;
/**
 * 生成随机灵根，对应原 XiuxianJsonDate.linggen_get。
 * @returns [灵根名称, 灵根类型]
 */
export declare function generateRoot(data: GameData): [string, string];
/**
 * 计算新建角色的初始气血、真元、攻击。
 * 气血/真元为满值（与当前修为上限一致）；攻击随灵根倍率在基准值附近波动。
 */
export declare function calcInitialStats(exp: number, rootType: string, data: GameData): {
    hp: number;
    mp: number;
    atk: number;
};
/** 基础气血/真元上限（数据库存储量纲，不含功法加成） */
export declare function getBaseMaxHpMp(exp: number): {
    maxHp: number;
    maxMp: number;
};
/** 将存储气血/真元限制在基础上限内 */
export declare function clampBaseHpMp(exp: number, hp: number, mp: number): {
    hp: number;
    mp: number;
};
/** 含功法加成后的展示/战斗上限 */
export declare function getEffectiveMaxHpMp(exp: number, hpBuff?: number, mpBuff?: number): {
    maxHp: number;
    maxMp: number;
};
/** 是否处于重伤（气血不超过修为上限的 10%） */
export declare function isHeavilyInjured(exp: number, hp: number): boolean;
/** 计算两个时间的秒差 */
export declare function dateDiffSeconds(newTime: Date | number, oldTime: Date | number): number;
/**
 * 计算偷窃成功率，对应原 OtherSet.get_power_rate。
 * @returns 数值为成功率百分比；字符串为提示信息。
 */
export declare function getPowerRate(mind: number, other: number): number | string;
/**
 * 简单回合制战斗，对应原 OtherSet.player_fight。
 * 若传入 data 且攻击方有神通，随机选用一门神通（不叠加）。
 */
export declare function playerFight(p1: Fighter, p2: Fighter, data?: GameData): [string[], string, Record<string, number>];
//# sourceMappingURL=utils.d.ts.map