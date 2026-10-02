import { expect } from 'chai'
import { Config } from '../src/config'
import {
  DEFAULT_PANEL_ENTRIES,
  resolvePanelEntries,
  buildPanelItems,
  pushCommandPanel,
  pushAllPanels,
} from '../src/modules/panel'

const logger = { info() {}, warn() {} }

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    currency: 'default',
    groupOnly: false,
    adminQQ: [],
    groupWhitelistEnabled: false,
    groupWhitelist: [],
    allowPrivateChat: false,
    userBlacklist: [],
    userInfoCd: 60,
    levelUpCd: 60,
    closingExp: 30,
    closingExpUpperLimit: 1.5,
    levelPunishmentFloor: 1,
    levelPunishmentLimit: 10,
    levelUpProbability: 2,
    signInLingShiLowerLimit: 200000,
    signInLingShiUpperLimit: 500000,
    stealCost: 1000000,
    stealCd: 600,
    stealLowerLimit: 0.01,
    stealUpperLimit: 0.2,
    robCd: 600,
    remakeCost: 100000,
    sectMinLevel: '铭纹境圆满',
    sectCreateCost: 5000000,
    giveStoneTax: 0.1,
    globalCommandCd: 0,
    longTextToImage: false,
    longTextLineThreshold: 20,
    shopServiceCharge: 0.05,
    shopRestockThreshold: 5,
    shopCapacity: 30,
    shopExpireHours: 72,
    enablePanel: true,
    panelEntries: '',
    ...overrides,
  } as Config
}

interface MockOpts {
  existingPanels?: any[]
  createId?: string
  throwOn?: { method?: string; url?: string }
}

function makeMockBot(opts: MockOpts = {}) {
  const calls: any[] = []
  const bot: any = {
    platform: 'qq',
    selfId: 'qqbot1',
    config: { id: 'botappid' },
    getAccessToken: async () => 'tok',
    http: async (url: string, config: any = {}) => {
      calls.push({ url, method: config.method, params: config.params, data: config.data })
      if (opts.throwOn && opts.throwOn.method === config.method && (opts.throwOn.url === undefined || opts.throwOn.url === url)) {
        const err: any = new Error('mock http error')
        err.response = { data: { code: 40030020, msg: 'mock' } }
        throw err
      }
      if (config.method === 'GET' && url === '/v2/panels') {
        return { data: { records: opts.existingPanels ?? [], next_cursor: '', is_end: true } }
      }
      if (config.method === 'POST' && url === '/v2/panels') {
        return { data: { panel_id: opts.createId ?? 'p_new' } }
      }
      return { data: { version: 2 } }
    },
  }
  return { bot, calls }
}

describe('QQ 指令面板', () => {
  describe('resolvePanelEntries', () => {
    it('留空时使用内置默认 12 条', () => {
      expect(resolvePanelEntries('')).to.deep.equal(DEFAULT_PANEL_ENTRIES)
      expect(resolvePanelEntries(undefined)).to.deep.equal(DEFAULT_PANEL_ENTRIES)
    })
    it('按行解析并过滤空行', () => {
      expect(resolvePanelEntries('修仙帮助\n\n我要修仙  \n 闭关')).to.deep.equal(['修仙帮助', '我要修仙', '闭关'])
    })
    it('超过 20 条时截断', () => {
      const many = Array.from({ length: 25 }, (_, i) => `指令${i}`)
      expect(resolvePanelEntries(many.join('\n')).length).to.equal(20)
    })
  })

  describe('buildPanelItems', () => {
    it('映射为 command 类型且 name 即文本', () => {
      const items = buildPanelItems(['修仙签到', '闭关'])
      expect(items).to.deep.equal([
        { type: 'command', name: '修仙签到', desc: '修仙签到' },
        { type: 'command', name: '闭关', desc: '闭关' },
      ])
    })
  })

  describe('pushCommandPanel', () => {
    it('白名单关闭时创建全局面板(target_type=all)', async () => {
      const { bot, calls } = makeMockBot()
      await pushCommandPanel(bot, baseConfig(), logger)
      const get = calls.find((c) => c.method === 'GET')
      const post = calls.find((c) => c.method === 'POST')
      expect(get?.params.scope).to.equal('group')
      expect(post?.data.target_type).to.equal('all')
      expect(post?.data.panel.items.length).to.equal(12)
      expect(post?.data.panel.remark).to.equal('xiuxian-panel')
    })

    it('白名单开启时创建指定群面板(target_type=specific)', async () => {
      const { bot, calls } = makeMockBot({ existingPanels: [] })
      await pushCommandPanel(bot, baseConfig({ groupWhitelistEnabled: true, groupWhitelist: ['g1', 'qq:g2'] }), logger)
      const post = calls.find((c) => c.method === 'POST')
      expect(post?.data.target_type).to.equal('specific')
      // normalizePlatformId 去掉 qq: 前缀；group_openids 为顶层字段（符合官方 API）
      expect(post?.data.group_openids).to.deep.equal(['g1', 'g2'])
    })

    it('已存在面板时改为 PUT 更新而非新建', async () => {
      const { bot, calls } = makeMockBot({
        existingPanels: [{ panel_id: 'pX', scope: 'group', target_type: 'specific', panel: { items: [], remark: 'xiuxian-panel' }, version: 1 }],
      })
      await pushCommandPanel(bot, baseConfig(), logger)
      expect(calls.find((c) => c.method === 'POST')).to.equal(undefined)
      const put = calls.find((c) => c.method === 'PUT')
      expect(put?.url).to.equal('/v2/panels/pX')
      expect(put?.data.panel.items.length).to.equal(12)
    })

    it('超过 20 个群时分两块创建(remark 后缀区分)', async () => {
      const groups = Array.from({ length: 25 }, (_, i) => `g${i}`)
      const { bot, calls } = makeMockBot({ existingPanels: [] })
      await pushCommandPanel(bot, baseConfig({ groupWhitelistEnabled: true, groupWhitelist: groups }), logger)
      const posts = calls.filter((c) => c.method === 'POST')
      expect(posts.length).to.equal(2)
      expect(posts[0].data.panel.remark).to.equal('xiuxian-panel')
      expect(posts[0].data.group_openids.length).to.equal(20)
      expect(posts[1].data.panel.remark).to.equal('xiuxian-panel-2')
      expect(posts[1].data.group_openids.length).to.equal(5)
    })

    it('白名单开启但列表为空时跳过(不创建)', async () => {
      const { bot, calls } = makeMockBot({ existingPanels: [] })
      await pushCommandPanel(bot, baseConfig({ groupWhitelistEnabled: true, groupWhitelist: [] }), logger)
      expect(calls.find((c) => c.method === 'POST')).to.equal(undefined)
      expect(calls.find((c) => c.method === 'PUT')).to.equal(undefined)
    })

    it('清理白名单缩减后多余的旧面板', async () => {
      const { bot, calls } = makeMockBot({
        existingPanels: [
          { panel_id: 'p1', panel: { remark: 'xiuxian-panel' } },
          { panel_id: 'p2', panel: { remark: 'xiuxian-panel-2' } },
        ],
      })
      // 当前白名单关闭 → 仅需 1 个全局面板，多余的 p2 应被删除
      await pushCommandPanel(bot, baseConfig(), logger)
      const del = calls.find((c) => c.method === 'DELETE')
      expect(del?.url).to.equal('/v2/panels/p2')
    })

    it('API 报错时向上抛出', async () => {
      const { bot } = makeMockBot({ existingPanels: [], throwOn: { method: 'POST', url: '/v2/panels' } })
      let threw = false
      try {
        await pushCommandPanel(bot, baseConfig(), logger)
      } catch {
        threw = true
      }
      expect(threw).to.equal(true)
    })
  })

  describe('pushAllPanels', () => {
    it('无 qq 机器人时返回跳过提示', async () => {
      const out = await pushAllPanels([{ platform: 'mock', http: async () => ({ data: {} }) } as any], baseConfig(), logger)
      expect(out).to.contain('未找到已连接的官方 QQ 机器人')
    })

    it('对 qq 机器人推送并汇总成功', async () => {
      const { bot } = makeMockBot()
      const out = await pushAllPanels([bot], baseConfig(), logger)
      expect(out).to.contain('已推送指令面板')
    })

    it('单个机器人失败不影响其他汇总失败信息', async () => {
      const ok = makeMockBot().bot
      const bad: any = { platform: 'qq', selfId: 'bad', http: async () => { throw Object.assign(new Error('x'), { response: { data: {} } }) } }
      const out = await pushAllPanels([ok, bad], baseConfig(), logger)
      expect(out).to.contain('已推送指令面板')
      expect(out).to.contain('推送失败')
    })
  })
})
