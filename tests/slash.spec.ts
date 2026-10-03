import { Context } from 'koishi'
import { expect } from 'chai'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'
import monetary from 'koishi-plugin-monetary'
import * as mod from '../src'
import { stripLeadingSlash } from '../src/slash'

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
    globalCommandCd: 0,
    groupWhitelistEnabled: false,
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
  await app.database.createUser('mock', userId, { name: `道友${userId}`, authority: 2 })
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

function text(replies: string[]): string {
  return replies.map((x) => String(x)).join('\n')
}

describe('斜杠指令适配 · stripLeadingSlash 纯函数', () => {
  it('剥离单个开头的斜杠', () => {
    expect(stripLeadingSlash('/修仙帮助')).to.equal('修仙帮助')
    expect(stripLeadingSlash('/灵庄存灵石 1000')).to.equal('灵庄存灵石 1000')
  })

  it('无斜杠时原样返回', () => {
    expect(stripLeadingSlash('修仙帮助')).to.equal('修仙帮助')
    expect(stripLeadingSlash('')).to.equal('')
  })

  it('双斜杠不处理（避免误伤）', () => {
    expect(stripLeadingSlash('//foo')).to.equal('//foo')
  })

  it('仅开头的斜杠被剥离，正文中的保留', () => {
    expect(stripLeadingSlash('/改名 a/b')).to.equal('改名 a/b')
  })
})

describe('斜杠指令适配 · QQ 指令面板点击形式（端到端）', () => {
  it('/修仙帮助 可用（面板点击后填入的形式）', async () => {
    await seedPlayer('7101')
    const r = await app.mock.client('7101', '888').receive('/修仙帮助')
    expect(r.length).to.be.greaterThan(0)
    expect(text(r)).to.contain('修仙')
  })

  it('修仙帮助 仍然可用（手动 @ 机器人，无斜杠）', async () => {
    await seedPlayer('7102')
    const r = await app.mock.client('7102', '888').receive('修仙帮助')
    expect(r.length).to.be.greaterThan(0)
    expect(text(r)).to.contain('修仙')
  })

  it('/帮助 命中修仙帮助的已有别名', async () => {
    await seedPlayer('7103')
    const r = await app.mock.client('7103', '888').receive('/帮助')
    expect(r.length).to.be.greaterThan(0)
    expect(text(r)).to.contain('修仙')
  })

  it('/我的背包 可用', async () => {
    await seedPlayer('7104')
    const r = await app.mock.client('7104', '888').receive('/我的背包')
    expect(r.length).to.be.greaterThan(0)
    expect(text(r)).to.contain('背包')
  })

  it('斜杠 + 参数：/改名 斜杠道友', async () => {
    await seedPlayer('7105')
    const r = await app.mock.client('7105', '888').receive('/改名 斜杠道友')
    expect(r.length).to.be.greaterThan(0)
    const [player] = await app.database.get('xiuxian_player', { userId: '7105' })
    expect(player?.userName).to.equal('斜杠道友')
  })

  it('斜杠不影响原有无斜杠调用（回归）', async () => {
    await seedPlayer('7106')
    const r = await app.mock.client('7106', '888').receive('改名 无斜杠道友')
    expect(r.length).to.be.greaterThan(0)
    const [player] = await app.database.get('xiuxian_player', { userId: '7106' })
    expect(player?.userName).to.equal('无斜杠道友')
  })

  it('斜杠 + 多参数：/改名 斜杠道友 前后多余空格仍生效', async () => {
    await seedPlayer('7107')
    const r = await app.mock.client('7107', '888').receive('/改名 带空格道友')
    expect(r.length).to.be.greaterThan(0)
    const [player] = await app.database.get('xiuxian_player', { userId: '7107' })
    expect(player?.userName).to.equal('带空格道友')
  })
})

describe('斜杠指令适配 · 管理指令（adminCtx，豁免白名单）', () => {
  it('/群组信息 可用（管理指令斜杠形式）', async () => {
    await seedPlayer('7201')
    const r = await app.mock.client('7201', '888').receive('/群组信息')
    const joined = text(r)
    expect(joined.length).to.be.greaterThan(0)
    expect(joined).to.match(/权限不足|群ID|平台ID/)
  })

  it('/群信息 命中管理指令已有别名', async () => {
    await seedPlayer('7202')
    const r = await app.mock.client('7202', '888').receive('/群信息')
    const joined = text(r)
    expect(joined.length).to.be.greaterThan(0)
    expect(joined).to.match(/权限不足|群ID|平台ID/)
  })

  it('管理指令无斜杠形式仍可用（回归）', async () => {
    await seedPlayer('7203')
    const r = await app.mock.client('7203', '888').receive('群组信息')
    const joined = text(r)
    expect(joined.length).to.be.greaterThan(0)
    expect(joined).to.match(/权限不足|群ID|平台ID/)
  })
})
