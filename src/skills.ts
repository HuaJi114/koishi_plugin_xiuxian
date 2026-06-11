import { GameData } from './data'
import { ItemInfo, XiuxianSkill } from './types'

export type SkillType = '功法' | '辅修功法' | '神通'

export interface MergedSkillBuffs {
  hpbuff: number
  mpbuff: number
  atkbuff: number
  ratebuff: number
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 数值型功法加成：同属性取最高，不叠加 */
export function mergeSkillBuffs(skills: XiuxianSkill[], data: GameData): MergedSkillBuffs {
  const result: MergedSkillBuffs = { hpbuff: 0, mpbuff: 0, atkbuff: 0, ratebuff: 0 }
  for (const s of skills) {
    if (s.skillType === '神通') continue
    const info = data.getItem(s.skillId)
    if (!info) continue
    result.hpbuff = Math.max(result.hpbuff, num(info.hpbuff))
    result.mpbuff = Math.max(result.mpbuff, num(info.mpbuff))
    result.atkbuff = Math.max(result.atkbuff, num(info.atkbuff))
    result.ratebuff = Math.max(result.ratebuff, num(info.ratebuff))
  }
  return result
}

export function formatSkillEffect(info: ItemInfo): string {
  const parts: string[] = []
  const pct = (v: unknown) => typeof v === 'number' ? `${Math.round(v * 1000) / 10}%` : null
  const h = pct(info.hpbuff)
  const m = pct(info.mpbuff)
  const a = pct(info.atkbuff)
  const r = pct(info.ratebuff)
  if (h) parts.push(`气血+${h}`)
  if (m) parts.push(`真元+${m}`)
  if (a) parts.push(`攻击+${a}`)
  if (r) parts.push(`修炼效率+${r}`)
  if (info.item_type === '神通') {
    const st = num(info.skill_type)
    if (st === 1) {
      const av = info.atkvalue
      const mult = Array.isArray(av) ? av[0] : av
      parts.push(`直接伤害(攻击×${mult})`)
    } else if (st === 2) {
      parts.push(`持续伤害(${num(info.atkvalue) * 100}%攻击/回合)`)
    } else if (st === 3) {
      parts.push(`增益技能(类型${info.bufftype})`)
    }
  }
  return parts.length ? parts.join('，') : (info.desc as string) || '无详细效果'
}

export function formatMergedSkillSummary(merged: MergedSkillBuffs): string {
  const parts: string[] = []
  const pct = (v: number) => `${Math.round(v * 1000) / 10}%`
  if (merged.hpbuff > 0) parts.push(`气血+${pct(merged.hpbuff)}`)
  if (merged.mpbuff > 0) parts.push(`真元+${pct(merged.mpbuff)}`)
  if (merged.atkbuff > 0) parts.push(`攻击+${pct(merged.atkbuff)}`)
  if (merged.ratebuff > 0) parts.push(`修炼效率+${pct(merged.ratebuff)}`)
  return parts.length ? parts.join('，') : '无'
}
