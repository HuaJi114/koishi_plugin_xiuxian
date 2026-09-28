import { Context } from 'koishi'
import { expect } from 'chai'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'
import monetary from 'koishi-plugin-monetary'
import * as mod from '../src'

const plugin = (mod as any).default ?? mod

let app: Context
let uidSeq = 0

before(async () => {
  app = new Context()
  app.plugin(mock)
  app.plugin(memory)
  app.plugin(monetary)
  app.plugin(plugin, {
    currency: 'default',
    groupOnly: false,
    adminQQ: [],
    stealCd: 600,
    robCd: 600,
    globalCommandCd: 0,
  })
  await app.start()
})

after(async () => {
  try {
    await app.stop()
  } catch {
    /* mock 清理副作用，忽略 */
  }
})

async function seedPlayer(userId: string, stone = 0): Promise<number> {
  await app.database.createUser('mock', userId, { name: `道友${userId}`, authority: 1 })
  const [user] = await app.database.get('user', { name: `道友${userId}` })
  const uid = (user?.id as number) ?? ++uidSeq
  await app.database.create('xiuxian_player', {
    userId,
    platform: 'mock',
    uid,
    root: '土灵根',
    rootType: '天灵根',
    level: '江湖好手',
    power: 130,
    exp: 100,
    hp: 50,
    mp: 100,
    atk: 10,
    createTime: new Date(),
    userName: `道友${userId}`,
    sectId: 0,
    sectPosition: 0,
    sectContribution: 0,
  })
  await app.database.create('xiuxian_cd', { userId, type: 0, createTime: new Date(), scheduledTime: 0 })
  await app.database.create('xiuxian_buff', { userId })
  if (stone > 0) {
    const [row] = await app.database.get('monetary', { uid, currency: 'default' })
    if (row) await app.database.set('monetary', { uid, currency: 'default' }, { value: stone })
    else await app.database.create('monetary', { uid, currency: 'default', value: stone })
  }
  return uid
}

function expectInclude(replies: string[], keyword: string, ctx = '') {
  const joined = replies.join('\n')
  if (!joined.includes(keyword)) {
    throw new Error(`期望回复包含「${keyword}」${ctx ? '（' + ctx + '）' : ''}，实际：\n${joined}`)
  }
}

describe('菜单导航（树形结构）', () => {
  it('修仙帮助返回板块导航而非平铺明细', async () => {
    await seedPlayer('6201')
    const client = app.mock.client('6201')
    const replies = await client.receive('修仙帮助')
    expectInclude(replies, '指令总览')
    expectInclude(replies, '常用命令')
    expectInclude(replies, '板块帮助')
    expectInclude(replies, '宗门帮助')
    expectInclude(replies, '炼丹帮助')
  })

  it('xiuxian 父命令返回导航', async () => {
    await seedPlayer('6202')
    const client = app.mock.client('6202')
    const replies = await client.receive('xiuxian')
    expectInclude(replies, '常用命令')
    expectInclude(replies, '板块帮助')
  })
})

describe('偷灵石 / 抢劫独立 CD', () => {
  it('偷灵石处于冷却时，返回冷却提示', async () => {
    await seedPlayer('6203', 10000000)
    // 直接把 stealCd 设为当前时间，模拟刚偷过
    await app.database.set('xiuxian_player', { userId: '6203' }, { stealCd: new Date() })
    const client = app.mock.client('6203')
    const replies = await client.receive('偷灵石')
    expectInclude(replies, '冷却')
  })

  it('偷灵石未处于冷却时，正常进入 @ 校验', async () => {
    await seedPlayer('6204', 10000000)
    const client = app.mock.client('6204')
    const replies = await client.receive('偷灵石')
    expectInclude(replies, '请 @ 要下手的道友')
  })

  it('抢劫处于冷却时，返回冷却提示', async () => {
    await seedPlayer('6205', 10000000)
    await app.database.set('xiuxian_player', { userId: '6205' }, { robCd: new Date() })
    const client = app.mock.client('6205')
    const replies = await client.receive('抢劫')
    expectInclude(replies, '冷却')
  })

  it('抢劫未处于冷却时，正常进入 @ 校验', async () => {
    await seedPlayer('6206', 10000000)
    const client = app.mock.client('6206')
    const replies = await client.receive('抢劫')
    expectInclude(replies, '请 @ 要抢劫的道友')
  })
})
