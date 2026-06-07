"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyBack = applyBack;
const item_use_1 = require("../item-use");
const utils_1 = require("../utils");
/** 背包 / 坊市模块：查看背包、使用物品、装备、换装、查看物品 */
function applyBack(ctx, _config) {
    const srv = ctx.xiuxian;
    ctx.command('xiuxian/灵石', '查看自己的灵石数量')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const stone = await srv.getStoneForUser(session.userId, session.platform);
        return `道友现在拥有灵石：${(0, utils_1.numberTo)(stone)}枚`;
    });
    ctx.command('xiuxian/我的背包', '查看背包内的物品')
        .alias('我的物品')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const backs = await srv.getBack(session.userId);
        if (!backs.length)
            return '道友的背包空空如也！';
        const groups = {};
        for (const b of backs) {
            const info = srv.data.getItem(b.goodsId);
            const name = info?.name ?? b.goodsName;
            const lv = info?.level ? `${info.level} ` : '';
            const type = info?.item_type ?? b.goodsType;
            const isEquip = type === '法器' || type === '防具' || b.goodsType === '装备';
            const used = isEquip && b.state === 1 ? '（已装备）' : '';
            const groupKey = type === '法器' || type === '防具' ? '装备' : (type || b.goodsType);
            (groups[groupKey] ?? (groups[groupKey] = [])).push(`${lv}${name} x${b.goodsNum}${used}`);
        }
        const lines = [`${player.userName} 道友的背包：`];
        for (const [type, items] of Object.entries(groups)) {
            lines.push(`☆------${type}------☆`);
            lines.push(...items);
        }
        return lines.join('\n');
    });
    ctx.command('xiuxian/使用 <name:string> [num:integer]', '使用背包中的物品')
        .action(async ({ session }, name, num) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!name?.trim())
            return '请输入要使用的物品名称！';
        name = name.trim();
        const backs = await srv.getBack(userId);
        const item = backs.find((b) => b.goodsName === name);
        if (!item)
            return `请检查该道具 ${name} 是否在背包内！`;
        const info = srv.data.getItem(item.goodsId);
        if (!info)
            return '该物品数据缺失，无法使用！';
        let count = 1;
        if (num !== undefined) {
            if (!Number.isInteger(num) || num <= 0)
                return '请输入正确的使用数量！';
            if (num > item.goodsNum)
                return `背包内${name}的数量为${item.goodsNum}，不足${num}个！`;
            count = num;
        }
        const category = (0, item_use_1.getItemUseCategory)(info, item);
        if (category === 'elixir') {
            return (0, item_use_1.useBackItem)(ctx, srv, userId, item, info, count);
        }
        if (count !== 1)
            return '该物品不支持批量使用！';
        return (0, item_use_1.useBackItem)(ctx, srv, userId, item, info, 1);
    });
    ctx.command('xiuxian/换装 <name:string>', '卸下已装备的装备')
        .alias('卸下')
        .action(async ({ session }, name) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!name?.trim())
            return '请输入要卸下的装备名称！';
        name = name.trim();
        const backs = await srv.getBack(userId);
        const item = backs.find((b) => b.goodsName === name);
        if (!item)
            return `请检查该装备 ${name} 是否在背包内！`;
        const info = srv.data.getItem(item.goodsId);
        if (!info)
            return '该物品数据缺失！';
        return (0, item_use_1.unequipItem)(ctx, srv, userId, item, info);
    });
    ctx.command('xiuxian/查看修仙界物品 [query:string]', '按类型或编号查看物品')
        .action((_, query) => {
        const valid = ['功法', '神通', '丹药', '合成丹药', '法器', '防具', '聚灵旗', '药材', '炼丹炉'];
        if (!query?.trim()) {
            return `请输入物品类型或编号。\n支持的类型：${valid.join('|')}\n示例：查看修仙界物品 1101`;
        }
        query = query.trim();
        if (/^\d+$/.test(query)) {
            const detail = srv.data.formatItemDetail(query);
            if (!detail)
                return `未找到编号为 ${query} 的物品。`;
            return detail;
        }
        if (!valid.includes(query))
            return `支持的类型：${valid.join('|')}；或输入物品编号查询详情。`;
        const data = srv.data.getItemsByType([query]);
        const list = Object.entries(data).slice(0, 50);
        if (!list.length)
            return '暂无该类型物品。';
        const lines = [`【${query}】物品图鉴（发送【查看修仙界物品 <编号>】查看效果）：`];
        for (const [id, info] of list) {
            lines.push(`${id} ${info.level ?? ''} ${info.name}`);
        }
        return lines.join('\n');
    });
}
//# sourceMappingURL=back.js.map