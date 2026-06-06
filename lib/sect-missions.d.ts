import { Fighter } from './types';
/** 宗门任务定义 */
export interface SectMissionDef {
    id: number;
    text: string;
    monsters: string[];
}
export declare const SECT_MISSIONS: SectMissionDef[];
export declare const SECT_MISSION_CD_SECONDS: number;
export declare function pickRandomMission(): SectMissionDef;
export declare function getMissionById(id: number): SectMissionDef | undefined;
/** 妖兽数量：1 只 40%，2 只 30%，3 只 30% */
export declare function rollMissionMonsterCount(): number;
/**
 * 生成妖兽：数量×单只属性总量约为玩家（气血+攻击）的 75% 左右。
 */
export declare function generateMissionMonsters(mission: SectMissionDef, userHp: number, userAtk: number): Array<{
    name: string;
    hp: number;
    atk: number;
}>;
/** 连续挑战多只妖兽，玩家气血在战斗间继承 */
export declare function fightMissionMonsters(player: Fighter, monsters: Array<{
    name: string;
    hp: number;
    atk: number;
}>, fight: (p1: Fighter, p2: Fighter) => [string[], string, Record<string, number>]): {
    log: string[];
    won: boolean;
    remainingHp: number;
    initialMonsterHp: number[];
};
/** 任务酬劳：各妖兽初始气血之和 × 0.1 × 妖兽数量（按需求公式） */
export declare function calcMissionReward(initialMonsterHp: number[]): number;
