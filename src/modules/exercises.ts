import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Context } from 'koishi'
import { Config } from '../config'
import { XiuxianExercises } from '../types'
import { formatAmount, randInt } from '../utils'

declare module 'koishi' {
  interface Tables {
    xiuxian_exercises: XiuxianExercises
  }
}

interface ExerciseLevelDef {
  name: string
  costStone: number
  atkBuff: number
  defBuff: number
  critBuff: number
  critDmgBuff: number
  probability: number
}

const DATA_ROOT = join(__dirname, '..', '..', 'data', 'xiuxian')

function loadExerciseLevels(): ExerciseLevelDef[] {
  const raw = JSON.parse(readFileSync(join(DATA_ROOT, '炼体境界.json'), 'utf-8')) as Record<string, Record<string, unknown>>
  const levels: ExerciseLevelDef[] = []
  for (const [name, cfg] of Object.entries(raw)) {
    if (cfg.cost_stone === undefined) continue
    levels.push({
      name,
      costStone: Number(cfg.cost_stone),
      atkBuff: Number(cfg.atk_buff ?? 0),
      defBuff: Number(cfg.def_buff ?? 0),
      critBuff: Number(cfg.crit_buff ?? 0),
      critDmgBuff: Number(cfg.crit_dmg_buff ?? 0),
      probability: Number(cfg.probability ?? 100),
    })
  }
  return levels
}

const EXERCISE_LEVELS = loadExerciseLevels()

/** 炼体系统 */
export function applyExercises(ctx: Context, _config: Config) {
  const srv = ctx.xiuxian

  ctx.model.extend('xiuxian_exercises', {
    userId: 'string',
    exercisesLevel: { type: 'integer', initial: 0 },
    atkBuff: { type: 'integer', initial: 0 },
    defBuff: { type: 'integer', initial: 0 },
    critBuff: { type: 'integer', initial: 0 },
    critDmgBuff: { type: 'integer', initial: 0 },
  }, { primary: 'userId' })

  async function getExercises(userId: string): Promise<XiuxianExercises> {
    const [row] = await ctx.database.get('xiuxian_exercises', { userId })
    if (row) return row
    return ctx.database.create('xiuxian_exercises', {
      userId,
      exercisesLevel: 0,
      atkBuff: 0,
      defBuff: 0,
      critBuff: 0,
      critDmgBuff: 0,
    })
  }

  ctx.command('xiuxian/炼体帮助', '炼体系统帮助')
    .action(() => [
      '炼体帮助信息:',
      '1、炼体查看：查看当前炼体境界与下一层消耗、成功率',
      '2、炼体：消耗灵石尝试突破下一炼体境界，成功永久提升攻防与暴击属性',
    ].join('\n'))

  ctx.command('xiuxian/炼体查看', '查看炼体状态')
    .alias('查看炼体')
    .action(async ({ session }) => {
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      const ex = await getExercises(userId)
      const cur = ex.exercisesLevel > 0 ? EXERCISE_LEVELS[ex.exercisesLevel - 1]?.name : '未入门'
      const next = EXERCISE_LEVELS[ex.exercisesLevel]
      const lines = [
        `当前炼体：${cur}（${ex.exercisesLevel}/${EXERCISE_LEVELS.length}）`,
        `炼体加成：攻击+${formatAmount(ex.atkBuff)} 防御+${formatAmount(ex.defBuff)} 暴击+${formatAmount(ex.critBuff)} 暴伤+${formatAmount(ex.critDmgBuff)}`,
      ]
      if (next) {
        lines.push(`下一层：${next.name}，消耗灵石${formatAmount(next.costStone)}，成功率${next.probability}%`)
      } else {
        lines.push('已达最高炼体境界！')
      }
      return lines.join('\n')
    })

  ctx.command('xiuxian/炼体', '消耗灵石进行炼体突破')
    .action(async ({ session }) => {
      const userId = session!.userId!
      const pf = session!.platform
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      const ex = await getExercises(userId)
      const next = EXERCISE_LEVELS[ex.exercisesLevel]
      if (!next) return '道友炼体已臻化境，无需再炼！'
      if (!(await srv.costStoneForUser(userId, next.costStone, pf))) {
        return `炼体需消耗灵石${formatAmount(next.costStone)}枚，道友灵石不足！`
      }
      if (randInt(1, 100) > next.probability) {
        return `道友炼体失败，灵石已消耗${formatAmount(next.costStone)}枚，莫要气馁再试！`
      }
      const newLevel = ex.exercisesLevel + 1
      await ctx.database.set('xiuxian_exercises', { userId }, {
        exercisesLevel: newLevel,
        atkBuff: ex.atkBuff + next.atkBuff,
        defBuff: ex.defBuff + next.defBuff,
        critBuff: ex.critBuff + next.critBuff,
        critDmgBuff: ex.critDmgBuff + next.critDmgBuff,
      })
      await srv.updatePower(userId)
      return `恭喜道友炼体成功，晋升【${next.name}】！攻击+${formatAmount(next.atkBuff)} 防御+${formatAmount(next.defBuff)}`
    })
}

export { EXERCISE_LEVELS }
