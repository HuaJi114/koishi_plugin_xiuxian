import { GameData } from './data';
import { MergedSkillBuffs } from './skills';
import { Fighter, ItemInfo, XiuxianBuff, XiuxianPlayer } from './types';
import type { XiuxianService } from './service';
export interface CombatStatBreakdown {
    baseAtk: number;
    finalAtk: number;
    practiceRate: number;
    mainAtkRate: number;
    weaponAtkRate: number;
    permAtkBonus: number;
    critRate: number;
    defenseRate: number;
    merged: MergedSkillBuffs;
}
/** 计算最终攻击与加成明细（对应 nonebot final_user_data） */
export declare function computeCombatStats(player: XiuxianPlayer, buff: XiuxianBuff, data: GameData, merged?: MergedSkillBuffs): CombatStatBreakdown;
/** 构建 PVP/PVE 战斗快照（含法器攻击/会心、防具减伤、神通列表） */
export declare function buildFighter(srv: XiuxianService, userId: string): Promise<Fighter | undefined>;
export declare function formatAtkBreakdown(stats: CombatStatBreakdown): string;
export declare function itemEquipType(info: ItemInfo, goodsType?: string): '法器' | '防具' | null;
//# sourceMappingURL=combat-stats.d.ts.map