import { Context } from 'koishi'
import { expect } from 'chai'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'
import monetary from 'koishi-plugin-monetary'
import * as mod from '../src'

const plugin = (mod as any).default ?? mod

let app: Context

before(async () => {
  app = new Context()
  app.plugin(mock)
  app.plugin(memory)
  app.plugin(monetary)
  app.plugin(plugin, { currency: 'default', groupOnly: false, adminQQ: [] })
  await app.start()
})

after(async () => {
  try { await app.stop() } catch { /* mock 清理副作用 */ }
})

async function seedPlayer(userId: string, overrides: Record<string, unknown> = {}): Promise<void> {
  await app.database.createUser('mock', userId, { name: `道友${userId}`, authority: 1 })
  const [user] = await app.database.get('user', { name: `道友${userId}` })
  await app.database.create('xiuxian_player', {
    userId,
    platform: 'mock',
    uid: user?.id ?? 0,
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
    ...overrides,
  })
  await app.database.create('xiuxian_cd', { userId, type: 0, createTime: new Date(), scheduledTime: 0 })
  await app.database.create('xiuxian_buff', { userId })
}

function expectInclude(replies: string[], keyword: string, ctx = '') {
  const joined = replies.join('\n')
  if (!joined.includes(keyword)) {
    throw new Error(`期望回复包含「${keyword}」${ctx ? '（' + ctx + '）' : ''}，实际：\n${joined}`)
  }
}

describe('长线玩法（endgame）', () => {
  it('我的突破概率返回百分比', async () => {
    await seedPlayer('7101')
    const client = app.mock.client('7101')
    const replies = await client.receive('我的突破概率')
    expectInclude(replies, '%')
  })

  it('未转世时我的转世提示未转世', async () => {
    await seedPlayer('7102')
    const client = app.mock.client('7102')
    const replies = await client.receive('我的转世')
    expectInclude(replies, '尚未转世')
  })

  it('未满级时飞升转世被拒绝', async () => {
    await seedPlayer('7103', { level: '练气境初期' })
    const client = app.mock.client('7103')
    const replies = await client.receive('飞升转世')
    expectInclude(replies, '无法飞升转世')
  })

  it('满级玩家飞升转世后境界重置、转世次数+1、文案含气运', async () => {
    await seedPlayer('7104', { level: '太乙境圆满', exp: 1000000 })
    const client = app.mock.client('7104')
    const replies = await client.receive('飞升转世')
    expectInclude(replies, '羽化飞升')
    expectInclude(replies, '气运加身')
    // 转世后查看
    const info = await client.receive('我的转世')
    expectInclude(info, '转世 1 次')
    expectInclude(info, '气运加身')
  })

  it('散修参悟天机有响应（无宗门也能参悟）', async () => {
    await seedPlayer('7105')
    const client = app.mock.client('7105')
    const replies = await client.receive('参悟天机')
    // 无论是否触发顿悟，都会有响应文本
    expect(replies.length).to.be.greaterThan(0)
  })

  it('未加入宗门时宗门贡献兑换提示先入宗门', async () => {
    await seedPlayer('7106')
    const client = app.mock.client('7106')
    const replies = await client.receive('宗门贡献兑换 灵石')
    expectInclude(replies, '宗门')
  })
})
