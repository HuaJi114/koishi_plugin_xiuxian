import { Context } from 'koishi';
import { Config } from '../config';
declare module 'koishi' {
    interface Tables {
        xiuxian_boss: XiuxianBoss;
        xiuxian_boss_participant: XiuxianBossParticipant;
    }
}
/** 世界 BOSS */
export interface XiuxianBoss {
    id: number;
    channelId: string;
    name: string;
    level: string;
    hp: number;
    maxHp: number;
    atk: number;
    stone: number;
    expReward: number;
}
/** BOSS 讨伐参与者记录 */
export interface XiuxianBossParticipant {
    bossId: number;
    userId: string;
    platform: string;
    damage: number;
}
/** 世界 BOSS 模块：生成、查看、讨伐 */
export declare function applyBoss(ctx: Context, _config: Config): void;
