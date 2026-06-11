"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySect = applySect;
const helpers_1 = require("../helpers");
const sect_missions_1 = require("../sect-missions");
const utils_1 = require("../utils");
const combat_stats_1 = require("../combat-stats");
/** 各职位供奉丹药概率（%） */
const SECT_OFFERING_PILL_RATE = [18, 14, 11, 8, 5];
const SECT_OFFERING_OUTER = 150;
const SECT_OFFERING_LEADER = 80000;
/** 外门 150、宗主 80000，中间职位按指数递增 */
function sectOfferingStone(position) {
    const pos = Math.min(Math.max(position, 0), 4);
    if (pos === 4)
        return SECT_OFFERING_OUTER;
    if (pos === 0)
        return SECT_OFFERING_LEADER;
    const ratio = (4 - pos) / 4;
    return Math.floor(SECT_OFFERING_OUTER * Math.pow(SECT_OFFERING_LEADER / SECT_OFFERING_OUTER, ratio));
}
/** 宗门系统模块：创建、加入、退出、捐献、成员、列表等核心玩法 */
function applySect(ctx, config) {
    const srv = ctx.xiuxian;
    ctx.command('xiuxian/宗门帮助', '宗门系统帮助')
        .action(() => [
        '宗门帮助信息:',
        '1、我的宗门 / 宗门信息：查看所处宗门信息',
        `2、创建宗门 <名称>：创建宗门（需 ${config.sectCreateCost} 灵石）`,
        '3、加入宗门 <编号>：加入指定编号的宗门（建号时也可直接回复宗门全名）',
        '4、退出宗门：退出当前宗门',
        '5、宗门捐献 <数量>：提升宗门建设度',
        '6、宗门列表：查看所有宗门',
        '7、宗门成员查看：查看本宗门成员',
        '8、宗门职位变更 <职位> @成员：宗主调整成员职位（0-4）',
        '9、踢出宗门 @成员：宗主移除成员',
        '10、宗主传位 @成员：转让宗主之位',
        '11、升级攻击修炼：提升攻击修炼等级',
        '12、宗门每日供奉：按职位领取每日灵石，小概率获得丹药',
        '13、接取宗门任务：随机接取一项宗门任务（12 小时内仅可完成一次）',
        '14、完成宗门任务：执行已接取任务并与妖兽战斗',
        '15、我的宗门任务：查看当前接取的任务',
    ].join('\n'));
    ctx.command('xiuxian/创建宗门 <name:text>', '创建一个宗门')
        .action(async ({ session }, name) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        name = (name ?? '').trim();
        if (!name)
            return '请输入宗门名称！';
        if (player.sectId)
            return '道友已有宗门，无法创建！';
        // 境界限制（仅当配置的最低境界存在于当前境界表时生效）
        const minIndex = srv.data.getLevelIndex(config.sectMinLevel);
        if (minIndex >= 0 && srv.data.userRank(player.level) > srv.data.userRank(config.sectMinLevel)) {
            return `创建宗门需要境界达到${config.sectMinLevel}！`;
        }
        const pf = session.platform;
        const stone = await srv.getStoneForUser(userId, pf);
        if (stone < config.sectCreateCost)
            return `创建宗门需要${config.sectCreateCost}灵石，道友灵石不足！`;
        if (!(await srv.costStoneForUser(userId, config.sectCreateCost, pf)))
            return '灵石不足！';
        const sect = await srv.createSect(userId, name);
        await ctx.database.set('xiuxian_player', { userId }, { sectId: sect.sectId, sectPosition: 0 });
        return `宗门【${name}】创建成功！宗门编号：${sect.sectId}，道友成为宗主！`;
    });
    ctx.command('xiuxian/我的宗门', '查看所处宗门信息')
        .alias('宗门信息')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId) {
            return '你当前为散修，逍遥天地间。\n发送【宗门列表】查看宗门，或使用【加入宗门 <编号>】加入宗门。';
        }
        const sect = await srv.getSectById(player.sectId);
        if (!sect)
            return '宗门信息异常，你当前按散修处理。请【退出宗门】后重新加入。';
        const members = await srv.getSectMembers(sect.sectId);
        return [
            `宗门名称：${sect.sectName}（编号 ${sect.sectId}）`,
            `建设度：${(0, utils_1.numberTo)(sect.sectScale)}`,
            `可用灵石：${(0, utils_1.numberTo)(sect.sectUsedStone)}`,
            `宗门资材：${(0, utils_1.numberTo)(sect.sectMaterials)}`,
            `成员数量：${members.length}`,
            `道友职位：${srv.data.sectTitle(player.sectPosition)}`,
            `道友贡献：${(0, utils_1.numberTo)(player.sectContribution)}`,
        ].join('\n');
    });
    ctx.command('xiuxian/加入宗门 <target:text>', '加入指定编号或名称的宗门')
        .action(async ({ session }, target) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (player.sectId)
            return '道友已有宗门，请先退出当前宗门！';
        target = (target ?? '').trim();
        if (!target)
            return '请输入宗门编号或宗门全名！';
        const sectId = Number(target);
        if (!Number.isNaN(sectId) && sectId > 0) {
            const sect = await srv.getSectById(sectId);
            if (!sect)
                return '没有这个编号的宗门哦！';
            await ctx.database.set('xiuxian_player', { userId }, { sectId, sectPosition: 4 });
            return `道友成功加入宗门【${sect.sectName}】，成为外门弟子！`;
        }
        return srv.joinSectByName(userId, target);
    });
    ctx.command('xiuxian/退出宗门', '退出当前宗门')
        .action(async ({ session }) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId)
            return '道友尚未加入任何宗门！';
        if (player.sectPosition === 0)
            return '宗主无法直接退出宗门，请先【宗主传位】！';
        await ctx.database.set('xiuxian_player', { userId }, { sectId: 0, sectPosition: 0, sectContribution: 0 });
        return '道友已退出宗门。';
    });
    ctx.command('xiuxian/宗门捐献 <amount:integer>', '向宗门捐献灵石')
        .action(async ({ session }, amount) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId)
            return '道友尚未加入任何宗门！';
        if (!amount || amount <= 0)
            return '请输入正确的捐献数量！';
        if (!(await srv.costStoneForUser(userId, amount, session.platform)))
            return '道友的灵石不足！';
        const sect = (await srv.getSectById(player.sectId));
        await ctx.database.set('xiuxian_sect', { sectId: sect.sectId }, {
            sectUsedStone: sect.sectUsedStone + amount,
            sectScale: sect.sectScale + amount * 10,
        });
        await ctx.database.set('xiuxian_player', { userId }, { sectContribution: player.sectContribution + amount });
        return `道友为宗门捐献了${amount}灵石，宗门建设度提升${amount * 10}！`;
    });
    ctx.command('xiuxian/宗门列表', '查看所有宗门')
        .action(async () => {
        const sects = await srv.sectScaleTop();
        if (!sects.length)
            return '修仙界还没有宗门，道友可以创建一个！';
        const lines = ['✨宗门列表✨'];
        sects.forEach((s) => lines.push(`编号${s.sectId} ${s.sectName} 建设度：${(0, utils_1.numberTo)(s.sectScale)}`));
        return lines.join('\n');
    });
    ctx.command('xiuxian/宗门成员查看', '查看本宗门成员')
        .alias('查看宗门成员')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId)
            return '道友尚未加入任何宗门！';
        const members = await srv.getSectMembers(player.sectId);
        const lines = ['宗门成员：'];
        members
            .sort((a, b) => a.sectPosition - b.sectPosition)
            .forEach((m) => lines.push(`${srv.data.sectTitle(m.sectPosition)}：${m.userName}（贡献 ${(0, utils_1.numberTo)(m.sectContribution)}）`));
        return lines.join('\n');
    });
    ctx.command('xiuxian/宗门职位变更 <position:integer>', '宗主调整成员职位（需 @成员）')
        .action(async ({ session }, position) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId || player.sectPosition !== 0)
            return '只有宗主才能变更职位！';
        const targetId = (0, helpers_1.getAtId)(session);
        if (!targetId)
            return '请 @ 要变更职位的成员！';
        if (position < 1 || position > 4)
            return '职位编号需为 1-4（长老/亲传/内门/外门）！';
        const target = await srv.getPlayer(targetId);
        if (!target || target.sectId !== player.sectId)
            return '对方不是本宗门成员！';
        await ctx.database.set('xiuxian_player', { userId: targetId }, { sectPosition: position });
        return `已将${target.userName}的职位变更为${srv.data.sectTitle(position)}！`;
    });
    ctx.command('xiuxian/踢出宗门', '宗主移除成员（需 @成员）')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId || player.sectPosition !== 0)
            return '只有宗主才能踢人！';
        const targetId = (0, helpers_1.getAtId)(session);
        if (!targetId)
            return '请 @ 要踢出的成员！';
        const target = await srv.getPlayer(targetId);
        if (!target || target.sectId !== player.sectId)
            return '对方不是本宗门成员！';
        if (targetId === session.userId)
            return '宗主无法踢出自己！';
        await ctx.database.set('xiuxian_player', { userId: targetId }, { sectId: 0, sectPosition: 0, sectContribution: 0 });
        return `已将${target.userName}踢出宗门！`;
    });
    ctx.command('xiuxian/宗主传位', '将宗主之位传给成员（需 @成员）')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId || player.sectPosition !== 0)
            return '只有宗主才能传位！';
        const targetId = (0, helpers_1.getAtId)(session);
        if (!targetId)
            return '请 @ 要传位的成员！';
        const target = await srv.getPlayer(targetId);
        if (!target || target.sectId !== player.sectId)
            return '对方不是本宗门成员！';
        await ctx.database.set('xiuxian_player', { userId: targetId }, { sectPosition: 0 });
        await ctx.database.set('xiuxian_player', { userId: session.userId }, { sectPosition: 1 });
        await ctx.database.set('xiuxian_sect', { sectId: player.sectId }, { sectOwner: targetId });
        return `道友已将宗主之位传给${target.userName}，自己成为长老！`;
    });
    ctx.command('xiuxian/升级攻击修炼', '提升攻击修炼等级')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId)
            return '攻击修炼需要加入宗门后进行！';
        const sect = (await srv.getSectById(player.sectId));
        const cap = Math.floor(sect.sectScale / 100000);
        if (player.atkPractice >= cap)
            return `当前宗门建设度仅支持攻击修炼至${cap}级，请提升宗门建设度！`;
        const cost = (player.atkPractice + 1) * 1000000;
        if (!(await srv.costStoneForUser(session.userId, cost, session.platform)))
            return `升级攻击修炼需要${cost}灵石，道友灵石不足！`;
        await ctx.database.set('xiuxian_player', { userId: session.userId }, { atkPractice: player.atkPractice + 1 });
        await srv.updatePower(session.userId);
        return `攻击修炼提升至${player.atkPractice + 1}级，攻击力提升${(player.atkPractice + 1) * 4}%！`;
    });
    ctx.command('xiuxian/宗门每日供奉', '按宗门职位领取每日供奉')
        .action(async ({ session }) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId)
            return '散修无法领取宗门供奉，请先加入宗门。';
        if (player.sectOfferingGet === 1)
            return '今日供奉已领取，请明日0点后再来。';
        const position = Math.min(Math.max(player.sectPosition, 0), 4);
        const stone = sectOfferingStone(position);
        const pf = session.platform;
        await srv.gainStoneForUser(userId, stone, pf);
        await ctx.database.set('xiuxian_player', { userId }, { sectOfferingGet: 1 });
        let msg = `领取${srv.data.sectTitle(position)}供奉，获得灵石${(0, utils_1.numberTo)(stone)}枚。`;
        const pillRate = SECT_OFFERING_PILL_RATE[position] ?? SECT_OFFERING_PILL_RATE[4];
        if ((0, utils_1.randInt)(1, 100) <= pillRate) {
            const itemId = srv.data.randomItemIdByRank(srv.data.itemRankByLevel(player.level), ['丹药']);
            if (itemId !== 0) {
                const info = srv.data.getItem(itemId);
                if (info) {
                    await srv.sendBack(userId, Number(itemId), info.name, info.item_type ?? '丹药', 1);
                    msg += `\n福至心灵，额外获得供奉丹药：${info.level ?? ''}${info.name}！`;
                }
            }
        }
        return msg;
    });
    function sectMissionCdMessage(player) {
        if (!player.sectMissionDoneAt)
            return undefined;
        const elapsed = (0, utils_1.dateDiffSeconds)(new Date(), player.sectMissionDoneAt);
        if (elapsed >= sect_missions_1.SECT_MISSION_CD_SECONDS)
            return undefined;
        const remainHours = Math.floor((sect_missions_1.SECT_MISSION_CD_SECONDS - elapsed) / 3600);
        const remainMins = Math.ceil(((sect_missions_1.SECT_MISSION_CD_SECONDS - elapsed) % 3600) / 60);
        return `宗门任务冷却中，还需${remainHours}小时${remainMins}分钟方可再次接取。`;
    }
    ctx.command('xiuxian/接取宗门任务', '随机接取一项宗门任务')
        .alias('宗门任务接取')
        .action(async ({ session }) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId)
            return '散修无法接取宗门任务，请先加入宗门。';
        if (player.sectMissionId)
            return '道友已有进行中的宗门任务，请发送【完成宗门任务】执行，或【我的宗门任务】查看详情。';
        const cdMsg = sectMissionCdMessage(player);
        if (cdMsg)
            return cdMsg;
        if ((0, utils_1.isHeavilyInjured)(player.exp, player.hp)) {
            return '道友重伤未愈，无法接取宗门任务。请先【闭关】并【出关】恢复后再来。';
        }
        const mission = (0, sect_missions_1.pickRandomMission)();
        await ctx.database.set('xiuxian_player', { userId }, { sectMissionId: mission.id });
        return [
            `已接取宗门任务（编号${mission.id}）：`,
            mission.text,
            '请发送【完成宗门任务】前往执行任务并迎战妖兽。',
            `提示：每位道友完成一次宗门任务后，需等待 ${sect_missions_1.SECT_MISSION_CD_SECONDS / 3600} 小时方可再次接取。`,
        ].join('\n');
    });
    ctx.command('xiuxian/我的宗门任务', '查看当前宗门任务')
        .action(async ({ session }) => {
        const player = await srv.getPlayer(session.userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId)
            return '道友尚未加入任何宗门！';
        if (!player.sectMissionId) {
            const cdMsg = sectMissionCdMessage(player);
            if (cdMsg)
                return `当前没有进行中的宗门任务。\n${cdMsg}\n冷却结束后可发送【接取宗门任务】。`;
            return '当前没有进行中的宗门任务。发送【接取宗门任务】随机接取一项。';
        }
        const mission = (0, sect_missions_1.getMissionById)(player.sectMissionId);
        if (!mission)
            return '任务数据异常，请重新【接取宗门任务】。';
        return [
            `当前宗门任务（编号${mission.id}）：`,
            mission.text,
            '发送【完成宗门任务】执行并迎战妖兽。',
        ].join('\n');
    });
    ctx.command('xiuxian/完成宗门任务', '执行已接取的宗门任务')
        .action(async ({ session }) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if (!player.sectId)
            return '散修无法完成宗门任务，请先加入宗门。';
        if (!player.sectMissionId) {
            return '道友尚未接取宗门任务。发送【接取宗门任务】随机接取，或用【我的宗门任务】查看进度。';
        }
        if ((0, utils_1.isHeavilyInjured)(player.exp, player.hp)) {
            return '道友重伤未愈，无法执行任务。请先【闭关】并【出关】恢复后再来。';
        }
        const mission = (0, sect_missions_1.getMissionById)(player.sectMissionId);
        if (!mission) {
            await ctx.database.set('xiuxian_player', { userId }, { sectMissionId: 0 });
            return '任务数据异常，已重置。请重新【接取宗门任务】。';
        }
        const realPlayer = (await srv.getRealPlayer(userId));
        const basePlayer = player;
        const monsters = (0, sect_missions_1.generateMissionMonsters)(mission, basePlayer.hp, realPlayer.atk);
        const fighter = await (0, combat_stats_1.buildFighter)(srv, userId);
        if (!fighter)
            return '战斗数据异常，请稍后再试！';
        const { log, won, remainingHp, initialMonsterHp } = (0, sect_missions_1.fightMissionMonsters)(fighter, monsters, (a, b) => (0, utils_1.playerFight)(a, b, srv.data));
        await srv.applyBattleHp(userId, remainingHp);
        if (!won) {
            const injuryHint = remainingHp <= 0 ? '\n你气血归零，已进入重伤状态，需【闭关】并【出关】后方可恢复。' : '';
            return [
                `任务执行失败！${mission.text}`,
                ...log.slice(-6),
                `未能击败全部妖兽，可恢复状态后再次发送【完成宗门任务】重试。${injuryHint}`,
            ].join('\n');
        }
        const reward = (0, sect_missions_1.calcMissionReward)(initialMonsterHp);
        const pf = session.platform;
        await srv.gainStoneForUser(userId, reward, pf);
        await ctx.database.set('xiuxian_player', { userId }, {
            sectMissionId: 0,
            sectMissionDoneAt: new Date(),
            sectContribution: player.sectContribution + Math.floor(reward / 100),
        });
        const monsterNames = monsters.map((m) => m.name).join('、');
        return [
            `宗门任务完成！${mission.text}`,
            `共遭遇${monsters.length}只妖兽：${monsterNames}`,
            ...log.slice(-8),
            `任务酬劳：${(0, utils_1.numberTo)(reward)}枚灵石（已发放）`,
            `下次可接取时间：${sect_missions_1.SECT_MISSION_CD_SECONDS / 3600} 小时后。`,
        ].join('\n');
    });
}
//# sourceMappingURL=sect.js.map