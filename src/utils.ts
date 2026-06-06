import { GameData } from './data'
import { Fighter } from './types'

/**
 * 数字单位化，对应原 utils.number_to。
 * 精确到最大单位 + 小数点后一位（万 / 亿）。
 */
export function numberTo(num: number): string {
  const units = ['', '万', '亿']
  let level = 0
  let value = num
  while (value >= 10000 && level < 2) {
    value /= 10000
    level += 1
  }
  return `${Math.round(value * 10) / 10}${units[level]}`
}

/** 区间内随机整数（含两端） */
export function randInt(min: number, max: number): number {
  if (max < min) [min, max] = [max, min]
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** 从数组中随机取一个元素 */
export function randChoice<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/** 从数组中随机取 n 个不重复元素 */
export function randSample<T>(list: T[], n: number): T[] {
  const copy = [...list]
  const result: T[] = []
  for (let i = 0; i < n && copy.length; i++) {
    const index = Math.floor(Math.random() * copy.length)
    result.push(copy.splice(index, 1)[0])
  }
  return result
}

/**
 * 轮盘概率计算，对应原 OtherSet.calculated。
 * 各键的权重越大被抽中概率越高。
 */
export function rouletteSelect(rate: Record<string, number>): string {
  const keys = Object.keys(rate)
  let total = 0
  const intervals: Array<[number, number, string]> = []
  for (const key of keys) {
    const weight = Math.floor(rate[key])
    intervals.push([total + 1, total + weight, key])
    total += weight
  }
  const pick = randInt(1, total)
  for (const [lo, hi, key] of intervals) {
    if (pick >= lo && pick <= hi) return key
  }
  return keys[keys.length - 1]
}

/**
 * 生成随机灵根，对应原 XiuxianJsonDate.linggen_get。
 * @returns [灵根名称, 灵根类型]
 */
export function generateRoot(data: GameData): [string, string] {
  const rateDict: Record<string, number> = {}
  for (const [name, info] of Object.entries(data.roots)) {
    rateDict[name] = info.type_rate
  }
  const rootType = rouletteSelect(rateDict)
  const info = data.roots[rootType]
  if (info.type_flag && info.type_flag.length) {
    const flag = randChoice(info.type_flag)
    const roots = randSample(info.type_list, flag)
    return [roots.join('、') + '属性灵根', rootType]
  }
  return [randChoice(info.type_list), rootType]
}

/**
 * 计算新建角色的初始气血、真元、攻击。
 * 气血/真元为满值（与当前修为上限一致）；攻击随灵根倍率在基准值附近波动。
 */
export function calcInitialStats(exp: number, rootType: string, data: GameData): { hp: number; mp: number; atk: number } {
  const rootSpeed = data.roots[rootType]?.type_speeds ?? 1
  const hp = Math.floor(exp * 0.5)
  const mp = Math.floor(exp)
  const atkBase = exp * 0.1 * rootSpeed
  const atk = Math.floor(atkBase * (0.85 + Math.random() * 0.3))
  return { hp, mp, atk: Math.max(atk, 1) }
}

/** 基础气血/真元上限（数据库存储量纲，不含功法加成） */
export function getBaseMaxHpMp(exp: number): { maxHp: number; maxMp: number } {
  return { maxHp: Math.floor(exp / 2), maxMp: Math.floor(exp) }
}

/** 将存储气血/真元限制在基础上限内 */
export function clampBaseHpMp(exp: number, hp: number, mp: number): { hp: number; mp: number } {
  const { maxHp, maxMp } = getBaseMaxHpMp(exp)
  return {
    hp: Math.min(Math.max(hp, 0), maxHp),
    mp: Math.min(Math.max(mp, 0), maxMp),
  }
}

/** 含功法加成后的展示/战斗上限 */
export function getEffectiveMaxHpMp(exp: number, hpBuff = 0, mpBuff = 0): { maxHp: number; maxMp: number } {
  const { maxHp, maxMp } = getBaseMaxHpMp(exp)
  return {
    maxHp: Math.floor(maxHp * (1 + hpBuff)),
    maxMp: Math.floor(maxMp * (1 + mpBuff)),
  }
}

/** 是否处于重伤（气血不超过修为上限的 10%） */
export function isHeavilyInjured(exp: number, hp: number): boolean {
  return hp <= Math.floor(exp / 10)
}

/** 计算两个时间的秒差 */
export function dateDiffSeconds(newTime: Date | number, oldTime: Date | number): number {
  const a = newTime instanceof Date ? newTime.getTime() : new Date(newTime).getTime()
  const b = oldTime instanceof Date ? oldTime.getTime() : new Date(oldTime).getTime()
  return Math.floor((a - b) / 1000)
}

/**
 * 计算偷窃成功率，对应原 OtherSet.get_power_rate。
 * @returns 数值为成功率百分比；字符串为提示信息。
 */
export function getPowerRate(mind: number, other: number): number | string {
  const powerRate = mind / (other + mind)
  if (powerRate >= 0.8) return '道友偷窃小辈实属天道所不齿！'
  if (powerRate <= 0.05) return '道友请不要不自量力！'
  return Math.floor(powerRate * 100)
}

/**
 * 简单回合制战斗，对应原 OtherSet.player_fight。
 * @returns [战斗过程文本列表, 胜者道号, 双方剩余气血]
 */
export function playerFight(p1: Fighter, p2: Fighter): [string[], string, Record<string, number>] {
  const log: string[] = []
  const hp = { [p1.userId]: Math.max(p1.hp, 1), [p2.userId]: Math.max(p2.hp, 1) }
  let victor = ''
  const attack = (attacker: Fighter, defender: Fighter): void => {
    let dmgBase = Math.floor((0.95 + Math.random() * 0.1) * attacker.atk)
    let crit = ''
    if (randInt(0, 100) <= attacker.crit) {
      dmgBase = Math.floor(dmgBase * attacker.critDamage)
      crit = '会心一击，'
    }
    const dmg = Math.floor(dmgBase * (1 - defender.defense))
    hp[defender.userId] -= dmg
    log.push(`${attacker.name}发起${crit}造成了${dmg}伤害`)
    log.push(`${defender.name}剩余血量${Math.max(hp[defender.userId], 0)}`)
  }
  // 防止异常数据导致死循环
  for (let turn = 0; turn < 200; turn++) {
    attack(p1, p2)
    if (hp[p2.userId] <= 0) { victor = p1.name; break }
    attack(p2, p1)
    if (hp[p1.userId] <= 0) { victor = p2.name; break }
  }
  if (!victor) victor = hp[p1.userId] >= hp[p2.userId] ? p1.name : p2.name
  log.push(`${victor}胜利`)
  return [log, victor, { ...hp }]
}
