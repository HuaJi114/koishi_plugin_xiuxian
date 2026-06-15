import { Context } from 'koishi'
import { Config } from '../config'
import { ADMIN_AUTHORITY } from '../helpers'
import { XiuxianShopItem } from '../types'
import { formatAmount, randChoice } from '../utils'

declare module 'koishi' {
  interface Tables {
    xiuxian_shop: XiuxianShopItem
  }
}

/** 系统定时上架的回血丹药（对应 nonebot shop_auto_add） */
const SHOP_AUTO_ITEMS: Array<{ id: number; price: number }> = [
  { id: 1101, price: 1000 },
  { id: 1102, price: 2000 },
  { id: 1103, price: 3000 },
  { id: 1104, price: 4000 },
  { id: 1105, price: 5000 },
  { id: 1106, price: 6000 },
  { id: 1108, price: 8000 },
]

function guildOf(session: { guildId?: string }): string | undefined {
  return session.guildId ?? undefined
}

/** 坊市模块（按群独立） */
export function applyShop(ctx: Context, config: Config) {
  const srv = ctx.xiuxian

  ctx.model.extend('xiuxian_shop', {
    id: 'unsigned',
    guildId: 'string',
    sellerId: 'string',
    sellerName: 'string',
    goodsId: 'integer',
    goodsName: 'string',
    goodsType: 'string',
    price: 'integer',
    goodsNum: { type: 'integer', initial: 1 },
    createTime: 'timestamp',
  }, {
    autoInc: true,
    primary: 'id',
  })

  async function listShop(guildId: string): Promise<XiuxianShopItem[]> {
    return ctx.database.get('xiuxian_shop', { guildId }, { sort: { id: 'asc' } })
  }

  /** 每 3 小时对有坊市记录的群自动补货 */
  ctx.setInterval(async () => {
    const all = await ctx.database.get('xiuxian_shop', {})
    const guildIds = [...new Set(all.map((r) => r.guildId))]
    for (const guildId of guildIds) {
      const pick = randChoice(SHOP_AUTO_ITEMS)
      const info = srv.data.getItem(pick.id)
      if (!info) continue
      await ctx.database.create('xiuxian_shop', {
        guildId,
        sellerId: '0',
        sellerName: '神秘人',
        goodsId: pick.id,
        goodsName: info.name,
        goodsType: (info.item_type as string) ?? '丹药',
        price: pick.price,
        goodsNum: 1,
        createTime: new Date(),
      })
      ctx.logger('huaji-xiuxian').info('坊市自动上架：群 %s 物品 %s', guildId, info.name)
    }
  }, 3 * 3600 * 1000)

  ctx.command('xiuxian/背包帮助', '背包与坊市帮助')
    .action(() => [
      '背包帮助信息:',
      '1、我的背包：查看背包',
      '2、使用 <名称> [数量]：使用物品',
      '3、坊市查看：查看本群坊市',
      '4、坊市购买 <编号>：购买物品',
      '5、坊市上架 <物品名> <价格>：上架背包物品',
      '6、坊市下架 <编号>：下架自己的物品',
      '7、系统坊市上架 <物品名> <价格>：管理员上架任意物品',
    ].join('\n'))

  ctx.command('xiuxian/坊市查看', '查看本群坊市')
    .alias('查看坊市')
    .action(async ({ session }) => {
      const gid = guildOf(session!)
      if (!gid) return '坊市仅在群聊中使用！'
      const items = await listShop(gid)
      if (!items.length) return '坊市目前空空如也！'
      const lines = ['☆------本群坊市------☆']
      items.forEach((it) => {
        lines.push(`${it.id}、${it.goodsName}（${it.goodsType}）${formatAmount(it.price)}灵石 — 卖家：${it.sellerName}`)
      })
      return lines.join('\n')
    })

  ctx.command('xiuxian/坊市购买 <num:integer>', '购买坊市物品')
    .action(async ({ session }, num) => {
      const gid = guildOf(session!)
      if (!gid) return '坊市仅在群聊中使用！'
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      const items = await listShop(gid)
      const item = items.find((i) => i.id === num)
      if (!item) return '请输入正确的坊市编号！'
      if (!(await srv.costStoneForUser(userId, item.price, session!.platform))) {
        return `购买需要灵石${formatAmount(item.price)}枚，道友灵石不足！`
      }
      await srv.sendBack(userId, item.goodsId, item.goodsName, item.goodsType, item.goodsNum)
      const charge = Math.floor(item.price * config.shopServiceCharge)
      const sellerGain = item.price - charge
      if (item.sellerId !== '0') {
        await srv.gainStoneForUser(item.sellerId, sellerGain, session!.platform)
      }
      await ctx.database.remove('xiuxian_shop', { id: item.id })
      return `道友购得【${item.goodsName}】，花费灵石${formatAmount(item.price)}枚！`
    })

  ctx.command('xiuxian/坊市上架 <name:string> <price:integer>', '上架背包物品')
    .action(async ({ session }, name, price) => {
      const gid = guildOf(session!)
      if (!gid) return '坊市仅在群聊中使用！'
      const userId = session!.userId!
      const player = await srv.getPlayer(userId)
      if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
      if (!price || price <= 0) return '请输入正确的价格！'
      const backs = await srv.getBack(userId)
      const back = backs.find((b) => b.goodsName === name || b.goodsName.includes(name))
      if (!back || back.goodsNum < 1) return `背包中没有【${name}】！`
      if (back.state === 1) return '已装备的物品无法上架！'
      await srv.reduceBack(userId, back.goodsId, 1, 0)
      await ctx.database.create('xiuxian_shop', {
        guildId: gid,
        sellerId: userId,
        sellerName: player.userName,
        goodsId: back.goodsId,
        goodsName: back.goodsName,
        goodsType: back.goodsType,
        price,
        goodsNum: 1,
        createTime: new Date(),
      })
      return `【${back.goodsName}】已上架坊市，标价${formatAmount(price)}灵石！`
    })

  ctx.command('xiuxian/坊市下架 <num:integer>', '下架坊市物品')
    .action(async ({ session }, num) => {
      const gid = guildOf(session!)
      if (!gid) return '坊市仅在群聊中使用！'
      const userId = session!.userId!
      const items = await listShop(gid)
      const item = items.find((i) => i.id === num)
      if (!item) return '请输入正确的编号！'
      const isAdmin = config.adminQQ.includes(userId)
      if (item.sellerId !== userId && item.sellerId !== '0' && !isAdmin) {
        return '这不是你的上架物品！'
      }
      if (item.sellerId !== '0') {
        await srv.sendBack(item.sellerId, item.goodsId, item.goodsName, item.goodsType, item.goodsNum)
      }
      await ctx.database.remove('xiuxian_shop', { id: item.id })
      return `已下架【${item.goodsName}】！`
    })

  ctx.command('xiuxian/系统坊市上架 <name:string> <price:integer>', '【管理】上架任意物品', { authority: ADMIN_AUTHORITY })
    .action(async ({ session }, name, price) => {
      const gid = guildOf(session!)
      if (!gid) return '坊市仅在群聊中使用！'
      if (!price || price <= 0) return '请输入正确的价格！'
      const found = srv.data.findItemsByName(name)
      if (!found.length) return `找不到物品【${name}】！`
      const [id, info] = found[0]
      await ctx.database.create('xiuxian_shop', {
        guildId: gid,
        sellerId: '0',
        sellerName: '系统',
        goodsId: Number(id),
        goodsName: info.name,
        goodsType: (info.item_type as string) ?? '物品',
        price,
        goodsNum: 1,
        createTime: new Date(),
      })
      return `系统已上架【${info.name}】，标价${formatAmount(price)}灵石！`
    })
}
