"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_AUTHORITY = void 0;
exports.ensureAdminAuthority = ensureAdminAuthority;
exports.syncAllAdminAuthority = syncAllAdminAuthority;
exports.getAtId = getAtId;
exports.breakthrough = breakthrough;
const koishi_1 = require("koishi");
/** 管理指令所需的 Koishi authority 等级 */
exports.ADMIN_AUTHORITY = 999;
/** 将指定平台用户提升为管理员 authority（若 binding 已存在） */
async function ensureAdminAuthority(ctx, platform, userId) {
    const user = await ctx.database.getUser(platform, userId, ['authority']);
    if (!user || user.authority === exports.ADMIN_AUTHORITY)
        return;
    await ctx.database.setUser(platform, userId, { authority: exports.ADMIN_AUTHORITY });
}
/** 插件启动时，为配置的管理员 QQ 同步 authority 等级 */
async function syncAllAdminAuthority(ctx, config) {
    for (const qq of config.adminQQ) {
        const bindings = await ctx.database.get('binding', { pid: qq }, ['platform']);
        for (const binding of bindings) {
            await ensureAdminAuthority(ctx, binding.platform, qq);
        }
    }
}
/** 解析消息中第一个被 @ 的用户平台 ID */
function getAtId(session) {
    const at = koishi_1.h.select(session.elements ?? [], 'at')[0];
    return at?.attrs.id;
}
/**
 * 突破判定，对应原 OtherSet.get_type。
 * @param exp 当前修为
 * @param rate 突破成功率（含失败加成）
 * @param level 当前境界
 */
function breakthrough(data, exp, rate, level) {
    const nextLevel = data.getNextLevel(level);
    if (!nextLevel)
        return { type: 'top' };
    const needExp = data.getLevelPower(nextLevel);
    if (exp < needExp)
        return { type: 'lack', needExp: needExp - exp, nextLevel };
    const success = Math.floor(Math.random() * 101) < rate;
    return success ? { type: 'success', nextLevel } : { type: 'fail' };
}
//# sourceMappingURL=helpers.js.map