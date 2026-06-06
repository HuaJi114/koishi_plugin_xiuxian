"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyBack = applyBack;
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
        var _a;
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
            const used = b.goodsType === '装备' && b.state === 1 ? '（已装备）' : '';
            (groups[_a = b.goodsType] ?? (groups[_a] = [])).push(`${lv}${name} x${b.goodsNum}${used}`);
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
        if (!name)
            return '请输入要使用的物品名称！';
        const backs = await srv.getBack(userId);
        const item = backs.find((b) => b.goodsName === name);
        if (!item)
            return `请检查该道具 ${name} 是否在背包内！`;
        const info = srv.data.getItem(item.goodsId);
        if (!info)
            return '该物品数据缺失，无法使用！';
        if (item.goodsType === '装备') {
            if (item.state === 1)
                return '该装备已被装备，请勿重复装备！';
            if (info.item_type === '法器')
                await srv.setFaqiBuff(userId, Number(item.goodsId));
            else if (info.item_type === '防具')
                await srv.setArmorBuff(userId, Number(item.goodsId));
            await ctx.database.set('xiuxian_back', { userId, goodsId: item.goodsId }, { state: 1, updateTime: new Date() });
            return `成功装备${name}！`;
        }
        if (item.goodsType === '技能') {
            const buff = await srv.getBuff(userId);
            if (info.item_type === '神通') {
                if (buff.secBuff === Number(item.goodsId))
                    return `道友已学会该神通：${info.name}，请勿重复学习！`;
                await srv.setSecBuff(userId, Number(item.goodsId));
                return `恭喜道友学会神通：${info.name}！`;
            }
            if (info.item_type === '功法') {
                if (buff.mainBuff === Number(item.goodsId))
                    return `道友已学会该功法：${info.name}，请勿重复学习！`;
                await srv.setMainBuff(userId, Number(item.goodsId));
                return `恭喜道友学会功法：${info.name}！`;
            }
            return '发生未知错误！';
        }
        if (item.goodsType === '丹药') {
            let count = 1;
            if (num && num >= 1 && num <= item.goodsNum)
                count = num;
            return useElixir(userId, item.goodsId, info, count);
        }
        return '该类型的物品目前暂时不支持使用！';
    });
    ctx.command('xiuxian/换装 <name:string>', '卸下已装备的装备')
        .alias('卸下')
        .action(async ({ session }, name) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!name)
            return '请输入要卸下的装备名称！';
        const backs = await srv.getBack(userId);
        const item = backs.find((b) => b.goodsName === name && b.goodsType === '装备');
        if (!item)
            return `请检查该装备 ${name} 是否在背包内！`;
        const info = srv.data.getItem(item.goodsId);
        if (info?.item_type === '法器')
            await srv.setFaqiBuff(userId, 0);
        else if (info?.item_type === '防具')
            await srv.setArmorBuff(userId, 0);
        await ctx.database.set('xiuxian_back', { userId, goodsId: item.goodsId }, { state: 0, updateTime: new Date() });
        return `成功卸下${name}！`;
    });
    ctx.command('xiuxian/查看修仙界物品 [query:string]', '按类型或编号查看物品')
        .action((_, query) => {
        const valid = ['功法', '神通', '丹药', '合成丹药', '法器', '防具'];
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
    /** 使用丹药，对应 back_util.check_use_elixir */
    async function useElixir(userId, goodsId, info, num) {
        const player = (await srv.getPlayer(userId));
        const userRank = srv.data.userRank(player.level);
        const goodsRank = Number(info.rank ?? 0);
        const name = info.name;
        const buffType = info.buff_type;
        const buff = Number(info.buff ?? 0);
        const realm = info['境界'] ?? '';
        const maxHp = Math.floor(player.exp / 2);
        const maxMp = Math.floor(player.exp);
        switch (buffType) {
            case 'level_up_rate': {
                if (goodsRank < userRank)
                    return `丹药：${name}的最低使用境界为${realm}，道友不满足使用条件`;
                if (goodsRank - userRank > 18)
                    return `道友当前境界为：${player.level}，丹药：${name}已不能满足道友！`;
                await srv.reduceBack(userId, goodsId, num, 1);
                await srv.setLevelRate(userId, player.levelUpRate + buff * num);
                return `道友成功使用丹药：${name}${num}颗，下一次突破的成功概率提高${buff * num}%!`;
            }
            case 'level_up_big': {
                if (goodsRank !== userRank)
                    return `丹药：${name}的使用境界为${realm}，道友不满足使用条件！`;
                const item = await srv.getBackItem(userId, goodsId);
                if (item && item.allNum >= Number(info.all_num ?? Infinity)) {
                    return `道友使用的丹药：${name}已经达到耐药性上限！`;
                }
                await srv.reduceBack(userId, goodsId, 1, 1);
                await srv.setLevelRate(userId, player.levelUpRate + buff);
                return `道友成功使用丹药：${name}1颗，下一次突破的成功概率提高${buff}%!`;
            }
            case 'hp': {
                if (player.root !== '器师' && goodsRank < userRank)
                    return `丹药：${name}的使用境界为${realm}以上，道友不满足使用条件！`;
                if (player.hp === maxHp && player.mp === maxMp)
                    return '道友的状态是满的，用不了哦！';
                const ratio = Math.round((0.016 * userRank + 0.104) * buff * 100) / 100;
                const newHp = Math.min(player.hp + Math.floor(ratio * maxHp * num), maxHp);
                const newMp = Math.min(player.mp + Math.floor(ratio * maxMp * num), maxMp);
                await srv.reduceBack(userId, goodsId, num, 1);
                await srv.setHpMp(userId, newHp, newMp);
                return `道友成功使用丹药：${name}${num}颗，经过境界转化状态恢复了${Math.floor(ratio * 100 * num)}%!`;
            }
            case 'all': {
                if (player.root !== '器师' && goodsRank < userRank)
                    return `丹药：${name}的使用境界为${realm}以上，道友不满足使用条件！`;
                if (player.hp === maxHp && player.mp === maxMp)
                    return '道友的状态是满的，用不了哦！';
                await srv.reduceBack(userId, goodsId, 1, 1);
                await srv.resetState(userId);
                return `道友成功使用丹药：${name}1颗，状态已全部恢复!`;
            }
            case 'exp_up': {
                if (goodsRank < userRank)
                    return `丹药：${name}的使用境界为${realm}以上，道友不满足使用条件！`;
                const exp = buff * num;
                await srv.addExp(userId, exp);
                await srv.updatePower(userId);
                const updated = (await srv.getPlayer(userId));
                await srv.setHpMp(userId, Math.floor(updated.hp + exp / 2), Math.floor(updated.mp + exp));
                await srv.reduceBack(userId, goodsId, num, 1);
                return `道友成功使用丹药：${name}${num}颗，修为增加${exp}点！`;
            }
            default:
                return '该类型的丹药目前暂时不支持使用！';
        }
    }
}
//# sourceMappingURL=back.js.map