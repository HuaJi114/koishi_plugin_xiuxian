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
            [['功法', '辅修功法.json'], '辅修功法'],
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
                if (itemType === '功法' || itemType === '神通' || itemType === '辅修功法') {
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
     * 掉落规则：越高于玩家境界（rank 越小）的物品越难掉落，采用指数衰减权重；
     * 同阶及以下（rank >= finalRank）为常见掉落，最多可比玩家高 3 阶（rank 差 ≤ 15）。
     * @param finalRank 物品 rank 量纲（请用 itemRankByLevel 转换，勿用 userRank）
     * @param luck 转世气运加成点数（提升高阶物品掉落权重）
     */
    randomItemIdByRank(finalRank, itemTypes, luck = 0) {
        const candidates = [];
        for (const [id, info] of Object.entries(this.items)) {
            // rank 可能是数字字符串（如 "50"）或中文品质字符串（如 "天阶上品"）。
            // 后者经 Number() 会得到 NaN，会污染加权随机（累计权重变 NaN，区间匹配全失败，
            // 最终兜底恒返回候选列表最后一项），导致探索秘境等几乎必得真龙九变。
            // 此时回退到同物品的 level 数值字段（主功法/辅修功法均带数值 level，且与掉落
            // rank 量纲一致）；若仍无效则视为极高阶（基本不会掉落）。
            let rank = Number(info.rank);
            if (!Number.isFinite(rank)) {
                const lv = Number(info.level);
                rank = Number.isFinite(lv) ? lv : 99999;
            }
            if (itemTypes && (!info.item_type || !itemTypes.includes(info.item_type)))
                continue;
            // delta > 0 表示物品比玩家高阶（rank 更小）
            const delta = finalRank - rank;
            // 气运越高，高阶可掉范围越宽（每点气运 +1 阶，即 +5 rank 差）
            const luckSpan = luck * 5;
            // 只允许掉落：不高于玩家 (3+luck) 阶（高阶最多 +(15+luckSpan) rank 差），以及不低得离谱（<= 40 阶）
            if (delta > 15 + luckSpan)
                continue;
            if (delta < -40)
                continue;
            // 权重：同阶及以下(delta<=0)权重 1；越高阶(delta>0)指数衰减，气运越高衰减越缓
            const decay = Math.max(0.5 - luck * 0.04, 0.1);
            const weight = delta <= 0 ? 1 : Math.pow(decay, delta / 5);
            candidates.push([id, weight]);
        }
        if (!candidates.length)
            return 0;
        let total = 0;
        const intervals = [];
        for (const [id, weight] of candidates) {
            // 累积区间需连续覆盖 [0, total]，不能用 total+1 起手（会让 interval 退化为单点、
            // 相邻留 1 单位空隙，连续随机数几乎永远命中不了，最终一律兜底返回末尾物品）。
            intervals.push([total, total + weight, id]);
            total += weight;
        }
        const pick = Math.random() * total;
        for (const [lo, hi, id] of intervals) {
            if (pick >= lo && pick <= hi)
                return id;
        }
        // 理论上不可达（连续 pick 必落在某个区间内）；兜底返回首个候选，避免恒返回末尾
        return candidates[0][0];
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
    /** 按名称搜索物品（精确优先，再模糊） */
    findItemsByName(query) {
        const q = query.trim();
        if (!q)
            return [];
        const exact = [];
        const partial = [];
        for (const [id, info] of Object.entries(this.items)) {
            if (info.name === q)
                exact.push([id, info]);
            else if (info.name.includes(q))
                partial.push([id, info]);
        }
        return exact.length ? exact : partial;
    }
    /** 格式化物品详情（编号/名称查询） */
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
        const pct = (v) => typeof v === 'number' && v !== 0 ? `${Math.round(v * 1000) / 10}%` : null;
        const effects = [];
        const itemType = info.item_type ?? info.type;
        if (itemType === '药材') {
            const elixirs = this.findElixirsForHerb(String(id));
            if (elixirs.length)
                effects.push(`可炼制：${elixirs.join('、')}`);
            const main = info['主药'];
            if (main?.h_a_c) {
                effects.push(`主药冷热：${main.h_a_c.type === 0 ? '平' : main.h_a_c.type > 0 ? '热' : '冷'}×${main.h_a_c.power ?? 1}`);
            }
        }
        const buffType = info.buff_type;
        if (buffType) {
            const buffVal = Number(info.buff ?? 0);
            const labels = {
                hp: `回复气血/真元 ${pct(buffVal) ?? buffVal}`,
                all: '完全恢复气血与真元',
                exp_up: `增加修为 ${Math.floor(buffVal)} 点`,
                level_up_rate: `提升突破成功率 ${buffVal}%`,
                level_up_big: `大幅提升突破成功率 ${buffVal}%`,
                level_up: '渡厄：下次突破失败不丢失修为',
                atk_buff: `永久增加攻击力 ${Math.floor(buffVal)} 点`,
            };
            const label = labels[buffType];
            if (label) {
                effects.push(label);
                if (info.day_num !== undefined)
                    effects.push(`每日上限 ${info.day_num} 次`);
                if (info.all_num !== undefined)
                    effects.push(`总耐药上限 ${info.all_num} 次`);
            }
        }
        const hpb = pct(info.hpbuff);
        const mpb = pct(info.mpbuff);
        const atkb = pct(info.atkbuff);
        const rateb = pct(info.ratebuff);
        const weaponAtk = pct(info.atk_buff);
        const weaponCrit = pct(info.crit_buff);
        const armorDef = pct(info.def_buff);
        const armorPen = pct(info.armor_pen);
        if (hpb)
            effects.push(`气血加成 ${hpb}`);
        if (mpb)
            effects.push(`真元加成 ${mpb}`);
        if (atkb)
            effects.push(`攻击加成 ${atkb}`);
        if (rateb)
            effects.push(`闭关/修炼效率 ${rateb}`);
        if (weaponAtk)
            effects.push(`攻击力提升 ${weaponAtk}`);
        if (weaponCrit)
            effects.push(`会心率提升 ${weaponCrit}`);
        if (armorDef)
            effects.push(`减伤率 ${armorDef}`);
        if (armorPen)
            effects.push(`破甲 ${armorPen}`);
        if (itemType === '神通') {
            const st = Number(info.skill_type ?? 0);
            if (st === 1) {
                const av = info.atkvalue;
                const m = Array.isArray(av) ? av[0] : av;
                effects.push(`直接伤害：攻击×${m}`);
            }
            else if (st === 2) {
                effects.push(`持续伤害：${Math.floor(Number(info.atkvalue ?? 0) * 100)}%攻击/回合×${info.turncost ?? 1}回合`);
            }
            else if (st === 3) {
                const bt = Number(info.bufftype ?? 0);
                const bv = Math.floor(Number(info.buffvalue ?? 0) * 100);
                if (bt === 2)
                    effects.push(`战斗减伤提升 ${bv}%`);
                else if (bt === 1)
                    effects.push(`攻击增益 ${bv}%`);
                else
                    effects.push(`战斗增益(类型${bt})`);
            }
            if (info.rate !== undefined)
                effects.push(`发动概率 ${info.rate}%`);
            if (info.mpcost)
                effects.push(`消耗真元 ${Math.round(Number(info.mpcost) * 1000) / 10}%`);
            if (info.hpcost)
                effects.push(`消耗气血 ${Math.round(Number(info.hpcost) * 1000) / 10}%`);
        }
        if (itemType === '辅修功法') {
            // 辅修功法 buff_type 数字码映射（沿用原版语义）
            const subBuffType = String(info.buff_type ?? '');
            const subBuffVal = String(info.buff ?? '');
            const subLabels = {
                '1': `提升 ${subBuffVal}% 攻击力`,
                '2': `提升 ${subBuffVal}% 暴击率`,
                '3': `提升 ${subBuffVal}% 暴击伤害`,
                '4': `提升 ${subBuffVal}% 每回合气血回复`,
                '5': `提升 ${subBuffVal}% 每回合真元回复`,
                '6': `提升 ${subBuffVal}% 气血吸取`,
                '7': `提升 ${subBuffVal}% 真元吸取`,
                '8': `给对手造成 ${subBuffVal}% 中毒`,
            };
            if (subLabels[subBuffType])
                effects.push(subLabels[subBuffType]);
        }
        if (itemType === '聚灵旗') {
            const speed = info['修炼速度'];
            if (speed !== undefined)
                effects.push(`洞天福地修炼速度 +${speed}`);
            const herbSpeed = info['药材速度'];
            if (herbSpeed !== undefined)
                effects.push(`灵田药材生长速度 +${herbSpeed}`);
        }
        if (itemType === '炼丹炉') {
            const extraYield = Number(info.buff ?? 0);
            if (extraYield > 0)
                effects.push(`炼丹必备器具，丹成额外多 ${extraYield} 枚`);
            else
                effects.push('炼丹必备器具，持有方可炼制丹药');
        }
        if (info.price)
            effects.push(`参考价格 ${Math.trunc(Number(info.price))} 灵石`);
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
    /** 药材可参与的合成丹药名称（按 elixir_config 类型匹配） */
    findElixirsForHerb(herbId) {
        const herb = this.getItem(herbId);
        if (!herb || herb.item_type !== '药材')
            return [];
        const mainType = String(herb['主药']?.type ?? '');
        const fyType = String(herb['辅药']?.type ?? '');
        const names = new Set();
        for (const [id, info] of Object.entries(this.getItemsByType(['合成丹药']))) {
            const cfg = info.elixir_config;
            if (!cfg)
                continue;
            if (mainType && cfg[mainType] !== undefined)
                names.add(info.name);
            if (fyType && cfg[fyType] !== undefined)
                names.add(info.name);
            void id;
        }
        return [...names].slice(0, 8);
    }
}
exports.GameData = GameData;
//# sourceMappingURL=data.js.map