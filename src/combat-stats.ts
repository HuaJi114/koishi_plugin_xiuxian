import { GameData } from './data'
import { mergeSkillBuffs, MergedSkillBuffs } from './skills'
import { Fighter, ItemInfo, XiuxianBuff, XiuxianPlayer } from './types'
import type { XiuxianService } from './service'

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export interface CombatStatBreakdown {
  baseAtk: number
  finalAtk: number
  practiceRate: number
  mainAtkRate: number
  weaponAtkRate: number
  permAtkBonus: number
  critRate: number
  defenseRate: number
  merged: MergedSkillBuffs
}

/** 计算最终攻击与加成明细（对应 nonebot final_user_data） */
export function computeCombatStats(
  player: XiuxianPlayer,
  buff: XiuxianBuff,
  data: GameData,
  merged?: MergedSkillBuffs,
): CombatStatBreakdown {
  const skillMerged = merged ?? { hpbuff: 0, mpbuff: 0, atkbuff: 0, ratebuff: 0 }
  const weapon = buff.faqiBuff > 0 ? data.getItem(buff.faqiBuff) : undefined
  const armor = buff.armorBuff > 0 ? data.getItem(buff.armorBuff) : undefined

  const practiceRate = player.atkPractice * 0.04
  const mainAtkRate = skillMerged.atkbuff
  const weaponAtkRate = num(weapon?.atk_buff)
  const permAtkBonus = num(buff.atkBuff)

  const baseAtk = num(player.atk)
  const finalAtk = Math.floor(baseAtk * (practiceRate + 1) * (1 + mainAtkRate) * (1 + weaponAtkRate)) + permAtkBonus

  const critBuff = num(weapon?.crit_buff)
  const critRate = critBuff > 0 ? Math.max(1, Math.floor(critBuff * 100)) : 1
  const defenseRate = num(armor?.def_buff)

  return {
    baseAtk,
    finalAtk,
    practiceRate,
    mainAtkRate,
    weaponAtkRate,
    permAtkBonus,
    critRate,
    defenseRate,
    merged: skillMerged,
  }
}

/** 构建 PVP/PVE 战斗快照（含法器攻击/会心、防具减伤、神通列表） */
export async function buildFighter(srv: XiuxianService, userId: string): Promise<Fighter | undefined> {
  await srv.syncEquipBuffs(userId)
  const real = await srv.getRealPlayer(userId)
  const base = await srv.getPlayer(userId)
  if (!real || !base) return undefined

  const buff = await srv.getBuff(userId)
  const skills = await srv.getLearnedSkills(userId)
  const merged = mergeSkillBuffs(skills, srv.data)
  const stats = computeCombatStats(base, buff, srv.data, merged)
  const secSkillIds = await srv.getSecSkillIds(userId)
  const ex = await srv.getExercises(userId)

  let atk = stats.finalAtk
  let defense = stats.defenseRate
  let crit = stats.critRate
  if (ex) {
    atk += ex.atkBuff
    defense = Math.min(defense + ex.defBuff / 10000, 0.9)
    crit += ex.critBuff
  }

  return {
    userId,
    name: real.userName,
    hp: Math.max(base.hp, 0),
    atk,
    mp: base.mp,
    crit,
    critDamage: 1.5 + (ex?.critDmgBuff ?? 0) / 1000,
    defense,
    secSkillIds,
  }
}

export function formatAtkBreakdown(stats: CombatStatBreakdown): string {
  const parts: string[] = [`基础${stats.baseAtk}`]
  if (stats.practiceRate > 0) parts.push(`攻修+${Math.floor(stats.practiceRate * 100)}%`)
  if (stats.mainAtkRate > 0) parts.push(`功法+${Math.floor(stats.mainAtkRate * 100)}%`)
  if (stats.weaponAtkRate > 0) parts.push(`法器+${Math.floor(stats.weaponAtkRate * 100)}%`)
  if (stats.permAtkBonus > 0) parts.push(`永久+${stats.permAtkBonus}`)
  return parts.join('，')
}

export function itemEquipType(info: ItemInfo, goodsType?: string): '法器' | '防具' | null {
  const t = info.item_type ?? goodsType ?? (info.type as string)
  if (t === '法器') return '法器'
  if (t === '防具') return '防具'
  if (t === '装备') {
    const name = info.name ?? ''
    if (name.includes('甲') || name.includes('袍') || name.includes('衣')) return '防具'
    return '法器'
  }
  return null
}
