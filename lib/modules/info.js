"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyInfo = applyInfo;
const combat_stats_1 = require("../combat-stats");
const skills_1 = require("../skills");
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
            expMsg = need > 0 ? `还需${(0, utils_1.formatAmount)(need)}修为可突破！` : '可突破！';
        }
        const rate = srv.data.getLevelRate(player.level) + player.levelUpRate;
        const buff = await srv.getBuff(userId);
        const skills = await srv.getLearnedSkills(userId);
        const merged = (0, skills_1.mergeSkillBuffs)(skills, srv.data);
        const stats = (0, combat_stats_1.computeCombatStats)(base, buff, srv.data, merged);
        const weapon = srv.data.getItem(buff.faqiBuff);
        const armor = srv.data.getItem(buff.armorBuff);
        const gongfaLines = skills.filter((s) => s.skillType === '功法').map((s) => {
            const info = srv.data.getItem(s.skillId);
            if (!info)
                return null;
            return `  · ${info.name}（${(0, skills_1.formatSkillEffect)(info)}）`;
        }).filter(Boolean);
        const subLines = skills.filter((s) => s.skillType === '辅修功法').map((s) => {
            const info = srv.data.getItem(s.skillId);
            if (!info)
                return null;
            return `  · ${info.name}（${(0, skills_1.formatSkillEffect)(info)}）`;
        }).filter(Boolean);
        const secLines = skills.filter((s) => s.skillType === '神通').map((s) => {
            const info = srv.data.getItem(s.skillId);
            if (!info)
                return null;
            return `  · ${info.name}（${(0, skills_1.formatSkillEffect)(info)}）`;
        }).filter(Boolean);
        let sectMsg = '散修';
        if (base.sectId) {
            const sect = await srv.getSectById(base.sectId);
            sectMsg = sect ? sect.sectName : '散修';
        }
        return [
            `${player.userName || '无名氏(发送 改名+道号 更新)'} 道友的信息`,
            `灵根：${player.root}(${player.rootType}+${Math.floor(rootRate * 100)}%)`,
            `境界：${player.level}(境界+${Math.floor(realmRate * 100)}%)`,
            `修为：${(0, utils_1.formatAmount)(base.exp)}`,
            `灵石：${(0, utils_1.formatAmount)(stone)}`,
            `战力：${(0, utils_1.formatAmount)(Math.floor(base.exp * rootRate * realmRate))}`,
            `突破状态：${expMsg}概率：${rate}%`,
            `攻击力：${(0, utils_1.formatAmount)(player.atk)}（${(0, combat_stats_1.formatAtkBreakdown)(stats)}）`,
            `会心率：${stats.critRate}%${stats.defenseRate > 0 ? `，减伤率：${Math.floor(stats.defenseRate * 100)}%` : ''}`,
            `攻修等级：${player.atkPractice}级`,
            `所在宗门：${sectMsg}`,
            `已学功法（${gongfaLines.length}本）：`,
            ...(gongfaLines.length ? gongfaLines : ['  · 无']),
            `辅修功法（${subLines.length}本）：`,
            ...(subLines.length ? subLines : ['  · 无']),
            `合并功法增益：${(0, skills_1.formatMergedSkillSummary)(merged)}`,
            `已学神通（${secLines.length}本，战斗随机选用）：`,
            ...(secLines.length ? secLines : ['  · 无']),
            `法器：${weapon ? `${weapon.name}(${weapon.level ?? ''})` : '无'}`,
            `防具：${armor ? `${armor.name}(${armor.level ?? ''})` : '无'}`,
        ].join('\n');
    });
    ctx.command('xiuxian/我的状态', '查看当前气血与真元')
        .action(async ({ session }) => {
        const userId = session.userId;
        const player = await srv.getRealPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const buff = await srv.getBuff(userId);
        const skills = await srv.getLearnedSkills(userId);
        const merged = (0, skills_1.mergeSkillBuffs)(skills, srv.data);
        const mainHp = merged.hpbuff;
        const mainMp = merged.mpbuff;
        const { maxHp, maxMp } = (0, utils_1.getEffectiveMaxHpMp)(player.exp, mainHp, mainMp);
        const base = (await srv.getPlayer(userId));
        const stats = (0, combat_stats_1.computeCombatStats)(base, buff, srv.data, merged);
        const lines = [
            `${player.userName} 道友的状态`,
            `气血：${(0, utils_1.formatAmount)(player.hp)} / ${(0, utils_1.formatAmount)(maxHp)}`,
            `真元：${(0, utils_1.formatAmount)(player.mp)} / ${(0, utils_1.formatAmount)(maxMp)}`,
            `攻击：${(0, utils_1.formatAmount)(player.atk)}（${(0, combat_stats_1.formatAtkBreakdown)(stats)}）`,
            `会心率：${stats.critRate}%${stats.defenseRate > 0 ? `，减伤率：${Math.floor(stats.defenseRate * 100)}%` : ''}`,
        ];
        if ((0, utils_1.isHeavilyInjured)(base.exp, base.hp)) {
            lines.push('当前状态：重伤（需【闭关】并【出关】后恢复满气血与真元）');
        }
        return lines.join('\n');
    });
}
//# sourceMappingURL=info.js.map