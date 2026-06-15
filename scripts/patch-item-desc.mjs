/**
 * 为 data/xiuxian 下物品 JSON 批量写入 ≤20 字的修仙风描述
 * 运行：node scripts/patch-item-desc.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'xiuxian')

const SOURCES = [
  ['装备', '防具.json'],
  ['装备', '法器.json'],
  ['功法', '主功法.json'],
  ['功法', '辅修功法.json'],
  ['功法', '神通.json'],
  ['丹药', '丹药.json'],
  ['丹药', '药材.json'],
  ['丹药', '炼丹丹药.json'],
  ['丹药', '炼丹炉.json'],
  ['修炼物品', '聚灵旗.json'],
]

const GENERIC = ['吔屎啦！', '不说了，开鳖!', '你被强化了，快去送!']

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function clip20(s) {
  return [...s].slice(0, 20).join('')
}

function genDesc(name, itemType) {
  const n = name.replace(/\s/g, '')
  const templates = {
    功法: [
      `${n}，调息炼气之法`,
      `修习${n}可强根骨`,
      `${n}乃入门心法`,
      `参悟${n}益修为`,
    ],
    辅修功法: [
      `${n}辅修秘典`,
      `${n}可补主功不足`,
      `兼修${n}增益倍`,
    ],
    神通: [
      n.includes('鳖') ? `${n}，护体减伤之诀` : `${n}，斗法神通`,
      `${n}耗真元施为`,
      `催动${n}克敌制胜`,
    ],
    法器: [
      `${n}，攻伐之器`,
      `持${n}可增锋芒`,
      `${n}经灵炼而成`,
    ],
    防具: [
      `${n}，护身法衣`,
      `着${n}可御刀剑`,
      `${n}能护体凝罡`,
    ],
    丹药: [
      `${n}，疗伤益气`,
      `服${n}可回气血`,
      `${n}乃常用灵丹`,
    ],
    药材: [
      `${n}，炼丹主材`,
      `${n}性灵蕴药力`,
      `采${n}可入丹炉`,
    ],
    合成丹药: [
      `${n}，丹道成品`,
      `炼制${n}需多味`,
    ],
    炼丹炉: [
      `${n}，炼丹器具`,
      `持${n}方可炼丹`,
    ],
    聚灵旗: [
      `${n}聚天地灵气`,
      `${n}布阵助修炼`,
    ],
  }
  const pool = templates[itemType] ?? [`${n}，修仙界奇物`]
  return clip20(pool[hash(name + itemType) % pool.length])
}

let updated = 0
for (const parts of SOURCES) {
  const file = join(ROOT, ...parts)
  const itemType = parts[parts.length - 1].replace('.json', '')
  const mapType = parts[0] === '功法'
    ? (parts[1].includes('辅修') ? '辅修功法' : parts[1].includes('神通') ? '神通' : '功法')
    : parts[0] === '装备'
      ? parts[1].includes('法器') ? '法器' : '防具'
      : parts[1].replace('.json', '') === '炼丹丹药' ? '合成丹药' : parts[1].replace('.json', '')

  const data = JSON.parse(readFileSync(file, 'utf-8'))
  for (const info of Object.values(data)) {
    const name = info.name
    if (!name) continue
    const old = info.desc
    if (!old || GENERIC.includes(old) || old.length <= 3) {
      info.desc = genDesc(name, mapType)
      updated++
    }
  }
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  console.log('patched', parts.join('/'))
}
console.log('updated desc count:', updated)
