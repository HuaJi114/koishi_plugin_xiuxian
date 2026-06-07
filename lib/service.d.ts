import { Context, Service, Session } from 'koishi';
import { Config } from './config';
import { GameData } from './data';
import { XiuxianBack, XiuxianBuff, XiuxianPlayer, XiuxianSect } from './types';
declare module 'koishi' {
    interface Context {
        xiuxian: XiuxianService;
    }
}
/**
 * 修仙核心服务。
 * 封装数据库表的增删改查、灵石经济（通过 monetary 服务）、玩家状态管理等，
 * 对应原插件的 XiuxianDateManage。
 */
export declare class XiuxianService extends Service {
    config: Config;
    static inject: string[];
    readonly data: GameData;
    constructor(ctx: Context, config: Config);
    private extendModels;
    /** 根据平台用户 ID 获取玩家（不含功法加成） */
    getPlayer(userId: string): Promise<XiuxianPlayer | undefined>;
    /** 根据道号获取玩家 */
    getPlayerByName(userName: string): Promise<XiuxianPlayer | undefined>;
    /** 获取玩家并应用功法/装备加成（对应 final_user_data） */
    getRealPlayer(userId: string): Promise<XiuxianPlayer | undefined>;
    /**
     * 将背包中 state=1 的装备同步到 buff 表。
     * 修复仅更新了背包装备状态、未写入 faqiBuff/armorBuff 的历史数据。
     */
    syncEquipBuffs(userId: string): Promise<void>;
    /** 创建玩家，已存在则返回提示 */
    createPlayer(session: Session, root: string, rootType: string, power: number, userName: string): Promise<string>;
    /** 查询时尝试的 currency 列表（配置项优先，兼容 monetary 默认的 default） */
    private monetaryCurrencies;
    /** 收集与平台用户 ID 可能关联的全部 Koishi uid */
    private collectMonetaryUids;
    /** 回写玩家表中的 uid / platform 缓存 */
    private syncPlayerUid;
    /**
     * 获取写入 monetary 时使用的 canonical uid（不创建新用户，避免重复 uid）。
     */
    getCanonicalUid(userId: string, platform?: string): Promise<number>;
    /** @deprecated 请使用 getCanonicalUid */
    resolveMonetaryUid(userId: string, platform?: string): Promise<number>;
    /** 只读汇总用户在所有候选 uid/currency 下的灵石总额 */
    private sumMonetary;
    /** 将余额迁移到 canonical uid + 配置 currency，避免分散在多条记录 */
    private normalizeMonetary;
    /** 按平台用户 ID 查询灵石 */
    getStoneForUser(userId: string, platform?: string): Promise<number>;
    /** 按平台用户 ID 增加灵石 */
    gainStoneForUser(userId: string, amount: number, platform?: string): Promise<void>;
    /** 按平台用户 ID 扣除灵石 */
    costStoneForUser(userId: string, amount: number, platform?: string): Promise<boolean>;
    /** 查询玩家灵石数量 */
    getStone(uid: number, currency?: string): Promise<number>;
    /** 增加灵石（累加至已有记录，不存在则创建） */
    gainStone(uid: number, amount: number, currency?: string): Promise<void>;
    /** 扣除灵石，成功返回 true，余额不足返回 false */
    costStone(uid: number, amount: number, currency?: string): Promise<boolean>;
    /** 通过平台用户 ID 查询灵石 */
    getStoneByUserId(userId: string, platform?: string): Promise<number>;
    /** 更新战力：power = exp * 灵根倍率 * 境界倍率 */
    updatePower(userId: string): Promise<void>;
    /** 增加修为 */
    addExp(userId: string, exp: number): Promise<void>;
    /** 减少修为 */
    reduceExp(userId: string, exp: number): Promise<void>;
    /** 增加攻击修炼等级（传承） */
    addAtkPractice(userId: string, amount: number): Promise<void>;
    /** 更新境界 */
    setLevel(userId: string, level: string): Promise<void>;
    /** 更新突破冷却为当前时间 */
    setLevelCd(userId: string): Promise<void>;
    /** 更新突破附加概率 */
    setLevelRate(userId: string, rate: number): Promise<void>;
    /** 更新道号，已存在则返回提示 */
    setUserName(userId: string, userName: string): Promise<string>;
    /** 重置气血/真元/攻击为基础值 */
    resetState(userId?: string): Promise<void>;
    /** 直接设置气血、真元（自动限制在基础上限内） */
    setHpMp(userId: string, hp: number, mp: number): Promise<void>;
    /** 战斗结束后写入双方剩余气血 */
    applyBattleHp(userId: string, combatHp: number): Promise<void>;
    /** 洗灵根（重入仙途） */
    ramake(userId: string, root: string, rootType: string): Promise<string>;
    /** 签到 */
    sign(userId: string, platform?: string): Promise<string>;
    /** 每日 0 点重置：所有「单日仅可执行一次」的指令计数 */
    resetDailyFlags(): Promise<void>;
    /** @deprecated 请使用 resetDailyFlags */
    resetSign(): Promise<void>;
    /** 获取用户状态，不存在则创建 */
    getCd(userId: string): Promise<import("./types").XiuxianCd | undefined>;
    /** 更新用户状态 */
    setState(userId: string, type: number, scheduledTime?: number): Promise<void>;
    /** 获取用户 Buff 信息，不存在则初始化 */
    getBuff(userId: string): Promise<XiuxianBuff>;
    setMainBuff(userId: string, id: number): Promise<void>;
    setSecBuff(userId: string, id: number): Promise<void>;
    setFaqiBuff(userId: string, id: number): Promise<void>;
    setArmorBuff(userId: string, id: number): Promise<void>;
    setSubBuff(userId: string, id: number): Promise<void>;
    addAtkBuff(userId: string, amount: number): Promise<void>;
    setBlessedSpot(userId: string, level: number): Promise<void>;
    setAtk(userId: string, atk: number): Promise<void>;
    /** 装备法器（自动卸下原法器） */
    equipFaqi(userId: string, goodsId: number): Promise<void>;
    /** 装备防具（自动卸下原防具） */
    equipArmor(userId: string, goodsId: number): Promise<void>;
    /** 获取背包（数量 >= 1） */
    getBack(userId: string): Promise<XiuxianBack[]>;
    /** 获取背包中某物品 */
    getBackItem(userId: string, goodsId: number): Promise<XiuxianBack | undefined>;
    /** 添加物品到背包 */
    sendBack(userId: string, goodsId: number, goodsName: string, goodsType: string, goodsNum: number, bindFlag?: number): Promise<void>;
    /** 使用/减少背包物品 */
    reduceBack(userId: string, goodsId: number, num?: number, useKey?: number): Promise<void>;
    /** 境界排行榜 TOP10 */
    realmTop(): Promise<XiuxianPlayer[]>;
    /** 获取修为最高的玩家 */
    getTopExpPlayer(): Promise<XiuxianPlayer | undefined>;
    /** 战力排行榜 TOP10 */
    powerTop(): Promise<XiuxianPlayer[]>;
    /** 灵石排行榜 TOP10 */
    stoneTop(): Promise<Array<{
        userName: string;
        stone: number;
    }>>;
    /** 初始化系统预设四大宗门（不存在则创建） */
    /** 修正所有玩家超出上限的气血/真元 */
    normalizeAllPlayerHpMp(): Promise<void>;
    /** 一次性迁移：升级前已存在的账号默认归一为散修（不自动加入任何宗门） */
    ensureExistingPlayersAsFreelancer(): Promise<void>;
    /** 宗门数据异常时回退为散修 */
    normalizeFreelancerState(): Promise<void>;
    ensurePresetSects(): Promise<void>;
    getSectByName(sectName: string): Promise<XiuxianSect | undefined>;
    /** 按宗门名称加入（用于建号选择与常规加入） */
    joinSectByName(userId: string, sectName: string): Promise<string>;
    getSectById(sectId: number): Promise<XiuxianSect | undefined>;
    getSectByOwner(userId: string): Promise<XiuxianSect | undefined>;
    createSect(userId: string, sectName: string): Promise<XiuxianSect>;
    getSectMembers(sectId: number): Promise<XiuxianPlayer[]>;
    /** 宗门建设度排行榜 */
    sectScaleTop(): Promise<XiuxianSect[]>;
}
