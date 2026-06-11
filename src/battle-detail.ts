const BATTLE_DETAIL_TTL_MS = 120_000

export type BattleDetailKind = 'rob' | 'boss'

export interface BattleDetailRecord {
  kind: BattleDetailKind
  userId: string
  otherId?: string
  bossId?: number
  detail: string
  expireAt: number
}

const records: BattleDetailRecord[] = []

function prune(now = Date.now()): void {
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].expireAt <= now) records.splice(i, 1)
  }
}

export function storeBattleDetail(record: Omit<BattleDetailRecord, 'expireAt'>): void {
  prune()
  records.push({ ...record, expireAt: Date.now() + BATTLE_DETAIL_TTL_MS })
}

export function getBattleDetail(userId: string, kind?: BattleDetailKind): BattleDetailRecord | undefined {
  const now = Date.now()
  prune(now)
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i]
    if (r.expireAt <= now) continue
    if (r.userId !== userId) continue
    if (kind && r.kind !== kind) continue
    return r
  }
  return undefined
}

export const BATTLE_DETAIL_HINT = '120秒内可回复【查看战斗详情】查看战斗过程。'
