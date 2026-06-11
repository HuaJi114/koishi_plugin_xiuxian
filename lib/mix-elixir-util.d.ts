import { ItemInfo } from './types';
export interface YaocaiEntry {
    id: number;
    info: ItemInfo;
    num: number;
}
export interface MixRecipe {
    elixirId: number;
    elixirName: string;
    desc: string;
    mainId: number;
    mainName: string;
    mainNum: number;
    mainLevel: string;
    yaoyinId: number;
    yaoyinName: string;
    yaoyinNum: number;
    yaoyinLevel: string;
    fuyaoId: number;
    fuyaoName: string;
    fuyaoNum: number;
    fuyaoLevel: string;
    formulaShort: string;
    elixirConfig: Record<string, number>;
}
/** 主药与药引冷热调和，失败返回 true */
export declare function tiaohe(mainInfo: ItemInfo, mainNum: number, yaoyinInfo: ItemInfo, yaoyinNum: number): boolean;
/** 检测配方是否匹配合成丹药，返回丹药 ID 或 0 */
export declare function checkMix(elixirConfig: Record<string, number>, mixConfigs: Record<string, Record<string, number>>): number;
/** 从背包药材生成可炼制配方列表 */
export declare function findMixRecipes(yaocaiList: YaocaiEntry[], mixElixirItems: Record<string, ItemInfo>): MixRecipe[];
//# sourceMappingURL=mix-elixir-util.d.ts.map