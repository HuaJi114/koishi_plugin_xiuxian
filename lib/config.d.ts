import { Schema } from 'koishi';
export interface Config {
    /** 货币种类标识，对应 monetary 的 currency 字段 */
    currency: string;
    /** 是否仅在群聊中可用 */
    groupOnly: boolean;
    /** 管理员 QQ 号列表，可执行管理类指令 */
    adminQQ: string[];
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
    /** 突破失败增加当前境界突破概率的比例 */
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
}
export declare const Config: Schema<Config>;
//# sourceMappingURL=config.d.ts.map