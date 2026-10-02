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
  luckPoints,
  luckBonus,
} from '../utils'
import { breakthrough } from '../helpers'
import { Fighter, XiuxianSkill } from '../types'
import { resolvePresetSectInput, PRESET_SECTS } from '../preset-sects'

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
  const p1: Fighter = { userId: 'a', name: '甲', hp: 100, atk: 50, mp: 0, crit: 1, critDamage: 1.5, defense: 0, armorPen: 0 }
  const p2: Fighter = { userId: 'b', name: '乙', hp: 80, atk: 30, mp: 0, crit: 1, critDamage: 1.5, defense: 0, armorPen: 0 }
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

// 9. 破防机制：攻击方 armorPen 抵消防守方减伤
{
  const attacker: Fighter = { userId: 'a', name: '攻', hp: 1000, atk: 100, mp: 0, crit: 0, critDamage: 1.5, defense: 0, armorPen: 0.5 }
  const defender: Fighter = { userId: 'b', name: '守', hp: 10000, atk: 1, mp: 0, crit: 0, critDamage: 1.5, defense: 0.5, armorPen: 0 }
  const [log] = playerFight(attacker, defender, data)
  const firstHit = log.find((l) => l.includes('造成'))
  assert(!!firstHit, '破防战斗产生伤害日志')
  // 破防 0.5 恰好抵消防守 0.5，伤害应接近全额（atk≈100，而非减半后的 50）
  const dmgNum = firstHit ? Number(firstHit.replace(/[^0-9]/g, '')) : 0
  assert(dmgNum > 50, `破防后伤害应大于减半值，实际 ${dmgNum}`)
}

// 10. 装备掉落加权：同阶装备应比高阶更容易命中（rank 越大越常见）
{
  const itemRank = data.itemRankByLevel('练气境初期')
  // 统计多次随机，验证返回的装备 rank 不会极端越级（不应出现比玩家高太多阶的顶级仙器 rank 18）
  let maxSeen = 0
  for (let i = 0; i < 200; i++) {
    const id = data.randomItemIdByRank(itemRank, ['法器'])
    if (id === 0) continue
    const info = data.getItem(id)
    if (info && info.rank !== undefined) {
      const r = Number(info.rank)
      if (r < maxSeen || maxSeen === 0) maxSeen = r
    }
  }
  // 练气境初期对应 rank 约 47，掉落物品 rank 不应小于 32（即最多高 3 阶 = rank 47-15=32）
  assert(maxSeen >= 32, `掉落装备不应越级过高，最小 rank 应为 32，实际 ${maxSeen}`)
}

// 11. 突破保底：失败后 levelUpRate 累加，成功后清零（逻辑一致性）
{
  const level = '太乙境圆满'
  const baseRate = data.getLevelRate(level)
  assert(baseRate === 2, `太乙境圆满基础突破率应为 2%，实际 ${baseRate}`)
  // 验证数据里不再有锁死 1% 的后期境界（渡劫境圆满以上）
  const lowRateLevels = data.levelOrder.filter((l) => data.getLevelRate(l) === 1 && data.getLevelIndex(l) > data.getLevelIndex('渡劫境初期'))
  assert(lowRateLevels.length === 0, `后期境界不应再有锁死 1% 的突破率，实际 ${lowRateLevels.join(',')}`)
}

// 12. 转世气运：luckPoints 封顶、luckBonus 换算，及高阶掉落权重随气运提升
{
  assert(luckPoints(undefined) === 0, '未转世气运为 0')
  assert(luckPoints(0) === 0, '转世 0 次气运为 0')
  assert(luckPoints(3) === 3, '转世 3 次气运为 3')
  assert(luckPoints(10) === 5, '气运封顶为 5 点')
  assert(luckBonus(2) === 2, '2 点气运 = 2% 概率加成')
  assert(luckBonus(99) === 5, '气运加成封顶为 5%')

  // 高阶掉落：无气运时，练气境初期（rank≈47）不会掉 rank 32 以下（高于 3 阶以上）的物品
  const itemRank = data.itemRankByLevel('练气境初期')
  let lowWithNoLuck = 0
  for (let i = 0; i < 300; i++) {
    const id = data.randomItemIdByRank(itemRank, ['法器'], 0)
    if (id === 0) continue
    const info = data.getItem(id)
    const r = info && info.rank !== undefined ? Number(info.rank) : 99999
    if (r < 32) lowWithNoLuck++
  }
  assert(lowWithNoLuck === 0, '无气运时不应掉落高于 3 阶以上的法器')

  // 满气运（5 点）时，可掉范围扩至 +8 阶（rank 差 +40），应能命中 rank 更低的更高阶物品
  let minRankWithLuck = 99999
  for (let i = 0; i < 500; i++) {
    const id = data.randomItemIdByRank(itemRank, ['法器'], 5)
    if (id === 0) continue
    const info = data.getItem(id)
    const r = info && info.rank !== undefined ? Number(info.rank) : 99999
    if (r < minRankWithLuck) minRankWithLuck = r
  }
  assert(minRankWithLuck < 47, `满气运应能命中高于自身境界的法器，实际最小 rank ${minRankWithLuck}`)
}

// 13. 回归：非数字 rank 物品不应污染加权随机（修复探索秘境几乎必得真龙九变）
{
  // 真龙九变 rank 为中文品质「天阶上品」，主功法/辅修功法共 127 件带此类 rank。
  // 修复前 Number('天阶上品')=NaN 会令累计权重变 NaN，兜底恒返回候选末尾（id 最大的 10411=真龙九变）。
  let zhulong = 0
  const seen = new Set<string>()
  const finalRank = 1 // 模拟高阶玩家，使真龙九变（rank 21）在可掉范围内
  for (let i = 0; i < 500; i++) {
    const id = data.randomItemIdByRank(finalRank, undefined, 0)
    assert(id !== 0 && typeof id === 'string', '应返回有效物品而非 0')
    const idStr = id as string
    if (idStr === '10411') zhulong++
    seen.add(idStr)
  }
  assert(zhulong < 250, `真龙九变不应几乎必出（修复前 500/500），实际 ${zhulong}/500`)
  assert(seen.size > 3, `掉落分布应多样，实际仅 ${seen.size} 种`)
}

// 14. 物品详情功效数值展示（formatItemDetail）
{
  // 突破丹（level_up_big）：buff 为整数百分比，应直接显示 +30%，而非 3000%
  const jidan = data.formatItemDetail('1400')!
  assert(jidan.includes('大幅提升突破成功率 30%'), `筑基丹应显示 +30% 突破成功率，实际：${jidan}`)
  assert(!jidan.includes('3000%'), `筑基丹不应显示 3000%，实际：${jidan}`)

  // level_up_rate 丹（buff=1 → +1%）
  const bingxin = data.formatItemDetail('1500')!
  assert(bingxin.includes('提升突破成功率 1%'), `冰心丹应显示 +1% 突破成功率，实际：${bingxin}`)

  // 渡厄丹（level_up）：特殊处理
  const duedan = data.formatItemDetail('1999')!
  assert(duedan.includes('渡厄') && duedan.includes('不丢失修为'), `渡厄丹应显示特殊效果，实际：${duedan}`)

  // 辅修功法：buff_type 数字码映射
  const yinxue = data.formatItemDetail('10001')!
  assert(yinxue.includes('气血吸取'), `饮血术(buff_type=6)应显示气血吸取，实际：${yinxue}`)
  assert(!yinxue.includes('效果：6'), `辅修功法不应输出裸数字码，实际：${yinxue}`)
  const wufu = data.formatItemDetail('10003')!
  assert(wufu.includes('暴击率'), `五府锻元诀(buff_type=2)应显示暴击率，实际：${wufu}`)
  const yangdao = data.formatItemDetail('10102')!
  assert(yangdao.includes('暴击伤害'), `养刀术(buff_type=3)应显示暴击伤害，实际：${yangdao}`)
  const xuedu = data.formatItemDetail('10408')!
  assert(xuedu.includes('中毒'), `血毒经(buff_type=8)应显示中毒，实际：${xuedu}`)

  // 法器破甲
  const fajian = data.formatItemDetail('7001')!
  assert(fajian.includes('破甲 8%'), `精铁符剑应显示破甲 8%，实际：${fajian}`)
  assert(!fajian.includes('0%'), `法器不应显示 0% 的无意义加成，实际：${fajian}`)

  // 聚灵旗药材速度
  const julingqi = data.formatItemDetail('2500')!
  assert(julingqi.includes('灵田药材生长速度 +1'), `一级聚灵旗应显示药材速度，实际：${julingqi}`)

  // 炼丹炉 buff
  const danlu = data.formatItemDetail('4001')!
  assert(danlu.includes('丹成额外多 2 枚'), `寒铁铸心炉应显示丹成额外多 2 枚，实际：${danlu}`)
  const yuntielu = data.formatItemDetail('4003')!
  assert(yuntielu.includes('持有方可炼制丹药'), `陨铁炉(buff=0)应显示基础说明，实际：${yuntielu}`)
}

// 11. 建号引导：加入宗门支持「序号」或「宗门全名」
{
  // 序号命中（1 基）
  const byNum1 = resolvePresetSectInput('1')
  assert(byNum1?.name === PRESET_SECTS[0].name, `序号 1 应映射到首个预设宗门，实际：${byNum1?.name}`)
  const last = PRESET_SECTS.length
  const byNumLast = resolvePresetSectInput(String(last))
  assert(byNumLast?.name === PRESET_SECTS[last - 1].name, `序号 ${last} 应映射到末个预设宗门，实际：${byNumLast?.name}`)
  // 序号带前后空格
  const byNumSpaced = resolvePresetSectInput('  2  ')
  assert(byNumSpaced?.name === PRESET_SECTS[1].name, `带空格的序号 2 应映射正确，实际：${byNumSpaced?.name}`)
  // 序号越界 → 找不到（不会误当成全名）
  assert(resolvePresetSectInput('99') === undefined, '序号越界应返回 undefined')
  assert(resolvePresetSectInput('0') === undefined, '序号 0 应返回 undefined')
  // 非数字字符串按全名匹配
  const byName = resolvePresetSectInput(PRESET_SECTS[1].name)
  assert(byName?.name === PRESET_SECTS[1].name, `宗门全名应精确匹配，实际：${byName?.name}`)
  // 空白 → 找不到
  assert(resolvePresetSectInput('   ') === undefined, '空白输入应返回 undefined')
  assert(resolvePresetSectInput('') === undefined, '空输入应返回 undefined')
}

console.log(`\n测试结果：${passed} 通过，${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)
