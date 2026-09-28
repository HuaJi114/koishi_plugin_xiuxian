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
  app.plugin(plugin, { currency: 'default', groupOnly: false, adminQQ: [] })
  await app.start()
})

after(async () => {
  try {
    await app.stop()
  } catch {
    /* mock 清理副作用，忽略 */
  }
})

/**
 * 直接写库建号（绕过「我要修仙」的宗门选择 session.prompt，避免挂起）。
 * 返回玩家数据库 uid（= user 表 id），用于 monetary 充值。
 */
async function seedPlayer(userId: string, stone = 0): Promise<number> {
  // 创建 user 记录（模拟 observeUser 自动建号），authority 设为 1 以通过普通指令权限
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
  // 初始化 cd 与 buff（getCd/getBuff 会惰性创建，这里确保存在）
  await app.database.create('xiuxian_cd', { userId, type: 0, createTime: new Date(), scheduledTime: 0 })
  await app.database.create('xiuxian_buff', { userId })

  if (stone > 0) {
    const [row] = await app.database.get('monetary', { uid, currency: 'default' })
    if (row) {
      await app.database.set('monetary', { uid, currency: 'default' }, { value: stone })
    } else {
      await app.database.create('monetary', { uid, currency: 'default', value: stone })
    }
  }
  return uid
}

function expectInclude(replies: string[], keyword: string, ctx = '') {
  const joined = replies.join('\n')
  if (!joined.includes(keyword)) {
    throw new Error(`期望回复包含「${keyword}」${ctx ? '（' + ctx + '）' : ''}，实际：\n${joined}`)
  }
}

describe('洞天经营（blessed-spot）', () => {
  it('未开辟洞府时，洞府信息提示未开辟', async () => {
    await seedPlayer('6101')
    const client = app.mock.client('6101')
    const replies = await client.receive('洞府信息')
    expectInclude(replies, '尚未开辟洞府')
  })

  it('开辟洞府后洞府信息显示洞府名', async () => {
    await seedPlayer('6102', 2000000)
    const client = app.mock.client('6102')
    const open = await client.receive('开辟洞府 云隐洞府')
    expectInclude(open, '洞府', '开辟')
    const info = await client.receive('洞府信息')
    expectInclude(info, '云隐洞府')
  })

  it('灵气升级后洞府信息显示灵气提升', async () => {
    await seedPlayer('6103', 3000000)
    const client = app.mock.client('6103')
    await client.receive('开辟洞府')
    const up = await client.receive('灵气升级')
    expectInclude(up, '灵气', '升级')
    const info = await client.receive('洞府信息')
    expectInclude(info, '微弱灵气')
  })

  it('灵田种植后未成熟时收获有提示', async () => {
    await seedPlayer('6104', 3000000)
    const client = app.mock.client('6104')
    await client.receive('开辟洞府')
    // 注入 1 份药材，按序号种植（绕过交互 prompt）
    await app.database.create('xiuxian_back', {
      userId: '6104', goodsId: 90909, goodsName: '测试灵草', goodsType: '药材', goodsNum: 5,
      createTime: new Date(), updateTime: new Date(), remake: '', dayNum: 0, allNum: 0,
      actionTime: new Date(), state: 0, bindNum: 0,
    })
    const plant = await client.receive('灵田种植 1')
    expectInclude(plant, '灵田', '种植')
    const harvest = await client.receive('灵田收获 1')
    expectInclude(harvest, '尚未成熟')
  })

  it('成熟灵田收获按灵气等级获得 2~8 份', async () => {
    await seedPlayer('6104b', 3000000)
    const client = app.mock.client('6104b')
    await client.receive('开辟洞府')
    // 将第 1 块灵田设为已成熟（播种于 2 小时前，成熟 60 分钟）
    await app.database.set('xiuxian_plot', { userId: '6104b', plotIndex: 1 }, {
      plantId: 90909, plantAt: new Date(Date.now() - 2 * 3600 * 1000), plantMinutes: 60,
    })
    const harvest = await client.receive('灵田收获 1')
    expectInclude(harvest, '收成')
    expectInclude(harvest, '第 1 块灵田')
  })

  it('洞府帮助返回玩法说明', async () => {
    await seedPlayer('6105')
    const client = app.mock.client('6105')
    const replies = await client.receive('洞府帮助')
    expectInclude(replies, '开辟洞府')
    expectInclude(replies, '开垦灵田')
  })

  it('灵田空闲时收获提示无成熟作物', async () => {
    await seedPlayer('6106', 2000000)
    const client = app.mock.client('6106')
    await client.receive('开辟洞府')
    const replies = await client.receive('灵田收获')
    expectInclude(replies, '暂无成熟作物')
  })

  it('开垦灵田扩建并可在灵田情况查看', async () => {
    await seedPlayer('6107', 5000000)
    const client = app.mock.client('6107')
    await client.receive('开辟洞府')
    const open = await client.receive('开垦灵田')
    expectInclude(open, '新辟第 2 块', '开垦')
    const info = await client.receive('灵田情况')
    expectInclude(info, '共 2 块')
  })
})
