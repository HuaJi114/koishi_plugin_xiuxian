"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyMixElixir = applyMixElixir;
const utils_1 = require("../utils");
/**
 * 炼丹模块（简化移植）。
 * 原插件炼丹需药材+丹方+丹炉，这里实现为消耗灵石与修为凝练一枚随机丹药，
 * 保留"产出丹药入背包"的核心玩法，后续可接入完整丹方系统。
 */
function applyMixElixir(ctx, _config) {
    const srv = ctx.xiuxian;
    ctx.command('xiuxian/炼丹帮助', '炼丹系统帮助')
        .action(() => [
        '炼丹帮助信息:',
        '1、凝丹：消耗灵石与少量修为，凝练一枚随机丹药入背包。',
    ].join('\n'));
    ctx.command('xiuxian/凝丹', '消耗灵石凝练一枚随机丹药')
        .action(async ({ session }) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const rank = srv.data.userRank(player.level);
        const cost = 1000 + rank * 500;
        const pf = session.platform;
        if (!(await srv.costStoneForUser(userId, cost, pf))) {
            return `凝丹需消耗灵石${(0, utils_1.numberTo)(cost)}枚，道友灵石不足！`;
        }
        const elixirIds = Object.keys(srv.data.getItemsByType(['丹药']));
        if (!elixirIds.length) {
            await srv.gainStoneForUser(userId, cost, pf);
            return '丹药谱缺失，无法炼丹！';
        }
        const chosen = (0, utils_1.randChoice)(elixirIds);
        const info = srv.data.getItem(chosen);
        if (!info) {
            await srv.gainStoneForUser(userId, cost, pf);
            return '炼丹失败，丹炉炸裂！';
        }
        await srv.sendBack(userId, Number(chosen), info.name, info.item_type ?? '丹药', 1);
        return `丹成！道友消耗灵石${(0, utils_1.numberTo)(cost)}枚，凝练出一枚【${info.name}】！`;
    });
}
//# sourceMappingURL=mixelixir.js.map