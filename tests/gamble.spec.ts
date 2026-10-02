import { Context } from 'koishi'
import { expect } from 'chai'
import mock from '@koishijs/plugin-mock'
import memory from '@koishijs/plugin-database-memory'
import monetary from 'koishi-plugin-monetary'
import * as mod from '../src'
import { judgeJinyinge, rouletteDies } from '../src/modules/gamble'

const plugin = (mod as any).default ?? mod

function makeApp(cfg: Record<string, any> = {}): Context {
  const app = new Context()
  app.plugin(mock)
  app.plugin(memory)
  app.plugin(monetary)
  app.plugin(plugin, { currency: 'default', groupOnly: false, adminQQ: [], ...cfg })
  return app
}

async function start(app: Context) { await app.start() }
async function stop(app: Context) {
  try { await app.stop() } catch { /* ignore mock dispose */ }
}

/** 直接建玩家并注入灵石（绕过「我要修仙」引导的 prompt，避免测试卡住） */
async function makePlayer(app: Context, userId: string, stone: number) {
  // mock 下 authority 默认 0 会被命令权限拦截（真实玩家可用，命令 authority 为 0）；测试给 2 以模拟普通登录用户
  const u = await app.database.createUser('mock', userId, { name: userId, authority: 2 })
  const uid = u.id
  await app.database.create('xiuxian_player', {
    userId,
    platform: 'mock',
    uid,
    userName: userId,
    level: '江湖好手',
    exp: 100,
    hp: 50,
    mp: 100,
    atk: 10,
  })
  // 本项目灵石经济即 monetary 数据库表（由 koishi-plugin-monetary 提供模型）
  await app.database.create('monetary', { uid, currency: 'default', value: stone })
  return uid
}

const G = 'g100'

describe('娱乐小游戏（金银阁 / 虚神界对决）', () => {
  describe('judgeJinyinge 纯函数', () => {
    it('豹子(三同点)必为通杀', () => {
      for (let v = 1; v <= 6; v++) {
        expect(judgeJinyinge('大', v, v, v)).to.equal('triple')
        expect(judgeJinyinge('小', v, v, v)).to.equal('triple')
      }
    })

    it('4–10 判为小、11–17 判为大，且全 216 组合无遗漏', () => {
      let win = 0, lose = 0, triple = 0
      for (let d1 = 1; d1 <= 6; d1++) {
        for (let d2 = 1; d2 <= 6; d2++) {
          for (let d3 = 1; d3 <= 6; d3++) {
            const rBig = judgeJinyinge('大', d1, d2, d3)
            const rSmall = judgeJinyinge('小', d1, d2, d3)
            // 押大与押小在同一组合下结果必须相反（一赢一非赢，除豹子外）
            if (rBig === 'triple') {
              expect(rSmall).to.equal('triple')
              triple++
            } else {
              expect(rBig === 'win').to.not.equal(rSmall === 'win')
              if (rBig === 'win') win++
              else lose++
            }
            // 非豹子组合必在 4–17 区间
            if (rBig !== 'triple') {
              const sum = d1 + d2 + d3
              expect(sum >= 4 && sum <= 17).to.equal(true)
            }
          }
        }
      }
      // 216 = 6 豹子 + 105 大赢 + 105 小赢（其余为输）
      expect(triple).to.equal(6)
      expect(win).to.equal(105)
      expect(lose).to.equal(105)
    })

    it('具体组合：小赢/大赢/输', () => {
      expect(judgeJinyinge('小', 1, 2, 3)).to.equal('win') // sum=6 小
      expect(judgeJinyinge('大', 6, 5, 5)).to.equal('win') // sum=16 大
      expect(judgeJinyinge('大', 1, 2, 3)).to.equal('lose') // sum=6 非大
      expect(judgeJinyinge('小', 6, 5, 5)).to.equal('lose') // sum=16 非小
    })
  })

  describe('rouletteDies 纯函数', () => {
    it('奇数膛 challenger 死、偶数膛 target 死', () => {
      for (let p = 1; p <= 6; p++) {
        expect(rouletteDies(p)).to.equal(p % 2 === 1 ? 'challenger' : 'target')
      }
    })
    it('challenger 与 target 各 3/6 概率暴毙（公平）', () => {
      let c = 0
      for (let p = 1; p <= 6; p++) if (rouletteDies(p) === 'challenger') c++
      expect(c).to.equal(3)
    })
  })

  describe('金银阁 指令门槛', () => {
    let app: Context
    before(async () => {
      app = makeApp({ enableJinyinge: true })
      await start(app)
      await makePlayer(app, 'A', 100000)
    })
    after(async () => { await stop(app) })

    it('关闭开关时提示未开放', async () => {
      const app2 = makeApp({ enableJinyinge: false })
      await start(app2)
      const r = await app2.mock.client('A2', G).receive('金银阁')
      expect(r.join('\n')).to.contain('暂未开放')
      await stop(app2)
    })

    it('未注册玩家提示先加入', async () => {
      const r = await app.mock.client('999', G).receive('金银阁')
      expect(r.join('\n')).to.contain('我要修仙')
    })

    // 注：金银阁为交互式（session.prompt 下注），本 mock  harness 的 session.prompt 不会消费后续 receive，
    // 故完整下注流程不在此集成；骰子/赔付核心已由 judgeJinyinge 纯函数单测覆盖全部 216 组合。
  })

  describe('虚神界对决 指令门槛与对决流程', () => {
    let app: Context
    before(async () => {
      app = makeApp({ enableVoidDuel: true, voidDuelDailyLimit: 3, voidDuelAcceptTimeout: 120 })
      await start(app)
      await makePlayer(app, 'A', 100000)
      await makePlayer(app, 'B', 100000)
    })
    after(async () => { await stop(app) })

    it('关闭开关时提示未开放', async () => {
      const app2 = makeApp({ enableVoidDuel: false })
      await start(app2)
      const r = await app2.mock.client('A', G).receive('虚神界对决 100')
      expect(r.join('\n')).to.contain('暂未开放')
      await stop(app2)
    })

    it('未注册玩家提示先加入', async () => {
      const r = await app.mock.client('888', G).receive('虚神界对决 100 <at id="B"/>')
      expect(r.join('\n')).to.contain('我要修仙')
    })

    it('缺少 @ 目标时提示', async () => {
      const r = await app.mock.client('A', G).receive('虚神界对决 100')
      expect(r.join('\n')).to.contain('请 @')
    })

    it('与自己对决被拒', async () => {
      const r = await app.mock.client('A', G).receive('虚神界对决 100 <at id="A"/>')
      expect(r.join('\n')).to.contain('不能与自己')
    })

    it('灵石不足无法发起', async () => {
      const r = await app.mock.client('A', G).receive(`虚神界对决 999999 <at id="B"/>`)
      expect(r.join('\n')).to.contain('灵石不足')
    })

    it('完整流程：发起→接受→结算，灵石守恒且胜者通吃', async () => {
      const srv = (app as any).xiuxian
      const beforeA = await srv.getStoneForUser('A', 'mock')
      const beforeB = await srv.getStoneForUser('B', 'mock')
      const r1 = await app.mock.client('A', G).receive(`虚神界对决 1000 <at id="B"/>`)
      expect(r1.join('\n')).to.contain('发起对决')
      const r2 = await app.mock.client('B', G).receive('接受对决')
      const text = r2.join('\n')
      expect(text).to.contain('胜者')
      expect(text).to.contain('通吃')
      const afterA = await srv.getStoneForUser('A', 'mock')
      const afterB = await srv.getStoneForUser('B', 'mock')
      // 双方各押 1000，总额守恒
      expect(afterA + afterB).to.equal(beforeA + beforeB)
      // 一方 +1000、另一方 -1000
      expect(Math.abs((afterA - beforeA) + (afterB - beforeB))).to.equal(0)
      expect(Math.max(afterA - beforeA, afterB - beforeB)).to.equal(1000)
    })

    it('接受方无待决对决时提示', async () => {
      const r = await app.mock.client('B', G).receive('接受对决')
      expect(r.join('\n')).to.contain('没有等待你接受')
    })
  })
})
