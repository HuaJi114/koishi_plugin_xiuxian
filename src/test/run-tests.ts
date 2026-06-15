/**
 * 纯逻辑单元测试（无需 Koishi 运行时）
 * 运行：npx tsx src/test/run-tests.ts
 */
import { GameData } from '../data'
import { mergeSkillBuffs, formatMergedSkillSummary } from '../skills'
import { checkMix, tiaohe } from '../mix-elixir-util'
import { todayStr, RIFT_DAILY_LIMIT, WORK_REFRESH_DAILY_LIMIT } from '../daily-utils'
import { formatAmount, playerFight } from '../utils'
import { Fighter, XiuxianSkill } from '../types'

let passed = 0
let failed = 0

function assert(cond: boolean, msg: string): void {
  if (cond) {
    passed++
  } else {
    failed++
    console.error('FAIL:', msg)
  }
}

const data = new GameData()

// 1. 功法合并：同属性取 max
{
  const skills: XiuxianSkill[] = [
    { userId: 'u1', skillId: 1001, skillType: '功法', learnedAt: new Date() },
    { userId: 'u1', skillId: 1002, skillType: '功法', learnedAt: new Date() },
  ]
  // 使用真实物品 ID 若存在
  const allGongfa = Object.entries(data.getItemsByType(['功法'])).slice(0, 2)
  if (allGongfa.length >= 2) {
    skills[0].skillId = Number(allGongfa[0][0])
    skills[1].skillId = Number(allGongfa[1][0])
  }
  const merged = mergeSkillBuffs(skills, data)
  assert(typeof merged.atkbuff === 'number', 'mergeSkillBuffs returns atkbuff number')
  assert(formatMergedSkillSummary(merged).length >= 0, 'formatMergedSkillSummary runs')
}

// 2. 物品名称查询
{
  const item = Object.values(data.items).find((i) => i.name && i.name.length >= 2)
  if (item) {
    const found = data.findItemsByName(item.name)
    assert(found.some(([, i]) => i.name === item.name), `findItemsByName exact: ${item.name}`)
  }
}

// 3. 每日常量
{
  assert(RIFT_DAILY_LIMIT === 3, 'rift daily limit is 3')
  assert(WORK_REFRESH_DAILY_LIMIT === 3, 'work refresh limit is 3')
  assert(/^\d{4}-\d{2}-\d{2}$/.test(todayStr()), 'todayStr format')
}

// 4. 炼丹配方检测
{
  const mixConfigs: Record<string, Record<string, number>> = {}
  for (const [id, info] of Object.entries(data.getItemsByType(['合成丹药']))) {
    const cfg = info.elixir_config as Record<string, number> | undefined
    if (cfg) mixConfigs[id] = cfg
  }
  if (Object.keys(mixConfigs).length) {
    const first = Object.values(mixConfigs)[0]
    const id = checkMix(first, mixConfigs)
    assert(id > 0, 'checkMix finds recipe')
  }
}

// 5. 回合制战斗至一方归零
{
  const p1: Fighter = { userId: 'a', name: '甲', hp: 100, atk: 50, mp: 0, crit: 1, critDamage: 1.5, defense: 0 }
  const p2: Fighter = { userId: 'b', name: '乙', hp: 80, atk: 30, mp: 0, crit: 1, critDamage: 1.5, defense: 0 }
  const [log, victor, hp] = playerFight(p1, p2, data)
  assert(log.length > 2, 'playerFight produces log')
  assert(victor === '甲' || victor === '乙', 'playerFight has victor')
  assert(hp.a <= 0 || hp.b <= 0, 'playerFight ends with one side at or below 0')
}

// 6. formatAmount 精确整数
{
  assert(formatAmount(22578) === '22578', 'formatAmount exact')
  assert(formatAmount(23000) !== '2.3万', 'formatAmount no wan unit')
  assert(formatAmount(22578.9) === '22578', 'formatAmount trunc not round')
}

// 7. 辅修功法已加载
{
  assert(Object.keys(data.getItemsByType(['辅修功法'])).length > 0, 'sub skills loaded')
}

// 8. 精铁符剑 atk_buff
{
  const sword = data.getItem(7001)
  if (sword) {
    assert(Number(sword.atk_buff) === 0.04, '精铁符剑 atk_buff is 0.04')
  }
}

console.log(`\n测试结果：${passed} 通过，${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)
