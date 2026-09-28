/**
 * 纯逻辑单元测试（无需 Koishi 运行时）
 * 运行：npx tsx src/test/run-tests.ts
 */
import { GameData } from '../data'
import { mergeSkillBuffs, formatMergedSkillSummary } from '../skills'
import { checkMix, tiaohe } from '../mix-elixir-util'
import { todayStr, RIFT_DAILY_LIMIT, WORK_REFRESH_DAILY_LIMIT } from '../daily-utils'
import {
  formatAmount,
  playerFight,
  getBaseMaxHpMp,
  clampBaseHpMp,
  calcInitialStats,
  getPowerRate,
  rouletteSelect,
  randInt,
  generateRoot,
} from '../utils'
import { breakthrough } from '../helpers'
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

// 9. 气血/真元上限与取整一致性（锁定 resetState 浮点修复）
{
  const { maxHp, maxMp } = getBaseMaxHpMp(100)
  assert(maxHp === 50, 'getBaseMaxHpMp maxHp = floor(exp/2)')
  assert(maxMp === 100, 'getBaseMaxHpMp maxMp = floor(exp)')
  // 奇数 exp 取整
  assert(getBaseMaxHpMp(101).maxHp === 50, '奇数 exp 取整 floor')
  // clamp 不产生小数
  const clamped = clampBaseHpMp(100, 999, 999)
  assert(Number.isInteger(clamped.hp) && Number.isInteger(clamped.mp), 'clampBaseHpMp 返回整数')
  assert(clamped.hp === 50 && clamped.mp === 100, 'clampBaseHpMp 限制在基础上限')
  // calcInitialStats 返回整数
  const init = calcInitialStats(100, '五行灵根', data)
  assert(Number.isInteger(init.hp) && Number.isInteger(init.mp) && Number.isInteger(init.atk), 'calcInitialStats 返回整数')
}

// 10. clamp 边界：负值与零
{
  const zero = clampBaseHpMp(100, -5, 0)
  assert(zero.hp === 0 && zero.mp === 0, 'clamp 下限为 0')
}

// 11. 偷窃成功率边界
{
  assert(getPowerRate(100, 0) === '道友偷窃小辈实属天道所不齿！', 'getPowerRate 高位提示')
  assert(getPowerRate(1, 100) === '道友请不要不自量力！', 'getPowerRate 低位提示')
  const mid = getPowerRate(50, 50)
  assert(typeof mid === 'number' && mid === 50, 'getPowerRate 中位 50%')
}

// 12. 轮盘选择：权重决定结果
{
  const rate = { a: 100, b: 0, c: 0 }
  assert(rouletteSelect(rate) === 'a', 'rouletteSelect 唯一正权重')
  const full = rouletteSelect({ x: 1, y: 1 })
  assert(full === 'x' || full === 'y', 'rouletteSelect 返回合法键')
}

// 13. randInt 边界与含两端
{
  for (let i = 0; i < 50; i++) {
    const v = randInt(1, 1)
    assert(v === 1, 'randInt(1,1) 恒为 1')
  }
  const swapped = randInt(10, 1)
  assert(swapped >= 1 && swapped <= 10, 'randInt 自动交换区间')
}

// 14. 境界序列一致性
{
  const idx = data.getLevelIndex('江湖好手')
  assert(idx === 0, '江湖好手 为最低境界（序号 0）')
  const next = data.getNextLevel('江湖好手')
  assert(typeof next === 'string' && next.length > 0, 'getNextLevel 返回下一境界')
  assert(data.userRank('江湖好手') === 56, 'userRank 江湖好手=56')
  // itemRankByLevel 与 rankToLevelName 互逆
  const r = data.itemRankByLevel('江湖好手')
  assert(r === 50, 'itemRankByLevel 江湖好手=50')
  assert(data.rankToLevelName(r) === '江湖好手', 'rankToLevelName 互逆')
}

// 15. 闭关修为上限
{
  const cap = data.closingMaxExp('江湖好手', 1.5)
  assert(typeof cap === 'number' && cap >= 0, 'closingMaxExp 返回数值')
  assert(data.closingMaxExp('江湖好手', 0) >= 0, 'closingMaxExp 倍率为 0 不报错')
}

// 16. 突破判定：修为不足
{
  const need = data.getLevelPower(data.getNextLevel('江湖好手')!)
  assert(need > 0, '下一境界所需修为为正')
  const r = breakthrough(data, 1, 100, '江湖好手')
  assert(r.type === 'lack', '修为不足时返回 lack')
}

// 17. 突破判定：最高境界
{
  const top = data.levelOrder[data.levelOrder.length - 1]
  const r = breakthrough(data, 999999999, 100, top)
  assert(r.type === 'top', '最高境界返回 top')
}

// 18. 灵根生成
{
  for (let i = 0; i < 20; i++) {
    const [name, type] = generateRoot(data)
    assert(typeof name === 'string' && name.length > 0, 'generateRoot 名称非空')
    assert(typeof type === 'string' && data.roots[type] !== undefined, 'generateRoot 类型存在于灵根表')
  }
}

console.log(`\n测试结果：${passed} 通过，${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)
