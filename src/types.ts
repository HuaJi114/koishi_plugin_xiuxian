import {} from 'koishi-plugin-monetary'

declare module 'koishi' {
  interface Tables {
    xiuxian_player: XiuxianPlayer
    xiuxian_cd: XiuxianCd
    xiuxian_sect: XiuxianSect
    xiuxian_back: XiuxianBack
    xiuxian_buff: XiuxianBuff
    xiuxian_meta: XiuxianMeta
  }
}

/**
 * 玩家主表，对应原 nonebot 插件的 user_xiuxian。
 * 灵石（货币）不在此表中，统一通过 monetary 服务管理。
 */
export interface XiuxianPlayer {
  /** 平台用户 ID（如 QQ 号），主键 */
  userId: string
  /** 平台标识（如 onebot），用于解析 monetary uid */
  platform: string
  /** Koishi 数值用户 ID，用于 monetary 货币操作（缓存，以 resolveMonetaryUid 为准） */
  uid: number
  /** 灵根名称 */
  root: string
  /** 灵根类型 */
  rootType: string
  /** 境界名称 */
  level: string
  /** 战力 */
  power: number
  /** 创建时间 */
  createTime: Date
  /** 是否已签到，0 未签到 1 已签到 */
  isSign: number
  /** 修为 */
  exp: number
  /** 道号 */
  userName: string
  /** 突破冷却起始时间 */
  levelUpCd: Date
  /** 突破失败累计加成概率 */
  levelUpRate: number
  /** 所属宗门 ID */
  sectId: number
  /** 宗门职位 */
  sectPosition: number
  /** 当前气血 */
  hp: number
  /** 当前真元 */
  mp: number
  /** 当前攻击 */
  atk: number
  /** 攻击修炼等级 */
  atkPractice: number
  /** 宗门任务次数 */
  sectTask: number
  /** 当前接取的宗门任务编号（0 表示无） */
  sectMissionId: number
  /** 上次完成宗门任务时间（12 小时冷却） */
  sectMissionDoneAt: Date
  /** 宗门贡献度 */
  sectContribution: number
  /** 当日宗门丹药领取标记 */
  sectElixirGet: number
  /** 当日宗门供奉领取标记 */
  sectOfferingGet: number
  /** 洞天福地是否开启 */
  blessedSpotFlag: number
  /** 洞天福地名称 */
  blessedSpotName: string
  /** 上次探索秘境时间（60 分钟 CD） */
  riftCd: Date
}

/** 用户状态/冷却表，对应原 user_cd 表 */
export interface XiuxianCd {
  /** 平台用户 ID，主键 */
  userId: string
  /** 状态：0 无状态 1 闭关中 2 历练中 3 秘境中 */
  type: number
  /** 状态开始时间 */
  createTime: Date
  /** 计划时长（秒/分钟，按业务含义） */
  scheduledTime: number
}

/** 宗门表，对应原 sects 表 */
export interface XiuxianSect {
  sectId: number
  sectName: string
  /** 宗主平台用户 ID */
  sectOwner: string
  /** 建设度 */
  sectScale: number
  /** 已用灵石 */
  sectUsedStone: number
  /** 宗门灵田 */
  sectFairyland: number
  /** 宗门资材 */
  sectMaterials: number
  /** 宗门主修功法 ID */
  mainBuff: number
  /** 宗门神通 ID */
  secBuff: number
  /** 丹房等级 */
  elixirRoomLevel: number
}

/** 背包表，对应原 back 表 */
export interface XiuxianBack {
  userId: string
  goodsId: number
  goodsName: string
  goodsType: string
  goodsNum: number
  createTime: Date
  updateTime: Date
  remake: string
  /** 当日使用次数（丹药耐药性） */
  dayNum: number
  /** 累计使用次数 */
  allNum: number
  actionTime: Date
  /** 装备状态：0 未装备 1 已装备 */
  state: number
  /** 绑定数量 */
  bindNum: number
}

/** 用户 Buff 表，对应原 BuffInfo 表 */
export interface XiuxianBuff {
  userId: string
  /** 主修功法物品 ID */
  mainBuff: number
  /** 神通物品 ID */
  secBuff: number
  /** 法器物品 ID */
  faqiBuff: number
  /** 法宝物品 ID */
  fabaoWeapon: number
  /** 防具物品 ID */
  armorBuff: number
  /** 永久攻击加成 */
  atkBuff: number
  /** 洞天福地等级 */
  blessedSpot: number
  /** 辅修功法 ID */
  subBuff: number
}

/** 插件元数据（迁移标记等） */
export interface XiuxianMeta {
  key: string
  value: string
}

/** 境界数据（来自 境界.json） */
export interface LevelInfo {
  power: number
  ATK: number
  AC: number
  spend: number
  HP: number
  MP: number
  comment: number
  rate: number
  exp: number
  SP: number
  SP_RA: number
}

/** 灵根数据（来自 灵根.json） */
export interface RootInfo {
  type_rate: number
  type_list: string[]
  type_speeds: number
  type_flag: number[]
}

/** 物品基础数据 */
export interface ItemInfo {
  id?: string
  name: string
  level?: string
  rank?: number | string
  type?: string
  item_type?: string
  desc?: string
  price?: number
  [key: string]: unknown
}

/** 战斗角色快照 */
export interface Fighter {
  userId: string
  name: string
  hp: number
  atk: number
  mp: number
  /** 会心率（百分比） */
  crit: number
  /** 爆伤倍率 */
  critDamage: number
  /** 减伤率 */
  defense: number
}
