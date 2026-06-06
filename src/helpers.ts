import { Context, h, Session } from 'koishi'
import { Config } from './config'
import { GameData } from './data'

/** 管理指令所需的 Koishi authority 等级 */
export const ADMIN_AUTHORITY = 999

/** 将指定平台用户提升为管理员 authority（若 binding 已存在） */
export async function ensureAdminAuthority(ctx: Context, platform: string, userId: string): Promise<void> {
  const user = await ctx.database.getUser(platform, userId, ['authority'])
  if (!user || user.authority === ADMIN_AUTHORITY) return
  await ctx.database.setUser(platform, userId, { authority: ADMIN_AUTHORITY })
}

/** 插件启动时，为配置的管理员 QQ 同步 authority 等级 */
export async function syncAllAdminAuthority(ctx: Context, config: Config): Promise<void> {
  for (const qq of config.adminQQ) {
    const bindings = await ctx.database.get('binding', { pid: qq }, ['platform'])
    for (const binding of bindings) {
      await ensureAdminAuthority(ctx, binding.platform, qq)
    }
  }
}

/** 解析消息中第一个被 @ 的用户平台 ID */
export function getAtId(session: Session): string | undefined {
  const at = h.select(session.elements ?? [], 'at')[0]
  return at?.attrs.id
}

/** 突破判定结果 */
export type BreakthroughResult =
  | { type: 'top' }
  | { type: 'lack'; needExp: number; nextLevel: string }
  | { type: 'fail' }
  | { type: 'success'; nextLevel: string }

/**
 * 突破判定，对应原 OtherSet.get_type。
 * @param exp 当前修为
 * @param rate 突破成功率（含失败加成）
 * @param level 当前境界
 */
export function breakthrough(data: GameData, exp: number, rate: number, level: string): BreakthroughResult {
  const nextLevel = data.getNextLevel(level)
  if (!nextLevel) return { type: 'top' }
  const needExp = data.getLevelPower(nextLevel)
  if (exp < needExp) return { type: 'lack', needExp: needExp - exp, nextLevel }
  const success = Math.floor(Math.random() * 101) < rate
  return success ? { type: 'success', nextLevel } : { type: 'fail' }
}
