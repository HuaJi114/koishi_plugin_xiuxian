import { Schema } from 'koishi'

export interface Config {
  /** 货币种类标识，对应 monetary 的 currency 字段 */
  currency: string
  /** 是否仅在群聊中可用 */
  groupOnly: boolean
  /** 管理员 QQ 号列表，可执行管理类指令 */
  adminQQ: string[]
  /** 我的存档冷却时间（秒） */
  userInfoCd: number
  /** 突破 CD（分钟） */
  levelUpCd: number
  /** 闭关每分钟获取的修为 */
  closingExp: number
  /** 闭关获取修为上限（下个境界所需修为的倍数） */
  closingExpUpperLimit: number
  /** 突破失败扣除修为惩罚下限（百分比） */
  levelPunishmentFloor: number
  /** 突破失败扣除修为惩罚上限（百分比） */
  levelPunishmentLimit: number
  /** 突破失败增加当前境界突破概率的比例 */
  levelUpProbability: number
  /** 每日签到灵石下限 */
  signInLingShiLowerLimit: number
  /** 每日签到灵石上限 */
  signInLingShiUpperLimit: number
  /** 偷灵石惩罚 */
  stealCost: number
  /** 偷灵石 CD（秒） */
  stealCd: number
  /** 偷灵石下限（百分比） */
  stealLowerLimit: number
  /** 偷灵石上限（百分比） */
  stealUpperLimit: number
  /** 抢劫 CD（秒） */
  robCd: number
  /** 重入仙途消费 */
  remakeCost: number
  /** 创建宗门最低境界 */
  sectMinLevel: string
  /** 创建宗门消费 */
  sectCreateCost: number
  /** 送灵石手续费比例 */
  giveStoneTax: number
  /** 全局指令调用冷却（秒），0 表示关闭 */
  globalCommandCd: number
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    currency: Schema.string().default('default').description('灵石所使用的 monetary 货币种类标识。'),
    groupOnly: Schema.boolean().default(true).description('是否仅在群聊（非私聊）中响应指令。'),
    adminQQ: Schema.array(String).role('table').default([]).description('管理员 QQ 号列表。填写后自动将对应用户的 Koishi authority 设为 999，可执行需 authority 999 的管理指令。'),
    globalCommandCd: Schema.number().default(0).description('全局指令调用冷却（秒），0 表示关闭。'),
  }).description('基础设置'),

  Schema.object({
    signInLingShiLowerLimit: Schema.number().default(200000).description('每日签到灵石下限。'),
    signInLingShiUpperLimit: Schema.number().default(500000).description('每日签到灵石上限。'),
    closingExp: Schema.number().default(30).description('闭关每分钟获取的修为。'),
    closingExpUpperLimit: Schema.number().role('').default(1.5).description('闭关获取修为上限（下个境界所需修为的倍数）。'),
    userInfoCd: Schema.number().default(60).description('我的存档冷却时间（秒）。'),
  }).description('修炼与签到'),

  Schema.object({
    levelUpCd: Schema.number().default(60).description('突破冷却时间（分钟）。'),
    levelPunishmentFloor: Schema.number().default(1).description('突破失败扣除修为惩罚下限（百分比）。'),
    levelPunishmentLimit: Schema.number().default(10).description('突破失败扣除修为惩罚上限（百分比）。'),
    levelUpProbability: Schema.number().role('').default(0.3).description('突破失败时增加突破概率的比例。'),
  }).description('突破设置'),

  Schema.object({
    remakeCost: Schema.number().default(100000).description('重入仙途（洗灵根）的消费。'),
    giveStoneTax: Schema.number().role('').default(0.1).description('赠送灵石的手续费比例。'),
    stealCost: Schema.number().default(1000000).description('偷灵石失败的赔偿。'),
    stealCd: Schema.number().default(600).description('偷灵石冷却时间（秒）。'),
    stealLowerLimit: Schema.number().role('').default(0.01).description('偷灵石获取下限（百分比）。'),
    stealUpperLimit: Schema.number().role('').default(0.2).description('偷灵石获取上限（百分比）。'),
    robCd: Schema.number().default(600).description('抢劫冷却时间（秒）。'),
  }).description('灵石互动'),

  Schema.object({
    sectMinLevel: Schema.string().default('铭纹境圆满').description('创建宗门所需最低境界。'),
    sectCreateCost: Schema.number().default(5000000).description('创建宗门的消费。'),
  }).description('宗门设置'),
])
