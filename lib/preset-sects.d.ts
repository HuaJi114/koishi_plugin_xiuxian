/** 系统预设宗门（建号时可选择加入） */
export interface PresetSect {
    name: string;
    desc: string;
    /** 系统宗门占位宗主 ID */
    sectOwner: string;
    /** 建设度 */
    sectScale: number;
    /** 宗门可用灵石 */
    sectUsedStone: number;
    /** 灵田等级 */
    sectFairyland: number;
    /** 宗门资材 */
    sectMaterials: number;
    /** 主修功法 ID（0 表示未配置） */
    mainBuff: number;
    /** 神通 ID */
    secBuff: number;
    /** 丹房等级 */
    elixirRoomLevel: number;
}
/** 四大预设宗门，参数按宗门特色写死 */
export declare const PRESET_SECTS: PresetSect[];
export declare function formatSectRegisterPrompt(): string;
export declare function formatPresetSectList(): string;
/** 根据名称查找预设宗门（支持全名匹配） */
export declare function findPresetSect(name: string): PresetSect | undefined;
/**
 * 解析玩家在「加入宗门」选择时输入的文本：
 * - 纯数字且落在预设宗门序号范围内（1 基）→ 按序号取对应预设宗门；
 * - 否则按宗门全名匹配；
 * - 都匹配不到返回 undefined。
 * 用于建号引导，让玩家回复序号也能加入。
 */
export declare function resolvePresetSectInput(input: string): PresetSect | undefined;
//# sourceMappingURL=preset-sects.d.ts.map