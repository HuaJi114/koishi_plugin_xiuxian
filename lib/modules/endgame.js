"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyEndgame = applyEndgame;
const utils_1 = require("../utils");
/**
 * 长线目标玩法模块：
 * 1. 宗门贡献兑换 —— 用 sectContribution 兑换灵石/修为/丹药
 * 2. 顿悟事件 —— 高境界玩家可「参悟天机」，随机获得突破概率加成或修为
 * 3. 飞升转世 —— 满级玩家可重置境界换取转世次数与专属称号（满级后持续目标）
 */
// 宗门贡献兑换汇率
const EXCHANGE_STONE_RATE = 10; // 1 贡献 = 10 灵石
const EXCHANGE_EXP_RATE = 1; // 1 贡献 = 1 修为（贡献本身按捐献灵石 1:1 累加，修为更稀缺）
const EXCHANGE_PILL_COST = 1000; // 兑换一枚丹药所需贡献
// 顿悟事件配置
const EPIPHANY_CD_MINUTES = 60; // 顿悟冷却（分钟）
const EPIPHANY_BASE_RATE = 30; // 触发顿悟的基础概率（%）
const EPIPHANY_RATE_BONUS = 2; // 顿悟成功后增加的突破概率（%）
const EPIPHANY_EXP_RATE = 0.05; // 顿悟获得修为比例（当前修为的 5%）
// 飞升转世配置
const ASCEND_MIN_LEVEL = '太乙境圆满'; // 飞升所需最低境界（满级）
function applyEndgame(ctx, config) {
    const srv = ctx.xiuxian;
    ctx.command('xiuxian/宗门贡献兑换 <类型:string> [数量:integer]', '用宗门贡献兑换资源（灵石/修为/丹药）')
        .alias('贡献兑换')
        .action(async ({ session }, type, amount) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId)
            return '散修无宗门贡献，请先加入宗门！';
        type = (type ?? '').trim();
        const contribution = player.sectContribution ?? 0;
        if (contribution <= 0)
            return '道友暂无宗门贡献，可通过【宗门捐献】获取。';
        if (type === '灵石' || type === 'stone') {
            const cnt = amount && amount > 0 ? amount : contribution;
            const need = Math.ceil(cnt);
            if (need > contribution)
                return `贡献不足！当前贡献 ${(0, utils_1.formatAmount)(contribution)}，兑换 ${(0, utils_1.formatAmount)(need)} 需 ${(0, utils_1.formatAmount)(need)} 贡献。`;
            const stone = need * EXCHANGE_STONE_RATE;
            await ctx.database.set('xiuxian_player', { userId }, { sectContribution: contribution - need });
            await srv.gainStoneForUser(userId, stone, session.platform);
            return `兑换成功！消耗 ${(0, utils_1.formatAmount)(need)} 贡献，获得灵石 ${(0, utils_1.formatAmount)(stone)} 枚。`;
        }
        if (type === '修为' || type === 'exp') {
            const cnt = amount && amount > 0 ? amount : contribution;
            const need = Math.ceil(cnt);
            if (need > contribution)
                return `贡献不足！当前贡献 ${(0, utils_1.formatAmount)(contribution)}，兑换 ${(0, utils_1.formatAmount)(need)} 需 ${(0, utils_1.formatAmount)(need)} 贡献。`;
            const exp = need * EXCHANGE_EXP_RATE;
            await ctx.database.set('xiuxian_player', { userId }, { sectContribution: contribution - need });
            await srv.addExp(userId, exp);
            await srv.updatePower(userId);
            return `兑换成功！消耗 ${(0, utils_1.formatAmount)(need)} 贡献，获得修为 ${(0, utils_1.formatAmount)(exp)}。`;
        }
        if (type === '丹药' || type === 'pill') {
            const cnt = amount && amount > 0 ? amount : 1;
            const need = cnt * EXCHANGE_PILL_COST;
            if (need > contribution)
                return `贡献不足！兑换 ${cnt} 枚丹药需 ${(0, utils_1.formatAmount)(need)} 贡献，当前 ${(0, utils_1.formatAmount)(contribution)}。`;
            const itemRank = srv.data.itemRankByLevel(player.level);
            const granted = [];
            for (let i = 0; i < cnt; i++) {
                const itemId = srv.data.randomItemIdByRank(itemRank, ['丹药'], (0, utils_1.luckPoints)(player.rebirth));
                if (itemId === 0)
                    continue;
                const info = srv.data.getItem(itemId);
                if (!info)
                    continue;
                await srv.sendBack(userId, Number(itemId), info.name, '丹药', 1);
                granted.push(info.name);
            }
            await ctx.database.set('xiuxian_player', { userId }, { sectContribution: contribution - need });
            if (!granted.length)
                return '兑换失败：未能开出丹药，贡献已退回。';
            return `兑换成功！消耗 ${(0, utils_1.formatAmount)(need)} 贡献，获得丹药：${granted.join('、')}。`;
        }
        return [
            '宗门贡献兑换用法：',
            '1、宗门贡献兑换 灵石 [数量]：1 贡献 = 10 灵石（不填数量则全部兑换）',
            '2、宗门贡献兑换 修为 [数量]：1 贡献 = 1 修为（不填数量则全部兑换）',
            `3、宗门贡献兑换 丹药 [数量]：每 ${EXCHANGE_PILL_COST} 贡献随机兑换一枚丹药`,
            `道友当前贡献：${(0, utils_1.formatAmount)(contribution)}`,
        ].join('\n');
    });
    ctx.command('xiuxian/参悟天机', '参悟天机，随机触发顿悟（冷却 60 分钟）')
        .alias('顿悟')
        .action(async ({ session }) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        // 顿悟冷却复用突破 CD 字段的判定（不写库，仅提示）
        const cdMsg = checkEpiphanyCd(player.levelUpCd, EPIPHANY_CD_MINUTES);
        if (cdMsg)
            return cdMsg;
        await srv.setLevelCd(userId);
        const rate = EPIPHANY_BASE_RATE + Math.floor(player.levelUpRate / 2) + (0, utils_1.luckBonus)(player.rebirth);
        if ((0, utils_1.randInt)(1, 100) > rate) {
            return `道友枯坐参悟，可惜天机难测，一无所获。下次或有转机。`;
        }
        const expGain = Math.max(Math.floor(player.exp * EPIPHANY_EXP_RATE), 1);
        await srv.addExp(userId, expGain);
        await srv.updatePower(userId);
        const rateBonus = EPIPHANY_RATE_BONUS;
        await srv.setLevelRate(userId, player.levelUpRate + rateBonus);
        return `刹那间灵光乍现，道友竟窥得天机！修为增加 ${(0, utils_1.formatAmount)(expGain)}，突破成功率提升 ${rateBonus}%！`;
    });
    ctx.command('xiuxian/飞升转世', '满级道友可飞升转世，重置境界换取转世次数与专属称号')
        .action(async ({ session }) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (srv.data.getNextLevel(player.level)) {
            return `道友尚未臻至 ${ASCEND_MIN_LEVEL}，无法飞升转世！`;
        }
        // 满级才可飞升
        const rebirth = (player.rebirth ?? 0) + 1;
        await srv.setLevel(userId, '练气境初期');
        await ctx.database.set('xiuxian_player', { userId }, {
            exp: 0,
            rebirth,
            levelUpRate: 0,
            atkPractice: Math.max(player.atkPractice, 0),
        });
        await srv.resetState(userId);
        await srv.updatePower(userId);
        const title = rebirthTitle(rebirth);
        return [
            `道友功德圆满，羽化飞升！`,
            `转世次数：${rebirth}，尊号【${title}】。`,
            `境界已重置为练气境初期，修为归零，但保留了攻击修炼与转世记忆。`,
            `此后道友气运加身：更易参悟天机、突破瓶颈，寻觅机缘时也更能获珍稀之物。`,
        ].join('\n');
    });
    ctx.command('xiuxian/我的转世', '查看转世次数与称号')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const rebirth = player.rebirth ?? 0;
        if (rebirth === 0)
            return '道友尚未转世，转世需臻至满级后飞升。';
        return `道友已转世 ${rebirth} 次，尊号【${rebirthTitle(rebirth)}】。\n气运加身：更易参悟天机、突破瓶颈，寻觅机缘时更易获珍稀之物。`;
    });
    function rebirthTitle(n) {
        const titles = ['转世散仙', '转世地仙', '转世天仙', '转世真君', '转世帝君', '转世圣尊', '转世道祖'];
        return titles[Math.min(n - 1, titles.length - 1)];
    }
    function checkEpiphanyCd(levelUpCd, cdMinutes) {
        if (!levelUpCd || levelUpCd.getTime() <= 0)
            return undefined;
        const diff = Math.floor((Date.now() - levelUpCd.getTime()) / 1000);
        if (diff < cdMinutes * 60) {
            const remain = Math.ceil((cdMinutes * 60 - diff) / 60);
            return `道友方才参悟天机，心神未定，还需 ${remain} 分钟方可再次参悟。`;
        }
        return undefined;
    }
}
//# sourceMappingURL=endgame.js.map