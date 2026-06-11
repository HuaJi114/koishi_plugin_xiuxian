"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyRift = applyRift;
const daily_utils_1 = require("../daily-utils");
const utils_1 = require("../utils");
const RIFT_CD_SECONDS = 60 * 60;
/**
 * 秘境模块：每日 3 次 + 1 小时 CD。
 */
function applyRift(ctx, _config) {
    const srv = ctx.xiuxian;
    ctx.command('xiuxian/秘境帮助', '秘境系统帮助')
        .action(() => [
        '秘境帮助信息:',
        '1、探索秘境：进入秘境随机探索，可能获得灵石、修为或物品，也可能受伤。',
        `2、每位道友每日可探索 ${daily_utils_1.RIFT_DAILY_LIMIT} 次（0 点刷新），每次探索后需等待 ${RIFT_CD_SECONDS / 60} 分钟方可再次探索。`,
    ].join('\n'));
    ctx.command('xiuxian/探索秘境', '进入秘境随机探索')
        .action(async ({ session }) => {
        const userId = session.userId;
        const realPlayer = await srv.getRealPlayer(userId);
        if (!realPlayer)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const basePlayer = (await srv.getPlayer(userId));
        const used = basePlayer.riftDailyCount ?? 0;
        const remain = daily_utils_1.RIFT_DAILY_LIMIT - used;
        if (remain <= 0) {
            return `道友今日探索秘境次数已用尽（${daily_utils_1.RIFT_DAILY_LIMIT}/${daily_utils_1.RIFT_DAILY_LIMIT}），请明日 0 点后再来。`;
        }
        const cd = await srv.getCd(userId);
        if (cd && cd.type !== 0) {
            if (cd.type === 1)
                return '道友正在闭关，无法探索秘境！';
            if (cd.type === 2)
                return '道友正在做悬赏令，无法探索秘境！';
        }
        if (basePlayer.riftCd) {
            const elapsed = (0, utils_1.dateDiffSeconds)(new Date(), basePlayer.riftCd);
            if (elapsed < RIFT_CD_SECONDS) {
                const remainMin = Math.ceil((RIFT_CD_SECONDS - elapsed) / 60);
                return `秘境探索冷却中，还需${remainMin}分钟方可再次探索。（今日剩余${remain - 1 >= 0 ? remain : 0}次，探索成功后消耗1次）`;
            }
        }
        const baseExp = basePlayer.exp;
        let result;
        const roll = (0, utils_1.randInt)(1, 100);
        if (roll <= 40) {
            const stone = (0, utils_1.randInt)(Math.floor(baseExp * 0.05) + 1, Math.floor(baseExp * 0.2) + 100);
            await srv.gainStoneForUser(userId, stone, session.platform);
            result = `${(0, utils_1.randChoice)(['道友在秘境深处发现一处灵石矿脉', '道友击败了守护灵兽'])}，获得灵石${(0, utils_1.numberTo)(stone)}枚！`;
        }
        else if (roll <= 70) {
            const exp = (0, utils_1.randInt)(Math.floor(baseExp * 0.02) + 1, Math.floor(baseExp * 0.1) + 50);
            await srv.addExp(userId, exp);
            await srv.updatePower(userId);
            result = `道友在秘境中参悟了一处古老石刻，修为增加${(0, utils_1.numberTo)(exp)}！`;
        }
        else if (roll <= 90) {
            const item = srv.data.randomItemIdByRank(srv.data.itemRankByLevel(realPlayer.level));
            if (item !== 0) {
                const info = srv.data.getItem(item);
                if (info) {
                    await srv.sendBack(userId, Number(item), info.name, info.item_type ?? '物品', 1);
                    result = `道友在秘境中觅得机缘，获得物品：${info.level ?? ''}${info.name}！`;
                }
                else {
                    result = '道友在秘境中转了一圈，却一无所获。';
                }
            }
            else {
                result = '道友在秘境中转了一圈，却一无所获。';
            }
        }
        else {
            const lost = Math.max(Math.floor(basePlayer.hp * 0.3), 1);
            await srv.setHpMp(userId, Math.max(basePlayer.hp - lost, 0), basePlayer.mp);
            result = `道友在秘境中遭遇强敌，气血损失${(0, utils_1.numberTo)(lost)}，险些殒命！`;
        }
        await ctx.database.set('xiuxian_player', { userId }, {
            riftCd: new Date(),
            riftDailyCount: used + 1,
        });
        const left = daily_utils_1.RIFT_DAILY_LIMIT - (used + 1);
        return `${result}\n（今日剩余探索次数：${left}/${daily_utils_1.RIFT_DAILY_LIMIT}）`;
    });
}
//# sourceMappingURL=rift.js.map