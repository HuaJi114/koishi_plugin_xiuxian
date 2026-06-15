import { Context } from 'koishi'
import { Config } from '../config'
import { formatAmount } from '../utils'

/** 传承（攻击修炼）统一升级线，合并原「参悟传承」与「升级攻击修炼」 */
export function applyImpart(ctx: Context, config: Config) {
  const srv = ctx.xiuxian
  const MAX_ATK_PRACTICE = 9

  function practiceCost(nextLevel: number): number {
    return nextLevel * 500000
  }

  async function doUpgrade(userId: string, platform: string): Promise<string> {
    const player = await srv.getPlayer(userId)
    if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
    if (player.atkPractice >= MAX_ATK_PRACTICE) {
      return `道友的攻击修炼已臻化境（${MAX_ATK_PRACTICE}重），无法再进！`
    }
    const next = player.atkPractice + 1
    const cost = practiceCost(next)
    if (!(await srv.costStoneForUser(userId, cost, platform))) {
      return `参悟传承需消耗灵石${formatAmount(cost)}枚，道友灵石不足！`
    }
    await srv.addAtkPractice(userId, 1)
    await srv.updatePower(userId)
    const bonusPct = formatAmount(next * 4)
    return `道友参悟上古传承，攻击修炼提升至${next}重（攻击力+${bonusPct}%），战力大涨！`
  }

  ctx.command('xiuxian/传承帮助', '传承系统帮助')
    .action(() => [
      '传承帮助信息:',
      '1、参悟传承：消耗灵石永久提升攻击修炼（最高9重），散修与宗门弟子均可使用。',
      '2、升级攻击修炼：与【参悟传承】相同，为兼容旧指令保留。',
      `3、第 n 重消耗灵石 n×500000（例：第1重 ${formatAmount(practiceCost(1))}，第9重 ${formatAmount(practiceCost(9))}）。`,
    ].join('\n'))

  ctx.command('xiuxian/参悟传承', '消耗灵石永久提升攻击修炼（传承）')
    .action(async ({ session }) => doUpgrade(session!.userId!, session!.platform))

  ctx.command('xiuxian/升级攻击修炼', '提升攻击修炼等级（同参悟传承）')
    .action(async ({ session }) => doUpgrade(session!.userId!, session!.platform))
}
