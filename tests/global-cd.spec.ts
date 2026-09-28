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
    globalCommandCd: 60,
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

async function seedPlayer(userId: string): Promise<void> {
  await app.database.createUser('mock', userId, { name: `道友${userId}`, authority: 1 })
  const [user] = await app.database.get('user', { name: `道友${userId}` })
  const uid = (user?.id as number) ?? ++uidSeq
  await app.database.create('xiuxian_player', {
    userId, platform: 'mock', uid, root: '土灵根', rootType: '天灵根',
    level: '江湖好手', power: 130, exp: 100, hp: 50, mp: 100, atk: 10,
    createTime: new Date(), userName: `道友${userId}`, sectId: 0, sectPosition: 0, sectContribution: 0,
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

describe('全局指令 CD（globalCommandCd）', () => {
  it('同一群内第二个玩家触发同一指令时进入冷却', async () => {
    await seedPlayer('6301')
    await seedPlayer('6302')

    // 玩家 6301 在群 888 触发「修仙签到」
    const c1 = app.mock.client('6301', '888')
    const r1 = await c1.receive('修仙签到')
    expect(r1.length).to.be.greaterThan(0)

    // 玩家 6302 在同一群 888 触发同一指令，应进入冷却
    const c2 = app.mock.client('6302', '888')
    const r2 = await c2.receive('修仙签到')
    expectInclude(r2, '冷却')
  })

  it('不同群不共享冷却', async () => {
    await seedPlayer('6303')

    const c1 = app.mock.client('6303', '999')
    const r1 = await c1.receive('修仙签到')
    expect(r1.length).to.be.greaterThan(0)

    // 不同群（或私聊）不应受上一个群的冷却影响
    const c2 = app.mock.client('6303', '1000')
    const r2 = await c2.receive('修仙签到')
    // 私聊场景无 guildId，key 不同，不应提示冷却
    expect(r2.join('\n').includes('冷却')).to.be.false
  })
})
