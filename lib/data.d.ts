import { ItemInfo, LevelInfo, RootInfo } from './types';
/** 悬赏令任务定义 */
export interface WorkTask {
    level: string;
    succeed: string;
    fail: string;
}
/**
 * 游戏静态数据管理器。
 * 负责加载并缓存所有 JSON 配置（境界、灵根、突破概率、物品等），
 * 对应原插件的 data_source / item_json / read_buff 中的 JSON 读取逻辑。
 */
export declare class GameData {
    readonly levels: Record<string, LevelInfo>;
    readonly roots: Record<string, RootInfo>;
    readonly levelRates: Record<string, number>;
    /** 境界进阶顺序（由突破概率表的键顺序决定） */
    readonly levelOrder: string[];
    /** 合并后的物品表，键为物品 ID 字符串 */
    readonly items: Record<string, ItemInfo>;
    /** 宗门职位配置 */
    readonly sectConfig: Record<string, {
        title: string;
        speeds?: string;
        max_exp?: number;
    }>;
    /** 悬赏令奖励数据 */
    readonly work: {
        yaocai: Record<string, Record<string, WorkTask>>;
        ansha: Record<string, Record<string, WorkTask>>;
        zuoyao: Record<string, Record<string, WorkTask>>;
        levelPrice: Record<string, Record<string, {
            level: string;
            award: number;
            needexp: number;
            time: number;
        }>>;
    };
    /** 物品 rank 数值 → 境界名称（与 nonebot USERRANK 一致：江湖好手=50 递减） */
    private readonly rankLevelMap;
    constructor();
    private loadItems;
    /** 根据物品 ID 获取物品信息 */
    getItem(id: number | string): ItemInfo | undefined;
    /** 按类型筛选物品 */
    getItemsByType(types: string[]): Record<string, ItemInfo>;
    /**
     * 按等级与类型随机获取一个物品 ID，对应 Items.get_random_id_list_by_rank_and_item_type。
     * @param finalRank 物品 rank 量纲（请用 itemRankByLevel 转换，勿用 userRank）
     */
    randomItemIdByRank(finalRank: number, itemTypes?: string[]): string | 0;
    /** 获取某境界的突破成功率 */
    getLevelRate(level: string): number;
    /** 获取某境界突破所需修为（即该境界 power 字段） */
    getLevelPower(level: string): number;
    /** 获取下一境界名称，已是最高境界返回 null */
    getNextLevel(level: string): string | null;
    /** 获取境界在进阶序列中的序号（越小越高） */
    getLevelIndex(level: string): number;
    /** 闭关修为上限（下个境界所需修为 * 倍数），对应 set_closing_type */
    closingMaxExp(level: string, multiplier: number): number;
    /** 宗门职位名称 */
    sectTitle(position: number): string;
    /** 将物品 rank 数值转为境界名称 */
    rankToLevelName(rank: number | string): string;
    /** 境界 → 物品 rank（USERRANK 量纲，与物品表 rank 字段一致） */
    itemRankByLevel(level: string): number;
    /** 解析物品的境界要求展示文案 */
    formatItemRealmRequirement(info: ItemInfo): string | undefined;
    /** 格式化物品详情（编号查询） */
    formatItemDetail(id: string | number): string | undefined;
    /**
     * 境界对应的 USERRANK 数值（越小境界越高），与原 xiuxian_config.USERRANK 同一量纲。
     * 江湖好手 = 56，依次递减，供物品/丹药等级判定使用。
     */
    userRank(level: string): number;
}
