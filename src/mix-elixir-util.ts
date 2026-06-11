import { ItemInfo } from './types'

const YONGHU_DENJI = 0
const MAX_HERBS_PER_ROLE = 5
const MAX_TOTAL_HERBS = 10

export interface YaocaiEntry {
  id: number
  info: ItemInfo
  num: number
}

export interface MixRecipe {
  elixirId: number
  elixirName: string
  desc: string
  mainId: number
  mainName: string
  mainNum: number
  mainLevel: string
  yaoyinId: number
  yaoyinName: string
  yaoyinNum: number
  yaoyinLevel: string
  fuyaoId: number
  fuyaoName: string
  fuyaoNum: number
  fuyaoLevel: string
  formulaShort: string
  elixirConfig: Record<string, number>
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function abs(x: number): number {
  return x >= 0 ? x : -x
}

/** 主药与药引冷热调和，失败返回 true */
export function tiaohe(mainInfo: ItemInfo, mainNum: number, yaoyinInfo: ItemInfo, yaoyinNum: number): boolean {
  const mainHac = mainInfo['主药'] as { h_a_c?: { type?: number; power?: number } } | undefined
  const yyHac = yaoyinInfo['药引'] as { h_a_c?: { type?: number; power?: number } } | undefined
  const zhuyao = num(mainHac?.h_a_c?.type) * num(mainHac?.h_a_c?.power) * mainNum
  const yaoyin = num(yyHac?.h_a_c?.type) * num(yyHac?.h_a_c?.power) * yaoyinNum
  return abs(zhuyao + yaoyin) > YONGHU_DENJI
}

/** 检测配方是否匹配合成丹药，返回丹药 ID 或 0 */
export function checkMix(
  elixirConfig: Record<string, number>,
  mixConfigs: Record<string, Record<string, number>>,
): number {
  const typeList = Object.keys(elixirConfig).sort()
  const matched: number[] = []
  for (const [id, formula] of Object.entries(mixConfigs)) {
    const formulaKeys = Object.keys(formula).sort()
    if (typeList.join(',') !== formulaKeys.join(',')) continue
    let ok = true
    for (const k of typeList) {
      if (elixirConfig[k] < formula[k]) { ok = false; break }
    }
    if (ok) matched.push(Number(id))
  }
  if (!matched.length) return 0
  let bestId = matched[0]
  let bestScore = 0
  for (const id of matched) {
    const formula = mixConfigs[String(id)]
    const score = Object.values(formula).reduce((a, b) => a + b, 0)
    if (score > bestScore) { bestScore = score; bestId = id }
  }
  return bestId
}

function buildMixConfigs(items: Record<string, ItemInfo>): Record<string, Record<string, number>> {
  const configs: Record<string, Record<string, number>> = {}
  for (const [id, info] of Object.entries(items)) {
    const cfg = info.elixir_config as Record<string, number> | undefined
    if (cfg) configs[id] = cfg
  }
  return configs
}

/** 从背包药材生成可炼制配方列表 */
export function findMixRecipes(
  yaocaiList: YaocaiEntry[],
  mixElixirItems: Record<string, ItemInfo>,
): MixRecipe[] {
  const mixConfigs = buildMixConfigs(mixElixirItems)
  const recipes: MixRecipe[] = []
  const seen = new Set<string>()

  for (const main of yaocaiList) {
    for (let i = 1; i <= Math.min(main.num, MAX_HERBS_PER_ROLE); i++) {
      for (const yy of yaocaiList) {
        if (yy.id === main.id) continue
        for (let o = 1; o <= Math.min(yy.num, MAX_HERBS_PER_ROLE); o++) {
          if (tiaohe(main.info, i, yy.info, o)) continue
          for (const fy of yaocaiList) {
            for (let p = 1; p <= Math.min(fy.num, MAX_HERBS_PER_ROLE); p++) {
              if (i + o + p > MAX_TOTAL_HERBS) continue
              const mainType = main.info['主药'] as { type?: number; power?: number }
              const fyType = fy.info['辅药'] as { type?: number; power?: number }
              const elixirConfig: Record<string, number> = {
                [String(mainType?.type ?? 2)]: num(mainType?.power) * i,
                [String(fyType?.type ?? 3)]: num(fyType?.power) * p,
              }
              const elixirId = checkMix(elixirConfig, mixConfigs)
              if (!elixirId) continue
              const key = `${elixirId}:${main.id}:${i}:${yy.id}:${o}:${fy.id}:${p}`
              if (seen.has(key)) continue
              seen.add(key)
              const elixirInfo = mixElixirItems[String(elixirId)]
              if (!elixirInfo) continue
              recipes.push({
                elixirId,
                elixirName: elixirInfo.name,
                desc: (elixirInfo.desc as string) ?? '',
                mainId: main.id,
                mainName: main.info.name,
                mainNum: i,
                mainLevel: (main.info.level as string) ?? '',
                yaoyinId: yy.id,
                yaoyinName: yy.info.name,
                yaoyinNum: o,
                yaoyinLevel: (yy.info.level as string) ?? '',
                fuyaoId: fy.id,
                fuyaoName: fy.info.name,
                fuyaoNum: p,
                fuyaoLevel: (fy.info.level as string) ?? '',
                formulaShort: `主药${main.info.name}${i}药引${yy.info.name}${o}辅药${fy.info.name}${p}`,
                elixirConfig,
              })
            }
          }
        }
      }
    }
  }
  return recipes
}
