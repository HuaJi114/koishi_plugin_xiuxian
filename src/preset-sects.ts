/** 系统预设宗门（建号时可选择加入） */
export interface PresetSect {
  name: string
  desc: string
  /** 系统宗门占位宗主 ID */
  sectOwner: string
  /** 建设度 */
  sectScale: number
  /** 宗门可用灵石 */
  sectUsedStone: number
  /** 灵田等级 */
  sectFairyland: number
  /** 宗门资材 */
  sectMaterials: number
  /** 主修功法 ID（0 表示未配置） */
  mainBuff: number
  /** 神通 ID */
  secBuff: number
  /** 丹房等级 */
  elixirRoomLevel: number
}

/** 四大预设宗门，参数按宗门特色写死 */
export const PRESET_SECTS: PresetSect[] = [
  {
    name: '青冥剑宗',
    desc: '执掌山岳剑道，弟子以青锋悟道，行侠于群山险峰。',
    sectOwner: 'system',
    sectScale: 5_200_000,
    sectUsedStone: 680_000,
    sectFairyland: 2,
    sectMaterials: 95_000,
    mainBuff: 0,
    secBuff: 0,
    elixirRoomLevel: 2,
  },
  {
    name: '玄水灵府',
    desc: '栖身渊泽秘境，专修水系灵法，掌河湖水系灵力。',
    sectOwner: 'system',
    sectScale: 4_800_000,
    sectUsedStone: 920_000,
    sectFairyland: 4,
    sectMaterials: 160_000,
    mainBuff: 0,
    secBuff: 0,
    elixirRoomLevel: 3,
  },
  {
    name: '赤焰焚天阁',
    desc: '扎根火山腹地，擅烈焰神通，性情刚烈杀伐果断。',
    sectOwner: 'system',
    sectScale: 6_500_000,
    sectUsedStone: 540_000,
    sectFairyland: 1,
    sectMaterials: 78_000,
    mainBuff: 0,
    secBuff: 0,
    elixirRoomLevel: 2,
  },
  {
    name: '厚土万岳门',
    desc: '安居荒原巨岩，修炼固本土功，镇守大地疆隅。',
    sectOwner: 'system',
    sectScale: 8_800_000,
    sectUsedStone: 1_100_000,
    sectFairyland: 2,
    sectMaterials: 220_000,
    mainBuff: 0,
    secBuff: 0,
    elixirRoomLevel: 1,
  },
]

const REGISTER_PROMPT = [
  '',
  '—— 仙途归属 ——',
  '回复【加入宗门】查看四大宗门并择一而入；',
  '回复【成为散修】则暂不加入宗门，日后可自行创建或加入。',
].join('\n')

export function formatSectRegisterPrompt(): string {
  return REGISTER_PROMPT
}

export function formatPresetSectList(): string {
  const lines = ['可选宗门如下，请回复宗门全名加入：']
  PRESET_SECTS.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.name}`)
    lines.push(`   ${s.desc}`)
  })
  return lines.join('\n')
}

/** 根据名称查找预设宗门（支持全名匹配） */
export function findPresetSect(name: string): PresetSect | undefined {
  const trimmed = name.trim()
  return PRESET_SECTS.find((s) => s.name === trimmed)
}
