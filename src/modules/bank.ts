import { Context } from 'koishi'
import { Config } from '../config'
import { formatAmount } from '../utils'

declare module 'koishi' {
  interface Tables {
    xiuxian_bank: XiuxianBank
  }
}

/** 灵庄存款表 */
export interface XiuxianBank {
  userId: string
  saveStone: number
  saveTime: Date
  bankLevel: number
}

interface BankLevel {
  savemax: number
  levelup: number
  interest: number
  level: string
}

/** 灵庄会员等级配置（10× nonebot 原版数值） */
const BANK_LEVEL: Record<number, BankLevel> = {
  1: { savemax: 1000000, levelup: 200000, interest: 0.002, level: '普通会员' },
  2: { savemax: 2000000, levelup: 400000, interest: 0.0021, level: '小会员' },
  3: { savemax: 4000000, levelup: 800000, interest: 0.0022, level: '大会员' },
  4: { savemax: 8000000, levelup: 1600000, interest: 0.0023, level: '优质会员' },
  5: { savemax: 16000000, levelup: 3200000, interest: 0.0024, level: '黄金会员' },
  6: { savemax: 32000000, levelup: 6400000, interest: 0.0025, level: '钻石会员' },
  7: { savemax: 64000000, levelup: 0, interest: 0.0028, level: '终极会员' },
}
const MAX_BANK_LEVEL = 7

function formatBankLevelTable(): string {
  const lines = ['会员等级一览（发送【灵庄升级会员】升级）：']
  for (let i = 1; i <= MAX_BANK_LEVEL; i++) {
    const lv = BANK_LEVEL[i]
    const up = lv.levelup ? `升级需${formatAmount(lv.levelup)}灵石` : '已满级'
    lines.push(`${i}.${lv.level} — 存储上限${formatAmount(lv.savemax)}，时息${(lv.interest * 100).toFixed(2)}%，${up}`)
  }
  return lines.join('\n')
}

/** 灵庄（银行）模块 */
export function applyBank(ctx: Context, _config: Config) {
  const srv = ctx.xiuxian

  ctx.model.extend('xiuxian_bank', {
    userId: 'string',
    saveStone: { type: 'double', initial: 0 },
    saveTime: 'timestamp',
    bankLevel: { type: 'integer', initial: 1 },
  }, { primary: 'userId' })

  async function getBankInfo(userId: string): Promise<XiuxianBank> {
    const [info] = await ctx.database.get('xiuxian_bank', { userId })
    if (info) return info
    return ctx.database.create('xiuxian_bank', { userId, saveStone: 0, saveTime: new Date(), bankLevel: 1 })
  }

  function settle(info: XiuxianBank): [number, number] {
    const now = Date.now()
    const hours = Math.round((now - info.saveTime.getTime()) / 3600000 * 100) / 100
    const interest = Math.floor(info.saveStone * hours * BANK_LEVEL[info.bankLevel].interest)
    info.saveTime = new Date()
    return [interest, hours]
  }

  ctx.command('xiuxian/灵庄', '灵庄（银行）帮助')
    .alias('灵庄帮助')
    .action(() => [
      '灵庄帮助信息:',
      '1、灵庄存灵石 <数量>：存入灵石获取利息',
      '2、灵庄取灵石 <数量>：结算利息并取出灵石',
      '3、灵庄升级会员：消耗灵石提升会员等级，提高存储上限与时息',
      '4、灵庄信息：查询当前灵庄与下一级升级费用',
      '5、灵庄结算：仅结算利息',
      '',
      formatBankLevelTable(),
    ].join('\n'))

  ctx.command('xiuxian/灵庄存灵石 <amount:integer>', '存入灵石')
    .action(async ({ session }, amount) => {
      const player = await srv.getPlayer(session!.userId!)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!amount || amount <= 0) return '请输入正确的金额！'
      const pf = session!.platform
      const stone = await srv.getStoneForUser(session!.userId!, pf)
      if (stone < amount) return `道友所拥有的灵石为${formatAmount(stone)}枚，金额不足，请重新输入！`
      const info = await getBankInfo(session!.userId!)
      const lv = BANK_LEVEL[info.bankLevel]
      const nowMax = lv.savemax - info.saveStone
      if (amount > nowMax) {
        return `道友当前为${lv.level}，可存储上限${formatAmount(lv.savemax)}枚，已存${formatAmount(info.saveStone)}枚，还可存${formatAmount(nowMax)}枚！`
      }
      const [interest, hours] = settle(info)
      if (!(await srv.costStoneForUser(session!.userId!, amount, pf))) return '灵石不足！'
      await srv.gainStoneForUser(session!.userId!, interest, pf)
      info.saveStone += amount
      await ctx.database.set('xiuxian_bank', { userId: session!.userId! }, { saveStone: info.saveStone, saveTime: info.saveTime })
      return `本次结息${hours}小时，获得利息${formatAmount(interest)}枚!\n存入灵石${formatAmount(amount)}枚，灵庄现存${formatAmount(info.saveStone)}枚`
    })

  ctx.command('xiuxian/灵庄取灵石 <amount:integer>', '取出灵石')
    .action(async ({ session }, amount) => {
      const player = await srv.getPlayer(session!.userId!)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!amount || amount <= 0) return '请输入正确的金额！'
      const info = await getBankInfo(session!.userId!)
      if (info.saveStone < amount) return `道友当前灵庄存有灵石${formatAmount(info.saveStone)}枚，金额不足！`
      const [interest, hours] = settle(info)
      info.saveStone -= amount
      await srv.gainStoneForUser(session!.userId!, amount + interest, session!.platform)
      await ctx.database.set('xiuxian_bank', { userId: session!.userId! }, { saveStone: info.saveStone, saveTime: info.saveTime })
      return `本次结息${hours}小时，获得利息${formatAmount(interest)}枚!\n取出灵石${formatAmount(amount)}枚，灵庄现存${formatAmount(info.saveStone)}枚!`
    })

  ctx.command('xiuxian/灵庄升级会员', '升级灵庄会员')
    .alias('灵庄会员')
    .action(async ({ session }) => {
      const player = await srv.getPlayer(session!.userId!)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      const info = await getBankInfo(session!.userId!)
      if (info.bankLevel >= MAX_BANK_LEVEL) return '道友已经是本灵庄最大的会员啦！'
      const cost = BANK_LEVEL[info.bankLevel].levelup
      if (!(await srv.costStoneForUser(session!.userId!, cost, session!.platform))) {
        return `升级至${BANK_LEVEL[info.bankLevel + 1].level}需灵石${formatAmount(cost)}枚，道友灵石不足！`
      }
      const next = info.bankLevel + 1
      await ctx.database.set('xiuxian_bank', { userId: session!.userId! }, { bankLevel: next })
      const nlv = BANK_LEVEL[next]
      return `成功升级至${nlv.level}！消耗灵石${formatAmount(cost)}枚，存储上限${formatAmount(nlv.savemax)}枚，时息${(nlv.interest * 100).toFixed(2)}%`
    })

  ctx.command('xiuxian/灵庄信息', '查询灵庄信息')
    .action(async ({ session }) => {
      const player = await srv.getPlayer(session!.userId!)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      const info = await getBankInfo(session!.userId!)
      const stone = await srv.getStoneForUser(session!.userId!, session!.platform)
      const lv = BANK_LEVEL[info.bankLevel]
      const lines = [
        '道友的灵庄信息：',
        `已存：${formatAmount(info.saveStone)}灵石`,
        `存入时间：${info.saveTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
        `灵庄会员：${lv.level}（${info.bankLevel}/${MAX_BANK_LEVEL}）`,
        `时息利率：${(lv.interest * 100).toFixed(2)}%/小时`,
        `存储上限：${formatAmount(lv.savemax)}枚`,
        `当前钱包灵石：${formatAmount(stone)}枚`,
      ]
      if (info.bankLevel < MAX_BANK_LEVEL) {
        const next = BANK_LEVEL[info.bankLevel + 1]
        lines.push(`下一级：${next.level}，升级需${formatAmount(lv.levelup)}灵石，上限${formatAmount(next.savemax)}枚`)
      }
      return lines.join('\n')
    })

  ctx.command('xiuxian/灵庄结算', '结算利息')
    .action(async ({ session }) => {
      const player = await srv.getPlayer(session!.userId!)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      const info = await getBankInfo(session!.userId!)
      const [interest, hours] = settle(info)
      await srv.gainStoneForUser(session!.userId!, interest, session!.platform)
      await ctx.database.set('xiuxian_bank', { userId: session!.userId! }, { saveTime: info.saveTime })
      return `本次结息${hours}小时，获得利息${formatAmount(interest)}枚！`
    })
}
