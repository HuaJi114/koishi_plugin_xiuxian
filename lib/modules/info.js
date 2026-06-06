"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyInfo = applyInfo;
const utils_1 = require("../utils");
/** 信息查询模块：我的修仙信息、我的状态、我的功法 */
function applyInfo(ctx, _config) {
    const srv = ctx.xiuxian;
    ctx.command('xiuxian/我的修仙信息', '查看角色存档')
        .alias('我的存档')
        .action(async ({ session }) => {
        const player = await srv.getRealPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const userId = session.userId;
        const base = (await srv.getPlayer(userId));
        const rootRate = srv.data.roots[player.rootType]?.type_speeds ?? 1;
        const realmRate = srv.data.levels[player.level]?.spend ?? 1;
        const stone = await srv.getStoneForUser(userId, session.platform);
        const nextLevel = srv.data.getNextLevel(player.level);
        let expMsg;
        if (!nextLevel) {
            expMsg = '位面至高';
        }
        else {
            const need = srv.data.getLevelPower(nextLevel) - base.exp;
            expMsg = need > 0 ? `还需${(0, utils_1.numberTo)(need)}修为可突破！` : '可突破！';
        }
        const rate = srv.data.getLevelRate(player.level) + player.levelUpRate;
        const buff = await srv.getBuff(userId);
        const mainBuff = srv.data.getItem(buff.mainBuff);
        const secBuff = srv.data.getItem(buff.secBuff);
        const weapon = srv.data.getItem(buff.faqiBuff);
        const armor = srv.data.getItem(buff.armorBuff);
        const itemName = (i) => i ? `${i.name}(${i.level ?? ''})` : '无';
        let sectMsg = '散修';
        if (base.sectId) {
            const sect = await srv.getSectById(base.sectId);
            sectMsg = sect ? sect.sectName : '散修';
        }
        return [
            `${player.userName || '无名氏(发送 改名+道号 更新)'} 道友的信息`,
            `灵根：${player.root}(${player.rootType}+${Math.floor(rootRate * 100)}%)`,
            `境界：${player.level}(境界+${Math.floor(realmRate * 100)}%)`,
            `修为：${(0, utils_1.numberTo)(base.exp)}`,
            `灵石：${(0, utils_1.numberTo)(stone)}`,
            `战力：${(0, utils_1.numberTo)(Math.floor(base.exp * rootRate * realmRate))}`,
            `突破状态：${expMsg}概率：${rate}%`,
            `攻击力：${(0, utils_1.numberTo)(player.atk)}，攻修等级${player.atkPractice}级`,
            `所在宗门：${sectMsg}`,
            `主修功法：${itemName(mainBuff)}`,
            `副修神通：${itemName(secBuff)}`,
            `法器：${itemName(weapon)}`,
            `防具：${itemName(armor)}`,
        ].join('\n');
    });
    ctx.command('xiuxian/我的状态', '查看当前气血与真元')
        .action(async ({ session }) => {
        const userId = session.userId;
        const player = await srv.getRealPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const buff = await srv.getBuff(userId);
        const mainBuff = srv.data.getItem(buff.mainBuff);
        const mainHp = mainBuff?.hpbuff ?? 0;
        const mainMp = mainBuff?.mpbuff ?? 0;
        const { maxHp, maxMp } = (0, utils_1.getEffectiveMaxHpMp)(player.exp, mainHp, mainMp);
        const base = (await srv.getPlayer(userId));
        const lines = [
            `${player.userName} 道友的状态`,
            `气血：${(0, utils_1.numberTo)(player.hp)} / ${(0, utils_1.numberTo)(maxHp)}`,
            `真元：${(0, utils_1.numberTo)(player.mp)} / ${(0, utils_1.numberTo)(maxMp)}`,
            `攻击：${(0, utils_1.numberTo)(player.atk)}`,
        ];
        if ((0, utils_1.isHeavilyInjured)(base.exp, base.hp)) {
            lines.push('当前状态：重伤（需【闭关】并【出关】后恢复满气血与真元）');
        }
        return lines.join('\n');
    });
}
//# sourceMappingURL=info.js.map