import { Context } from 'koishi'
import { expect } from 'chai'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'
import monetary from 'koishi-plugin-monetary'
import * as mod from '../src'

const plugin = (mod as any).default ?? mod

function makeApp(cfg: Record<string, any>): Context {
  const app = new Context()
  app.plugin(mock)
  app.plugin(memory)
  app.plugin(monetary)
  app.plugin(plugin, { currency: 'default', groupOnly: false, adminQQ: [], ...cfg })
  return app
}

async function start(app: Context) {
  await app.start()
}
async function stop(app: Context) {
  try {
    await app.stop()
  } catch {
    /* mock 清理副作用，忽略 */
  }
}

describe('群聊白名单与黑名单', () => {
  describe('白名单开启（私聊关闭、无黑名单）', () => {
    let app: Context
    before(async () => {
      app = makeApp({ groupWhitelistEnabled: true, groupWhitelist: ['888'], allowPrivateChat: false, userBlacklist: [] })
      await start(app)
    })
    after(async () => { await stop(app) })

    it('白名单内群正常响应', async () => {
      const r = await app.mock.client('6301', '888').receive('修仙帮助')
      expect(r.length).to.be.greaterThan(0)
    })

    it('非白名单群静默拦截', async () => {
      const r = await app.mock.client('6302', '777').receive('修仙帮助')
      expect(r.length).to.equal(0)
    })

    it('私聊静默拦截（allowPrivateChat=false）', async () => {
      const r = await app.mock.client('6303').receive('修仙帮助')
      expect(r.length).to.equal(0)
    })
  })

  describe('群号后缀匹配（跨平台）', () => {
    let app: Context
    before(async () => {
      app = makeApp({ groupWhitelistEnabled: true, groupWhitelist: ['888'], allowPrivateChat: false })
      await start(app)
    })
    after(async () => { await stop(app) })

    it('guildId 带平台前缀 qq:888 也能命中白名单', async () => {
      const r = await app.mock.client('6304', 'qq:888').receive('修仙帮助')
      expect(r.length).to.be.greaterThan(0)
    })
  })

  describe('空白名单（全部禁止）', () => {
    let app: Context
    before(async () => {
      app = makeApp({ groupWhitelistEnabled: true, groupWhitelist: [], allowPrivateChat: false })
      await start(app)
    })
    after(async () => { await stop(app) })

    it('列表为空时所有群均静默', async () => {
      const r = await app.mock.client('6311', '888').receive('修仙帮助')
      expect(r.length).to.equal(0)
    })
  })

  describe('允许私聊', () => {
    let app: Context
    before(async () => {
      app = makeApp({ groupWhitelistEnabled: true, groupWhitelist: ['888'], allowPrivateChat: true })
      await start(app)
    })
    after(async () => { await stop(app) })

    it('允许私聊时私聊正常响应', async () => {
      const r = await app.mock.client('6312').receive('修仙帮助')
      expect(r.length).to.be.greaterThan(0)
    })

    it('允许私聊时非白名单群仍静默', async () => {
      const r = await app.mock.client('6313', '777').receive('修仙帮助')
      expect(r.length).to.equal(0)
    })
  })

  describe('QQ 黑名单', () => {
    let app: Context
    before(async () => {
      app = makeApp({ groupWhitelistEnabled: true, groupWhitelist: ['888'], allowPrivateChat: false, userBlacklist: ['6309'] })
      await start(app)
    })
    after(async () => { await stop(app) })

    it('黑名单用户在白名单群内仍被静默拦截', async () => {
      const r = await app.mock.client('6309', '888').receive('修仙帮助')
      expect(r.length).to.equal(0)
    })

    it('黑名单用户在非白名单群也被静默拦截', async () => {
      const r = await app.mock.client('6309', '777').receive('修仙帮助')
      expect(r.length).to.equal(0)
    })

    it('黑名单用户私聊也被静默拦截', async () => {
      const r = await app.mock.client('6309').receive('修仙帮助')
      expect(r.length).to.equal(0)
    })
  })

  describe('管理指令豁免白名单', () => {
    let app: Context
    before(async () => {
      app = makeApp({ groupWhitelistEnabled: true, groupWhitelist: ['888'], allowPrivateChat: false })
      await start(app)
      await app.database.createUser('mock', '6320', { name: '管理', authority: 999 })
    })
    after(async () => { await stop(app) })

    it('管理指令在非白名单群仍响应', async () => {
      const r = await app.mock.client('6320', '777').receive('重置状态')
      expect(r.length).to.be.greaterThan(0)
    })
  })

  describe('adapter-qq 适配（群ID为 group_openid 不透明字符串）', () => {
    let app: Context
    before(async () => {
      // 白名单填 openid（官方 QQ 群机器人的真实群标识），而非纯数字群号
      app = makeApp({ groupWhitelistEnabled: true, groupWhitelist: ['CQopenidABC'], allowPrivateChat: false })
      await start(app)
    })
    after(async () => { await stop(app) })

    it('白名单填 openid 时，该群正常响应（字符串群号匹配）', async () => {
      const r = await app.mock.client('6401', 'CQopenidABC').receive('修仙帮助')
      expect(r.length).to.be.greaterThan(0)
    })

    it('guildId 带 qq: 前缀的 openid 也能命中', async () => {
      const r = await app.mock.client('6402', 'qq:CQopenidABC').receive('修仙帮助')
      expect(r.length).to.be.greaterThan(0)
    })

    it('openid 不在白名单的群仍静默拦截', async () => {
      const r = await app.mock.client('6403', 'CQotherXYZ').receive('修仙帮助')
      expect(r.length).to.equal(0)
    })

    it('旧数字群号无法命中 openid 白名单（验证迁移后必须改用 openid）', async () => {
      const r = await app.mock.client('6404', '888').receive('修仙帮助')
      expect(r.length).to.equal(0)
    })
  })

  describe('群组信息指令（管理，白名单豁免）', () => {
    let app: Context
    before(async () => {
      app = makeApp({ groupWhitelistEnabled: true, groupWhitelist: ['888'], allowPrivateChat: false })
      await start(app)
      await app.database.createUser('mock', '6410', { name: '管理', authority: 999 })
    })
    after(async () => { await stop(app) })

    it('管理指令在非白名单群可显示当前群 openid（用于回填白名单）', async () => {
      const r = await app.mock.client('6410', 'CQopenidABC').receive('群组信息')
      const text = r.join('\n')
      expect(text).to.contain('CQopenidABC')
      expect(text).to.contain('群聊白名单')
    })
  })
})
