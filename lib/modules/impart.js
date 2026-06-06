"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyImpart = applyImpart;
const utils_1 = require("../utils");
/**
 * 传承（虚神界）模块（简化移植）。
 * 原插件传承为虚神界永久属性加成系统，这里实现为消耗灵石永久提升"攻击修炼"，
 * 保留"永久强化"的核心玩法。
 */
function applyImpart(ctx, _config) {
    const srv = ctx.xiuxian;
    /** 攻击修炼上限 */
    const MAX_ATK_PRACTICE = 9;
    ctx.command('xiuxian/传承帮助', '传承系统帮助')
        .action(() => [
        '传承帮助信息:',
        '1、参悟传承：消耗灵石永久提升攻击修炼（最高9重），强化战力。',
    ].join('\n'));
    ctx.command('xiuxian/参悟传承', '消耗灵石永久提升攻击修炼')
        .action(async ({ session }) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (player.atkPractice >= MAX_ATK_PRACTICE) {
            return `道友的攻击修炼已臻化境（${MAX_ATK_PRACTICE}重），无法再进！`;
        }
        const next = player.atkPractice + 1;
        const cost = next * 50000;
        if (!(await srv.costStoneForUser(userId, cost, session.platform))) {
            return `参悟传承需消耗灵石${(0, utils_1.numberTo)(cost)}枚，道友灵石不足！`;
        }
        await srv.addAtkPractice(userId, 1);
        await srv.updatePower(userId);
        return `道友参悟上古传承，攻击修炼提升至${next}重，战力大涨！`;
    });
}
//# sourceMappingURL=impart.js.map