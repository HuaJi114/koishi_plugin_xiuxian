import { GameData } from './data';
import { ItemInfo, XiuxianSkill } from './types';
export type SkillType = '功法' | '辅修功法' | '神通';
export interface MergedSkillBuffs {
    hpbuff: number;
    mpbuff: number;
    atkbuff: number;
    ratebuff: number;
}
/** 数值型功法加成：同属性取最高，不叠加（含辅修功法） */
export declare function mergeSkillBuffs(skills: XiuxianSkill[], data: GameData): MergedSkillBuffs;
export declare function formatSkillEffect(info: ItemInfo): string;
export declare function formatMergedSkillSummary(merged: MergedSkillBuffs): string;
//# sourceMappingURL=skills.d.ts.map