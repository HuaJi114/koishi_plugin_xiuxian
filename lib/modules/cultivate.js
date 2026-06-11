"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCultivate = applyCultivate;
const helpers_1 = require("../helpers");
const skills_1 = require("../skills");
const utils_1 = require("../utils");
const STONE_CULTIVATE_RATIO = 10;
function stoneCultivateUsage() {
    return [
        '命令格式：灵石修炼 <灵石数量>',
        `说明：每 ${STONE_CULTIVATE_RATIO} 灵石转化 1 修为。`,
        '示例：灵石修炼 1000',
    ].join('\n');
}
function stoneCultivateInsufficient(amount, stone) {
    return [
        '灵石不足，无法修炼。',
        `当前灵石：${(0, utils_1.numberTo)(stone)}枚`,
        `本次需要：${(0, utils_1.numberTo)(amount)}枚（可获得约 ${Math.floor(amount / STONE_CULTIVATE_RATIO)} 修为）`,
        stoneCultivateUsage(),
    ].join('\n');
}
/** 双修每日次数（内存计数，按日期重置） */
const twoExpCount = new Map();
const TWO_EXP_LIMIT = 3;
function getTwoExpCount(userId) {
    const today = new Date().toDateString();
    const rec = twoExpCount.get(userId);
    if (!rec || rec.date !== today)
        return 0;
    return rec.count;
}
function addTwoExpCount(userId) {
    const today = new Date().toDateString();
    const rec = twoExpCount.get(userId);
    if (!rec || rec.date !== today)
        twoExpCount.set(userId, { date: today, count: 1 });
    else
        rec.count += 1;
}
/** 修炼模块：闭关、出关、灵石出关、灵石修炼、双修 */
function applyCultivate(ctx, config) {
    const srv = ctx.xiuxian;
    // 闭关
    ctx.command('xiuxian/闭关', '进入闭关修炼状态')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const cd = await srv.getCd(session.userId);
        if (cd && cd.type !== 0)
            return stateMsg(cd.type);
        await srv.setState(session.userId, 1);
        return '进入闭关状态，如需出关，发送【出关】！';
    });
    // 出关 / 灵石出关
    ctx.command('xiuxian/出关', '结束闭关并结算修为')
        .alias('灵石出关', { args: ['stone'] })
        .action(async ({ session }, mode) => doOutClosing(session.userId, mode === 'stone'));
    async function doOutClosing(userId, useStone) {
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const cd = await srv.getCd(userId);
        if (!cd || cd.type !== 1)
            return '道友现在并没有在闭关哦~';
        const wasInjured = player.hp <= Math.floor(player.exp / 10);
        const maxExp = srv.data.closingMaxExp(player.level, config.closingExpUpperLimit);
        let userGetExpMax = Math.max(Math.floor(maxExp) - player.exp, 0);
        const expTime = Math.floor((0, utils_1.dateDiffSeconds)(new Date(), cd.createTime) / 60);
        const rootRate = srv.data.roots[player.rootType]?.type_speeds ?? 1;
        const realmRate = srv.data.levels[player.level]?.spend ?? 1;
        const buff = await srv.getBuff(userId);
        const skills = await srv.getLearnedSkills(userId);
        const merged = (0, skills_1.mergeSkillBuffs)(skills, srv.data);
        const rateBuff = merged.ratebuff;
        let exp = Math.floor(expTime * config.closingExp * (rootRate * realmRate * (1 + rateBuff)));
        await srv.setState(userId, 0);
        const healMsg = wasInjured ? '，重伤已愈，气血与真元已恢复至满' : '';
        if (exp >= userGetExpMax) {
            await srv.addExp(userId, userGetExpMax);
            await srv.updatePower(userId);
            await srv.resetState(userId);
            return `闭关结束，本次闭关到达上限，共增加修为：${userGetExpMax}${healMsg}`;
        }
        if (useStone) {
            const stone = await srv.getStoneForUser(userId, player.platform);
            if (exp <= stone) {
                await srv.costStoneForUser(userId, Math.floor(exp / 2), player.platform);
                exp = exp * 2;
                await srv.addExp(userId, exp);
            }
            else {
                await srv.costStoneForUser(userId, stone, player.platform);
                exp = exp + stone;
                await srv.addExp(userId, exp);
            }
            await srv.updatePower(userId);
            await srv.resetState(userId);
            return `闭关结束，共闭关${expTime}分钟，本次闭关增加修为：${exp}${healMsg}`;
        }
        await srv.addExp(userId, exp);
        await srv.updatePower(userId);
        await srv.resetState(userId);
        return `闭关结束，共闭关${expTime}分钟，本次闭关增加修为：${exp}${healMsg}`;
    }
    // 灵石修炼
    ctx.command('xiuxian/灵石修炼 <amount:integer>', '消耗灵石直接转化修为')
        .alias('灵石修仙')
        .action(async ({ session }, amount) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!amount || amount <= 0) {
            return `请输入正确的灵石数量。\n${stoneCultivateUsage()}`;
        }
        const pf = session.platform;
        const stone = await srv.getStoneForUser(userId, pf);
        if (amount > stone)
            return stoneCultivateInsufficient(amount, stone);
        const maxExp = srv.data.closingMaxExp(player.level, config.closingExpUpperLimit);
        const userGetExpMax = Math.max(Math.floor(maxExp) - player.exp, 0);
        const exp = Math.floor(amount / STONE_CULTIVATE_RATIO);
        if (exp <= 0) {
            return [
                `灵石数量过少，至少需要 ${STONE_CULTIVATE_RATIO} 灵石方可修炼。`,
                `当前输入：${amount}，当前灵石：${(0, utils_1.numberTo)(stone)}枚`,
                stoneCultivateUsage(),
            ].join('\n');
        }
        if (exp >= userGetExpMax) {
            const cost = userGetExpMax * STONE_CULTIVATE_RATIO;
            if (cost > stone)
                return stoneCultivateInsufficient(cost, stone);
            await srv.addExp(userId, userGetExpMax);
            await srv.costStoneForUser(userId, cost, pf);
            await srv.updatePower(userId);
            return `修炼结束，本次修炼到达上限，共增加修为：${userGetExpMax}，消耗灵石：${cost}`;
        }
        await srv.addExp(userId, exp);
        await srv.costStoneForUser(userId, amount, pf);
        await srv.updatePower(userId);
        return `修炼结束，本次修炼共增加修为：${exp}，消耗灵石：${amount}`;
    });
    // 双修
    ctx.command('xiuxian/双修', '与道侣一同修炼（需 @ 对方）')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const targetId = (0, helpers_1.getAtId)(session);
        if (!targetId)
            return '请 @ 你的道侣，与其一起双修！';
        if (targetId === session.userId)
            return '道友无法与自己双修！';
        const target = await srv.getPlayer(targetId);
        if (!target)
            return '修仙者应一心向道，务要留恋凡人！';
        if (target.exp > player.exp)
            return '修仙大能看了看你，不屑一顾，扬长而去！';
        if (getTwoExpCount(player.userId) >= TWO_EXP_LIMIT)
            return '道友今天双修次数已经到达上限！';
        if (getTwoExpCount(target.userId) >= TWO_EXP_LIMIT)
            return '对方今天双修次数已经到达上限！';
        const gain = (p) => {
            const maxExp = srv.data.closingMaxExp(p.level, config.closingExpUpperLimit);
            const room = Math.max(Math.floor(maxExp) - p.exp, 0);
            const exp = Math.floor((player.exp + target.exp) * 0.0055);
            return Math.min(exp, room);
        };
        const g1 = gain(player);
        const g2 = gain(target);
        await srv.addExp(player.userId, g1);
        await srv.addExp(target.userId, g2);
        await srv.updatePower(player.userId);
        await srv.updatePower(target.userId);
        addTwoExpCount(player.userId);
        addTwoExpCount(target.userId);
        let msg = `${player.userName}与${target.userName}情投意合，于某地一起修炼了一晚。${player.userName}增加修为${g1}。${target.userName}增加修为${g2}。`;
        if ([13, 14, 52, 10, 66].includes((0, utils_1.randInt)(1, 100))) {
            await srv.setLevelRate(player.userId, player.levelUpRate + 2);
            await srv.setLevelRate(target.userId, target.levelUpRate + 2);
            msg += '离开时双方互相留法宝为对方护道，双方各增加突破概率2%。';
        }
        return msg;
    });
    // 我的双修次数
    ctx.command('xiuxian/我的双修次数', '查看剩余双修次数')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        return `道友今日剩余双修次数：${Math.max(TWO_EXP_LIMIT - getTwoExpCount(player.userId), 0)}`;
    });
    // 抑制黑暗动乱（去浮点）
    ctx.command('xiuxian/抑制黑暗动乱', '清除修为小数部分')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        await ctx.database.set('xiuxian_player', { userId: session.userId }, { exp: Math.floor(player.exp) });
        return '黑暗动乱已被抑制，修为已取整。';
    });
    function stateMsg(type) {
        if (type === 1)
            return '道友现在在闭关呢，小心走火入魔！';
        if (type === 2)
            return '道友现在在做悬赏令呢，小心走火入魔！';
        if (type === 3)
            return '道友现在正在秘境中，分身乏术！';
        return '道友现在什么都没干呢~';
    }
}
//# sourceMappingURL=cultivate.js.map