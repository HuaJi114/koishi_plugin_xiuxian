"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyWork = applyWork;
const daily_utils_1 = require("../daily-utils");
const utils_1 = require("../utils");
const FREE_REFRESH = daily_utils_1.WORK_REFRESH_DAILY_LIMIT;
const REFRESH_COST = 500000;
const ABORT_COST = 4000000;
/** 悬赏令模块：刷新、接取、结算、终止 */
function applyWork(ctx, _config) {
    const srv = ctx.xiuxian;
    ctx.model.extend('xiuxian_work', {
        userId: 'string',
        workName: 'string',
        rate: 'integer',
        award: 'integer',
        time: 'integer',
        itemId: 'integer',
        successMsg: 'string',
        failMsg: 'string',
        startTime: 'timestamp',
    }, { primary: 'userId' });
    /** 已刷新但未接取的悬赏令列表（内存） */
    const pending = new Map();
    /** 计算成功率，对应 workmake.countrate */
    function countRate(exp, needExp) {
        let rate = Math.floor((exp / needExp) * 100);
        let isOut = 1;
        if (rate >= 100) {
            let tp = 1;
            let e = exp;
            while (e / needExp * 100 > 100) {
                tp += 1;
                e /= 1.5;
            }
            rate = 100;
            isOut = Math.max(1 - tp * 0.05, 0.5);
        }
        return [rate, Math.round(isOut * 100) / 100];
    }
    /** 生成悬赏令列表，对应 workmake */
    function makeWork(level, exp) {
        const workLevel = level === '江湖好手' ? '江湖好手' : level.slice(0, 3);
        const sources = [srv.data.work.yaocai, srv.data.work.ansha, srv.data.work.zuoyao];
        const result = [];
        for (const source of sources) {
            const pool = source[workLevel];
            if (!pool)
                continue;
            const names = Object.keys(pool);
            if (!names.length)
                continue;
            const name = (0, utils_1.randChoice)(names);
            const task = pool[name];
            const priceData = srv.data.work.levelPrice[workLevel]?.[task.level];
            if (!priceData)
                continue;
            const [rate, isOut] = countRate(exp, priceData.needexp);
            const itemType = (0, utils_1.rouletteSelect)({ 功法: 400, 神通: 400, 药材: 400 });
            const itemId = srv.data.randomItemIdByRank(srv.data.itemRankByLevel(level), [itemType]);
            result.push({
                name,
                rate,
                award: priceData.award,
                time: Math.floor(priceData.time * isOut),
                itemId: itemId === 0 ? 0 : Number(itemId),
                successMsg: task.succeed,
                failMsg: task.fail,
            });
        }
        return result;
    }
    ctx.command('xiuxian/悬赏令', '刷新并查看悬赏令')
        .action(async ({ session }) => doRefresh(session.userId, session.platform, false));
    ctx.command('xiuxian/悬赏令刷新', '刷新悬赏令')
        .action(async ({ session }) => doRefresh(session.userId, session.platform, true));
    async function doRefresh(userId, platform, isManual) {
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const cd = await srv.getCd(userId);
        if (cd && cd.type === 1)
            return '已经在闭关中，请输入【出关】结束后才能获取悬赏令！';
        if (cd && cd.type === 3)
            return '道友在秘境中，请等待结束后才能获取悬赏令！';
        const [active] = await ctx.database.get('xiuxian_work', { userId });
        if (active)
            return `进行中的悬赏令【${active.workName}】，请输入【悬赏令结算】或【悬赏令终止】！`;
        let stoneMsg = '';
        const refreshCount = player.workRefreshCount ?? 0;
        if (isManual) {
            if (refreshCount >= FREE_REFRESH) {
                if (!(await srv.costStoneForUser(userId, REFRESH_COST, platform))) {
                    return `道友的灵石不足以刷新，下次刷新消耗灵石：${REFRESH_COST}枚`;
                }
                stoneMsg = `\n道友消耗灵石${REFRESH_COST}枚，成功刷新悬赏令`;
            }
            await ctx.database.set('xiuxian_player', { userId }, { workRefreshCount: refreshCount + 1 });
        }
        const list = makeWork(player.level, player.exp);
        if (!list.length)
            return '道友的境界暂无可用悬赏令！';
        pending.set(userId, list);
        const updated = isManual ? refreshCount + 1 : refreshCount;
        const free = Math.max(FREE_REFRESH - updated, 0);
        const lines = ['☆------道友的个人悬赏令------☆'];
        list.forEach((w, i) => {
            const itemMsg = w.itemId ? `，可能额外获得：${srv.data.getItem(w.itemId)?.name ?? ''}` : '';
            lines.push(`${i + 1}、${w.name}，完成机率${w.rate}%，基础报酬${w.award}修为，预计需${w.time}分钟${itemMsg}`);
        });
        lines.push(`(【悬赏令刷新】每日免费${FREE_REFRESH}次，超出后每次消耗灵石${REFRESH_COST}，今日剩余免费刷新：${free}次)${stoneMsg}`);
        return lines.join('\n');
    }
    ctx.command('xiuxian/悬赏令接取 <num:integer>', '接取指定编号的悬赏令')
        .action(async ({ session }, num) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const cd = await srv.getCd(userId);
        if (cd && cd.type !== 0)
            return '道友当前有事在身，无法接取悬赏令！';
        const list = pending.get(userId);
        if (!list)
            return '没有查到你的悬赏令信息呢，请刷新！';
        if (!num || num < 1 || num > list.length)
            return '请输入正确的任务序号';
        const work = list[num - 1];
        await ctx.database.create('xiuxian_work', {
            userId,
            workName: work.name,
            rate: work.rate,
            award: work.award,
            time: work.time,
            itemId: work.itemId,
            successMsg: work.successMsg,
            failMsg: work.failMsg,
            startTime: new Date(),
        });
        await srv.setState(userId, 2);
        pending.delete(userId);
        return `接取任务【${work.name}】成功，预计需要${work.time}分钟。`;
    });
    ctx.command('xiuxian/悬赏令结算', '结算悬赏令（获得修为）')
        .action(async ({ session }) => doSettle(session.userId, 'exp'));
    ctx.command('xiuxian/最后的悬赏令', '结算悬赏令（获得灵石，用于卡住时）')
        .action(async ({ session }) => doSettle(session.userId, 'stone'));
    async function doSettle(userId, reward) {
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const [active] = await ctx.database.get('xiuxian_work', { userId });
        if (!active)
            return '没有查到你的悬赏令信息呢，请刷新！';
        const elapsed = Math.floor((Date.now() - active.startTime.getTime()) / 60000);
        if (elapsed < active.time) {
            return `进行中的悬赏令【${active.workName}】，预计${active.time - elapsed}分钟后可结束`;
        }
        const bigSuc = active.rate >= 100;
        const success = (0, utils_1.randInt)(1, 100) <= active.rate;
        await ctx.database.remove('xiuxian_work', { userId });
        await srv.setState(userId, 0);
        let amount = active.award;
        let msg;
        if (success) {
            amount = bigSuc ? active.award * 2 : active.award;
            msg = active.successMsg;
        }
        else {
            amount = Math.floor(active.award / 2);
            msg = active.failMsg;
        }
        if (reward === 'exp') {
            await srv.addExp(userId, amount);
            await srv.updatePower(userId);
            msg = `悬赏令结算，${msg}，增加修为${amount}`;
        }
        else {
            await srv.gainStoneForUser(userId, amount, player.platform);
            msg = `悬赏令结算，${msg}，获得报酬${amount}枚灵石`;
        }
        if (success && active.itemId) {
            const item = srv.data.getItem(active.itemId);
            if (item) {
                await srv.sendBack(userId, active.itemId, item.name, item.type ?? item.item_type ?? '物品', 1);
                msg += `，额外获得奖励：${item.level ?? ''}${item.name}!`;
            }
        }
        else {
            msg += '!';
        }
        return msg;
    }
    ctx.command('xiuxian/悬赏令终止', '终止当前悬赏令（罚没灵石）')
        .action(async ({ session }) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const [active] = await ctx.database.get('xiuxian_work', { userId });
        if (!active)
            return '没有查到你的悬赏令信息呢，请刷新！';
        await srv.costStoneForUser(userId, ABORT_COST, session.platform);
        await ctx.database.remove('xiuxian_work', { userId });
        await srv.setState(userId, 0);
        return `道友不讲诚信，被打了一顿，灵石减少${ABORT_COST}，悬赏令已终止！`;
    });
    ctx.command('xiuxian/悬赏令帮助', '悬赏令帮助')
        .action(() => [
        '悬赏令帮助信息:',
        '1、悬赏令：获取对应实力的悬赏令',
        `2、悬赏令刷新：刷新悬赏令，每日免费${FREE_REFRESH}次`,
        '3、悬赏令接取 <编号>：接取对应悬赏令',
        '4、悬赏令结算：结算悬赏奖励（修为）',
        '5、悬赏令终止：终止当前悬赏令任务',
        '6、最后的悬赏令：结算并获得灵石（用于卡住的道友）',
    ].join('\n'));
}
//# sourceMappingURL=work.js.map