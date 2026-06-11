import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Logger } from 'koishi'
import { ItemInfo, LevelInfo, RootInfo } from './types'

const logger = new Logger('huaji-xiuxian:data')

/** 数据文件根目录（随插件包发布的 data/xiuxian 目录） */
const DATA_ROOT = join(__dirname, '..', 'data', 'xiuxian')

function readJson<T>(...paths: string[]): T {
  const file = join(DATA_ROOT, ...paths)
  const content = readFileSync(file, 'utf-8')
  return JSON.parse(content) as T
}

function safeRead<T>(...paths: string[]): T {
  try {
    return readJson<T>(...paths)
  } catch (e) {
    logger.warn('数据文件 %s 加载失败：%s', paths.join('/'), (e as Error).message)
    return {} as T
  }
}

/** 悬赏令任务定义 */
export interface WorkTask {
  level: string
  succeed: string
  fail: string
}

/**
 * 游戏静态数据管理器。
 * 负责加载并缓存所有 JSON 配置（境界、灵根、突破概率、物品等），
 * 对应原插件的 data_source / item_json / read_buff 中的 JSON 读取逻辑。
 */
export class GameData {
  readonly levels: Record<string, LevelInfo>
  readonly roots: Record<string, RootInfo>
  readonly levelRates: Record<string, number>
  /** 境界进阶顺序（由突破概率表的键顺序决定） */
  readonly levelOrder: string[]
  /** 合并后的物品表，键为物品 ID 字符串 */
  readonly items: Record<string, ItemInfo>
  /** 宗门职位配置 */
  readonly sectConfig: Record<string, { title: string; speeds?: string; max_exp?: number }>
  /** 悬赏令奖励数据 */
  readonly work: {
    yaocai: Record<string, Record<string, WorkTask>>
    ansha: Record<string, Record<string, WorkTask>>
    zuoyao: Record<string, Record<string, WorkTask>>
    levelPrice: Record<string, Record<string, { level: string; award: number; needexp: number; time: number }>>
  }
  /** 物品 rank 数值 → 境界名称（与 nonebot USERRANK 一致：江湖好手=50 递减） */
  private readonly rankLevelMap = new Map<number, string>()

  constructor() {
    this.levels = readJson('境界.json')
    this.roots = readJson('灵根.json')
    this.levelRates = readJson('突破概率.json')
    this.levelOrder = Object.keys(this.levelRates)
    for (let i = 0; i < this.levelOrder.length; i++) {
      this.rankLevelMap.set(50 - i, this.levelOrder[i])
    }
    try {
      this.sectConfig = readJson('宗门玩法配置.json')
    } catch {
      this.sectConfig = {}
    }
    this.work = {
      yaocai: safeRead('work', '灵材.json'),
      ansha: safeRead('work', '暗杀.json'),
      zuoyao: safeRead('work', '镇妖.json'),
      levelPrice: safeRead('work', '等级奖励稿.json'),
    }
    this.items = {}
    this.loadItems()
    logger.info('游戏数据加载完成：境界 %d 个，灵根 %d 种，物品 %d 件',
      this.levelOrder.length, Object.keys(this.roots).length, Object.keys(this.items).length)
  }

  private loadItems() {
    const sources: Array<[string[], string]> = [
      [['装备', '防具.json'], '防具'],
      [['装备', '法器.json'], '法器'],
      [['功法', '主功法.json'], '功法'],
      [['功法', '神通.json'], '神通'],
      [['丹药', '丹药.json'], '丹药'],
      [['丹药', '药材.json'], '药材'],
      [['丹药', '炼丹丹药.json'], '合成丹药'],
      [['丹药', '炼丹炉.json'], '炼丹炉'],
      [['修炼物品', '聚灵旗.json'], '聚灵旗'],
    ]
    for (const [paths, itemType] of sources) {
      let data: Record<string, ItemInfo>
      try {
        data = readJson(...paths)
      } catch (e) {
        logger.warn('物品数据 %s 加载失败：%s', paths.join('/'), (e as Error).message)
        continue
      }
      for (const [id, info] of Object.entries(data)) {
        // 功法/神通的 level 与 rank 字段需要互换，并统一标记为技能
        if (itemType === '功法' || itemType === '神通') {
          const swap = info.rank
          info.rank = info.level as string | number
          info.level = swap as string
          info.type = '技能'
        }
        info.item_type = itemType
        this.items[id] = info
      }
    }
  }

  /** 根据物品 ID 获取物品信息 */
  getItem(id: number | string): ItemInfo | undefined {
    return this.items[String(id)]
  }

  /** 按类型筛选物品 */
  getItemsByType(types: string[]): Record<string, ItemInfo> {
    const result: Record<string, ItemInfo> = {}
    for (const [id, info] of Object.entries(this.items)) {
      if (info.item_type && types.includes(info.item_type)) result[id] = info
    }
    return result
  }

  /**
   * 按等级与类型随机获取一个物品 ID，对应 Items.get_random_id_list_by_rank_and_item_type。
   * @param finalRank 物品 rank 量纲（请用 itemRankByLevel 转换，勿用 userRank）
   */
  randomItemIdByRank(finalRank: number, itemTypes?: string[]): string | 0 {
    const ids: string[] = []
    for (const [id, info] of Object.entries(this.items)) {
      const rank = Number(info.rank ?? 99999)
      if (itemTypes && (!info.item_type || !itemTypes.includes(info.item_type))) continue
      if (rank >= finalRank && rank - finalRank <= 40) ids.push(id)
    }
    if (!ids.length) return 0
    return ids[Math.floor(Math.random() * ids.length)]
  }

  /** 获取某境界的突破成功率 */
  getLevelRate(level: string): number {
    return this.levelRates[level] ?? 0
  }

  /** 获取某境界突破所需修为（即该境界 power 字段） */
  getLevelPower(level: string): number {
    return this.levels[level]?.power ?? 0
  }

  /** 获取下一境界名称，已是最高境界返回 null */
  getNextLevel(level: string): string | null {
    const index = this.levelOrder.indexOf(level)
    if (index < 0 || index >= this.levelOrder.length - 1) return null
    return this.levelOrder[index + 1]
  }

  /** 获取境界在进阶序列中的序号（越小越高） */
  getLevelIndex(level: string): number {
    return this.levelOrder.indexOf(level)
  }

  /** 闭关修为上限（下个境界所需修为 * 倍数），对应 set_closing_type */
  closingMaxExp(level: string, multiplier: number): number {
    const next = this.getNextLevel(level)
    if (!next) return 0.001
    return Math.floor(this.getLevelPower(next) * multiplier)
  }

  /** 宗门职位名称 */
  sectTitle(position: number): string {
    return this.sectConfig[String(position)]?.title ?? '外门弟子'
  }

  /** 将物品 rank 数值转为境界名称 */
  rankToLevelName(rank: number | string): string {
    const num = Number(rank)
    if (!Number.isNaN(num)) {
      const name = this.rankLevelMap.get(num)
      if (name) return name
    }
    return typeof rank === 'string' && rank ? rank : String(rank)
  }

  /** 境界 → 物品 rank（USERRANK 量纲，与物品表 rank 字段一致） */
  itemRankByLevel(level: string): number {
    const index = this.levelOrder.indexOf(level)
    if (index < 0) return 50
    return 50 - index
  }

  /** 解析物品的境界要求展示文案 */
  formatItemRealmRequirement(info: ItemInfo): string | undefined {
    const rank = info.rank
    if (rank !== undefined && rank !== '') {
      const num = Number(rank)
      if (!Number.isNaN(num)) return this.rankToLevelName(num)
      return String(rank)
    }
    const realm = info['境界'] as string | undefined
    return realm || undefined
  }

  /** 按名称搜索物品（精确优先，再模糊） */
  findItemsByName(query: string): Array<[string, ItemInfo]> {
    const q = query.trim()
    if (!q) return []
    const exact: Array<[string, ItemInfo]> = []
    const partial: Array<[string, ItemInfo]> = []
    for (const [id, info] of Object.entries(this.items)) {
      if (info.name === q) exact.push([id, info])
      else if (info.name.includes(q)) partial.push([id, info])
    }
    return exact.length ? exact : partial
  }

  /** 格式化物品详情（编号/名称查询） */
  formatItemDetail(id: string | number): string | undefined {
    const info = this.getItem(id)
    if (!info) return undefined
    const lines = [
      `编号：${id}`,
      `名称：${info.name}`,
      `类型：${info.item_type ?? info.type ?? '未知'}`,
    ]
    if (info.level) lines.push(`品阶：${info.level}`)
    const realmReq = this.formatItemRealmRequirement(info)
    if (realmReq) lines.push(`境界要求：${realmReq}`)
    if (info.desc) lines.push(`描述：${info.desc}`)

    const pct = (v: unknown) => typeof v === 'number' ? `${Math.round(v * 1000) / 10}%` : null
    const effects: string[] = []
    const itemType = info.item_type ?? (info.type as string)

    if (itemType === '药材') {
      const elixirs = this.findElixirsForHerb(String(id))
      if (elixirs.length) effects.push(`可炼制：${elixirs.join('、')}`)
      const main = info['主药'] as { type?: number; power?: number; h_a_c?: { type?: number; power?: number } } | undefined
      if (main?.h_a_c) {
        effects.push(`主药冷热：${main.h_a_c.type === 0 ? '平' : main.h_a_c.type! > 0 ? '热' : '冷'}×${main.h_a_c.power ?? 1}`)
      }
    }

    const buffType = info.buff_type as string | undefined
    if (buffType) {
      const buffVal = Number(info.buff ?? 0)
      const labels: Record<string, string> = {
        hp: `回复气血/真元 ${pct(buffVal) ?? buffVal}`,
        all: '完全恢复气血与真元',
        exp_up: `增加修为 ${Math.floor(buffVal)} 点`,
        level_up_rate: `提升突破成功率 ${pct(buffVal) ?? buffVal}`,
        level_up_big: `大幅提升突破成功率 ${pct(buffVal) ?? buffVal}`,
        atk_buff: `永久增加攻击力 ${Math.floor(buffVal)} 点`,
      }
      effects.push(labels[buffType] ?? buffType)
      if (info.day_num !== undefined) effects.push(`每日上限 ${info.day_num} 次`)
      if (info.all_num !== undefined) effects.push(`总耐药上限 ${info.all_num} 次`)
    }

    const hpb = pct(info.hpbuff)
    const mpb = pct(info.mpbuff)
    const atkb = pct(info.atkbuff)
    const rateb = pct(info.ratebuff)
    const weaponAtk = pct(info.atk_buff)
    const weaponCrit = pct(info.crit_buff)
    const armorDef = pct(info.def_buff)
    if (hpb) effects.push(`气血加成 ${hpb}`)
    if (mpb) effects.push(`真元加成 ${mpb}`)
    if (atkb) effects.push(`攻击加成 ${atkb}`)
    if (rateb) effects.push(`闭关/修炼效率 ${rateb}`)
    if (weaponAtk) effects.push(`攻击力提升 ${weaponAtk}`)
    if (weaponCrit) effects.push(`会心率提升 ${weaponCrit}`)
    if (armorDef) effects.push(`减伤率 ${armorDef}`)

    if (itemType === '神通') {
      const st = Number(info.skill_type ?? 0)
      if (st === 1) {
        const av = info.atkvalue
        const m = Array.isArray(av) ? av[0] : av
        effects.push(`直接伤害：攻击×${m}`)
      }
      if (info.rate !== undefined) effects.push(`发动概率 ${info.rate}%`)
      if (info.hpcost) effects.push(`消耗气血 ${pct(info.hpcost)}`)
      if (info.mpcost) effects.push(`消耗真元 ${pct(info.mpcost)}`)
    }

    if (itemType === '聚灵旗') {
      const speed = info['修炼速度']
      if (speed !== undefined) effects.push(`洞天福地修炼速度 +${speed}`)
    }

    if (itemType === '炼丹炉') {
      effects.push('炼丹必备器具，持有方可炼制丹药')
    }

    if (info.price) effects.push(`参考价格 ${info.price} 灵石`)
    if (effects.length) lines.push(`效果：${effects.join('；')}`)
    else if (!info.desc) lines.push('效果：暂无详细说明')

    return lines.join('\n')
  }

  /**
   * 境界对应的 USERRANK 数值（越小境界越高），与原 xiuxian_config.USERRANK 同一量纲。
   * 江湖好手 = 56，依次递减，供物品/丹药等级判定使用。
   */
  userRank(level: string): number {
    const index = this.levelOrder.indexOf(level)
    if (index < 0) return 56
    return 56 - index
  }

  /** 药材可参与的合成丹药名称（按 elixir_config 类型匹配） */
  findElixirsForHerb(herbId: string): string[] {
    const herb = this.getItem(herbId)
    if (!herb || herb.item_type !== '药材') return []
    const mainType = String((herb['主药'] as { type?: number })?.type ?? '')
    const fyType = String((herb['辅药'] as { type?: number })?.type ?? '')
    const names = new Set<string>()
    for (const [id, info] of Object.entries(this.getItemsByType(['合成丹药']))) {
      const cfg = info.elixir_config as Record<string, number> | undefined
      if (!cfg) continue
      if (mainType && cfg[mainType] !== undefined) names.add(info.name)
      if (fyType && cfg[fyType] !== undefined) names.add(info.name)
      void id
    }
    return [...names].slice(0, 8)
  }
}
