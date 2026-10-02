import { Schema } from 'koishi';
export interface Config {
    /** 货币种类标识，对应 monetary 的 currency 字段 */
    currency: string;
    /** 是否仅在群聊中可用 */
    groupOnly: boolean;
    /** 管理员 QQ 号列表，可执行管理类指令 */
    adminQQ: string[];
    /** 群聊白名单开关：开启后仅白名单内 QQ 群可游玩 */
    groupWhitelistEnabled: boolean;
    /** 白名单 QQ 群号列表（纯数字），仅开关开启时生效 */
    groupWhitelist: string[];
    /** 白名单开启时是否也响应私聊 */
    allowPrivateChat: boolean;
    /** QQ 号黑名单：列表中的用户无论私聊/群聊均不响应 */
    userBlacklist: string[];
    /** 我的存档冷却时间（秒） */
    userInfoCd: number;
    /** 突破 CD（分钟） */
    levelUpCd: number;
    /** 闭关每分钟获取的修为 */
    closingExp: number;
    /** 闭关获取修为上限（下个境界所需修为的倍数） */
    closingExpUpperLimit: number;
    /** 突破失败扣除修为惩罚下限（百分比） */
    levelPunishmentFloor: number;
    /** 突破失败扣除修为惩罚上限（百分比） */
    levelPunishmentLimit: number;
    /** 突破失败时固定增加的成功率（百分比），用于失败累计保底 */
    levelUpProbability: number;
    /** 每日签到灵石下限 */
    signInLingShiLowerLimit: number;
    /** 每日签到灵石上限 */
    signInLingShiUpperLimit: number;
    /** 偷灵石惩罚 */
    stealCost: number;
    /** 偷灵石 CD（秒） */
    stealCd: number;
    /** 偷灵石下限（百分比） */
    stealLowerLimit: number;
    /** 偷灵石上限（百分比） */
    stealUpperLimit: number;
    /** 抢劫 CD（秒） */
    robCd: number;
    /** 重入仙途消费 */
    remakeCost: number;
    /** 创建宗门最低境界 */
    sectMinLevel: string;
    /** 创建宗门消费 */
    sectCreateCost: number;
    /** 送灵石手续费比例 */
    giveStoneTax: number;
    /** 全局指令调用冷却（秒），0 表示关闭 */
    globalCommandCd: number;
    /** 长文本自动转图片 */
    longTextToImage: boolean;
    /** 超过该行数时转图片 */
    longTextLineThreshold: number;
    /** 坊市手续费比例 */
    shopServiceCharge: number;
    /** 神秘人补货阈值：坊市全部商品数低于该值才自动补货 */
    shopRestockThreshold: number;
    /** 坊市容量上限：商品总数达到该值后禁止上架 */
    shopCapacity: number;
    /** 坊市物品过期小时数：超过该时长无人购买自动下架 */
    shopExpireHours: number;
    /** 是否自动配置 QQ 群「指令面板」（仅官方 QQ 机器人 adapter-qq 生效） */
    enablePanel: boolean;
    /** 指令面板条目：每行一条指令名（点击后填入聊天框的文本），留空则用内置默认 12 条 */
    panelEntries: string;
    /** 是否启用「金银阁·猜大小」娱乐小游戏 */
    enableJinyinge: boolean;
    /** 金银阁每日次数上限（按玩家计） */
    jinyinDailyLimit: number;
    /** 金银阁单次押注灵石上限 */
    jinyinSingleLimit: number;
    /** 金银阁每日押注灵石总额上限 */
    jinyinDailyStoneLimit: number;
    /** 金银阁冷却时间（秒） */
    jinyinCd: number;
    /** 是否启用「虚神界对决 / 俄罗斯轮盘」娱乐小游戏 */
    enableVoidDuel: boolean;
    /** 虚神界对决每日发起次数上限（按玩家计） */
    voidDuelDailyLimit: number;
    /** 虚神界对决对方接受超时时间（秒） */
    voidDuelAcceptTimeout: number;
}
export declare const Config: Schema<Config>;
//# sourceMappingURL=config.d.ts.map