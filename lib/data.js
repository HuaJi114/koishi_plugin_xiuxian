"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameData = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const koishi_1 = require("koishi");
const logger = new koishi_1.Logger('huaji-xiuxian:data');
/** 数据文件根目录（随插件包发布的 data/xiuxian 目录） */
const DATA_ROOT = (0, node_path_1.join)(__dirname, '..', 'data', 'xiuxian');
function readJson(...paths) {
    const file = (0, node_path_1.join)(DATA_ROOT, ...paths);
    const content = (0, node_fs_1.readFileSync)(file, 'utf-8');
    return JSON.parse(content);
}
function safeRead(...paths) {
    try {
        return readJson(...paths);
    }
    catch (e) {
        logger.warn('数据文件 %s 加载失败：%s', paths.join('/'), e.message);
        return {};
    }
}
/**
 * 游戏静态数据管理器。
 * 负责加载并缓存所有 JSON 配置（境界、灵根、突破概率、物品等），
 * 对应原插件的 data_source / item_json / read_buff 中的 JSON 读取逻辑。
 */
class GameData {
    constructor() {
        /** 物品 rank 数值 → 境界名称（与 nonebot USERRANK 一致：江湖好手=50 递减） */
        this.rankLevelMap = new Map();
        this.levels = readJson('境界.json');
        this.roots = readJson('灵根.json');
        this.levelRates = readJson('突破概率.json');
        this.levelOrder = Object.keys(this.levelRates);
        for (let i = 0; i < this.levelOrder.length; i++) {
            this.rankLevelMap.set(50 - i, this.levelOrder[i]);
        }
        try {
            this.sectConfig = readJson('宗门玩法配置.json');
        }
        catch {
            this.sectConfig = {};
        }
        this.work = {
            yaocai: safeRead('work', '灵材.json'),
            ansha: safeRead('work', '暗杀.json'),
            zuoyao: safeRead('work', '镇妖.json'),
            levelPrice: safeRead('work', '等级奖励稿.json'),
        };
        this.items = {};
        this.loadItems();
        logger.info('游戏数据加载完成：境界 %d 个，灵根 %d 种，物品 %d 件', this.levelOrder.length, Object.keys(this.roots).length, Object.keys(this.items).length);
    }
    loadItems() {
        const sources = [
            [['装备', '防具.json'], '防具'],
            [['装备', '法器.json'], '法器'],
            [['功法', '主功法.json'], '功法'],
            [['功法', '神通.json'], '神通'],
            [['丹药', '丹药.json'], '丹药'],
            [['丹药', '药材.json'], '药材'],
            [['丹药', '炼丹丹药.json'], '合成丹药'],
            [['丹药', '炼丹炉.json'], '炼丹炉'],
            [['修炼物品', '聚灵旗.json'], '聚灵旗'],
        ];
        for (const [paths, itemType] of sources) {
            let data;
            try {
                data = readJson(...paths);
            }
            catch (e) {
                logger.warn('物品数据 %s 加载失败：%s', paths.join('/'), e.message);
                continue;
            }
            for (const [id, info] of Object.entries(data)) {
                // 功法/神通的 level 与 rank 字段需要互换，并统一标记为技能
                if (itemType === '功法' || itemType === '神通') {
                    const swap = info.rank;
                    info.rank = info.level;
                    info.level = swap;
                    info.type = '技能';
                }
                info.item_type = itemType;
                this.items[id] = info;
            }
        }
    }
    /** 根据物品 ID 获取物品信息 */
    getItem(id) {
        return this.items[String(id)];
    }
    /** 按类型筛选物品 */
    getItemsByType(types) {
        const result = {};
        for (const [id, info] of Object.entries(this.items)) {
            if (info.item_type && types.includes(info.item_type))
                result[id] = info;
        }
        return result;
    }
    /**
     * 按等级与类型随机获取一个物品 ID，对应 Items.get_random_id_list_by_rank_and_item_type。
     * @param finalRank 物品 rank 量纲（请用 itemRankByLevel 转换，勿用 userRank）
     */
    randomItemIdByRank(finalRank, itemTypes) {
        const ids = [];
        for (const [id, info] of Object.entries(this.items)) {
            const rank = Number(info.rank ?? 99999);
            if (itemTypes && (!info.item_type || !itemTypes.includes(info.item_type)))
                continue;
            if (rank >= finalRank && rank - finalRank <= 40)
                ids.push(id);
        }
        if (!ids.length)
            return 0;
        return ids[Math.floor(Math.random() * ids.length)];
    }
    /** 获取某境界的突破成功率 */
    getLevelRate(level) {
        return this.levelRates[level] ?? 0;
    }
    /** 获取某境界突破所需修为（即该境界 power 字段） */
    getLevelPower(level) {
        return this.levels[level]?.power ?? 0;
    }
    /** 获取下一境界名称，已是最高境界返回 null */
    getNextLevel(level) {
        const index = this.levelOrder.indexOf(level);
        if (index < 0 || index >= this.levelOrder.length - 1)
            return null;
        return this.levelOrder[index + 1];
    }
    /** 获取境界在进阶序列中的序号（越小越高） */
    getLevelIndex(level) {
        return this.levelOrder.indexOf(level);
    }
    /** 闭关修为上限（下个境界所需修为 * 倍数），对应 set_closing_type */
    closingMaxExp(level, multiplier) {
        const next = this.getNextLevel(level);
        if (!next)
            return 0.001;
        return Math.floor(this.getLevelPower(next) * multiplier);
    }
    /** 宗门职位名称 */
    sectTitle(position) {
        return this.sectConfig[String(position)]?.title ?? '外门弟子';
    }
    /** 将物品 rank 数值转为境界名称 */
    rankToLevelName(rank) {
        const num = Number(rank);
        if (!Number.isNaN(num)) {
            const name = this.rankLevelMap.get(num);
            if (name)
                return name;
        }
        return typeof rank === 'string' && rank ? rank : String(rank);
    }
    /** 境界 → 物品 rank（USERRANK 量纲，与物品表 rank 字段一致） */
    itemRankByLevel(level) {
        const index = this.levelOrder.indexOf(level);
        if (index < 0)
            return 50;
        return 50 - index;
    }
    /** 解析物品的境界要求展示文案 */
    formatItemRealmRequirement(info) {
        const rank = info.rank;
        if (rank !== undefined && rank !== '') {
            const num = Number(rank);
            if (!Number.isNaN(num))
                return this.rankToLevelName(num);
            return String(rank);
        }
        const realm = info['境界'];
        return realm || undefined;
    }
    /** 格式化物品详情（编号查询） */
    formatItemDetail(id) {
        const info = this.getItem(id);
        if (!info)
            return undefined;
        const lines = [
            `编号：${id}`,
            `名称：${info.name}`,
            `类型：${info.item_type ?? info.type ?? '未知'}`,
        ];
        if (info.level)
            lines.push(`品阶：${info.level}`);
        const realmReq = this.formatItemRealmRequirement(info);
        if (realmReq)
            lines.push(`境界要求：${realmReq}`);
        if (info.desc)
            lines.push(`描述：${info.desc}`);
        const pct = (v) => typeof v === 'number' ? `${Math.round(v * 1000) / 10}%` : null;
        const effects = [];
        const buffType = info.buff_type;
        if (buffType) {
            const buffLabels = {
                hp: '回复气血/真元',
                all: '完全恢复状态',
                exp_up: '增加修为',
                level_up_rate: '提升突破概率',
                level_up_big: '大幅提升突破概率',
            };
            effects.push(buffLabels[buffType] ?? buffType);
            if (info.buff !== undefined)
                effects.push(`效果系数：${info.buff}`);
        }
        const hpb = pct(info.hpbuff);
        const mpb = pct(info.mpbuff);
        const atkb = pct(info.atkbuff);
        const rateb = pct(info.ratebuff);
        const weaponAtk = pct(info.atk_buff);
        if (hpb)
            effects.push(`气血加成：${hpb}`);
        if (mpb)
            effects.push(`真元加成：${mpb}`);
        if (atkb)
            effects.push(`攻击加成：${atkb}`);
        if (rateb)
            effects.push(`闭关/修炼效率：${rateb}`);
        if (weaponAtk)
            effects.push(`法器攻击加成：${weaponAtk}`);
        if (info.price)
            effects.push(`参考价格：${info.price}灵石`);
        if (effects.length)
            lines.push(`效果：${effects.join('；')}`);
        else if (!info.desc)
            lines.push('效果：暂无详细说明');
        return lines.join('\n');
    }
    /**
     * 境界对应的 USERRANK 数值（越小境界越高），与原 xiuxian_config.USERRANK 同一量纲。
     * 江湖好手 = 56，依次递减，供物品/丹药等级判定使用。
     */
    userRank(level) {
        const index = this.levelOrder.indexOf(level);
        if (index < 0)
            return 56;
        return 56 - index;
    }
}
exports.GameData = GameData;
//# sourceMappingURL=data.js.map