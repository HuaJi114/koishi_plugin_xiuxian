"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyBoss = applyBoss;
const helpers_1 = require("../helpers");
const combat_stats_1 = require("../combat-stats");
const battle_detail_1 = require("../battle-detail");
const utils_1 = require("../utils");
const BOSS_NAMES = ['金凰儿', '九寒', '莫女', '术方', '卫起', '血枫', '衣以候', '以向'];
/** Boss 属性倍率，对应 bossconfig.Boss倍率 */
const BOSS_RATE = { hp: 100, atk: 0.2 };
const BOSS_LIMIT = 15;
const KILLER_ITEM_TYPES = ['功法', '神通', '丹药', '法器', '防具'];
/** 世界 BOSS 模块：生成、查看、讨伐 */
function applyBoss(ctx, _config) {
    const srv = ctx.xiuxian;
    ctx.model.extend('xiuxian_boss', {
        id: 'unsigned',
        channelId: 'string',
        name: 'string',
        level: 'string',
        hp: 'double',
        maxHp: 'double',
        atk: 'double',
        stone: 'double',
        expReward: 'double',
    }, { primary: 'id', autoInc: true });
    ctx.model.extend('xiuxian_boss_participant', {
        bossId: 'unsigned',
        userId: 'string',
        platform: 'string',
        damage: { type: 'double', initial: 0 },
    }, { primary: ['bossId', 'userId'] });
    function channelOf(session) {
        return session.guildId || session.channelId || 'private';
    }
    async function recordBossDamage(bossId, userId, platform, damage) {
        const [row] = await ctx.database.get('xiuxian_boss_participant', { bossId, userId });
        if (row) {
            await ctx.database.set('xiuxian_boss_participant', { bossId, userId }, {
                damage: row.damage + damage,
                platform,
            });
        }
        else {
            await ctx.database.create('xiuxian_boss_participant', { bossId, userId, platform, damage });
        }
    }
    /** 根据 BOSS 强度计算参与者奖励 */
    function calcParticipantRewards(boss) {
        const strength = Math.max(Math.floor(boss.maxHp / BOSS_RATE.hp), 100);
        return {
            exp: Math.max(Math.floor(strength * 0.025), 20),
            stone: Math.max(Math.floor(strength * 0.012), 10),
        };
    }
    async function distributeBossKillRewards(boss, killerId, killerPlatform) {
        const participants = await ctx.database.get('xiuxian_boss_participant', { bossId: boss.id });
        const { exp, stone } = calcParticipantRewards(boss);
        const rewarded = new Set();
        for (const p of participants) {
            if (rewarded.has(p.userId))
                continue;
            rewarded.add(p.userId);
            const player = await srv.getPlayer(p.userId);
            if (!player)
                continue;
            await srv.addExp(p.userId, exp);
            await srv.gainStoneForUser(p.userId, stone, p.platform || player.platform);
            await srv.updatePower(p.userId);
        }
        // 确保击杀者也在参与奖励名单中
        if (!rewarded.has(killerId)) {
            const killer = await srv.getPlayer(killerId);
            if (killer) {
                await srv.addExp(killerId, exp);
                await srv.gainStoneForUser(killerId, stone, killerPlatform || killer.platform);
                await srv.updatePower(killerId);
                rewarded.add(killerId);
            }
        }
        await ctx.database.remove('xiuxian_boss_participant', { bossId: boss.id });
        const killerPlayer = await srv.getPlayer(killerId);
        const killerLevel = killerPlayer?.level ?? boss.level;
        const itemRank = srv.data.itemRankByLevel(killerLevel);
        const itemLines = [];
        const itemCount = (0, utils_1.randInt)(1, 3);
        function pickKillLoot(preferredType) {
            let id = srv.data.randomItemIdByRank(itemRank, [preferredType]);
            if (id !== 0)
                return id;
            id = srv.data.randomItemIdByRank(itemRank, KILLER_ITEM_TYPES);
            if (id !== 0)
                return id;
            return srv.data.randomItemIdByRank(itemRank);
        }
        for (let i = 0; i < itemCount; i++) {
            const type = (0, utils_1.randChoice)(KILLER_ITEM_TYPES);
            const itemId = pickKillLoot(type);
            if (itemId === 0)
                continue;
            const info = srv.data.getItem(itemId);
            if (!info)
                continue;
            await srv.sendBack(killerId, Number(itemId), info.name, info.item_type ?? type, 1);
            itemLines.push(`${info.level ?? ''}${info.name}`);
        }
        const partCount = rewarded.size;
        let msg = `${boss.name}已被讨伐！${partCount}位参与者各获修为${(0, utils_1.numberTo)(exp)}、灵石${(0, utils_1.numberTo)(stone)}枚。`;
        if (itemLines.length) {
            msg += `\n最后一击由你完成，额外获得战利品：${itemLines.join('、')}`;
        }
        else {
            msg += '\n最后一击由你完成！';
        }
        return msg;
    }
    ctx.command('xiuxian/世界boss帮助', '世界BOSS帮助')
        .action(() => [
        '世界BOSS帮助信息:',
        '1、查看世界boss：查看当前群内的世界BOSS',
        '2、讨伐世界boss [编号]：攻击世界BOSS',
        '3、创建世界boss：【管理】生成一只世界BOSS',
        '提示：BOSS死亡时，所有参与讨伐的道友获得修为与灵石；最后一击者额外获得1~3件装备或丹药。',
    ].join('\n'));
    ctx.command('xiuxian/创建世界boss', '【管理】生成一只世界BOSS', { authority: helpers_1.ADMIN_AUTHORITY })
        .action(async ({ session }) => {
        const channelId = channelOf(session);
        const count = await ctx.database.get('xiuxian_boss', { channelId });
        if (count.length >= BOSS_LIMIT)
            return '本群世界BOSS数量已达上限！';
        const top = await srv.getTopExpPlayer();
        const baseExp = top ? Math.max(top.exp, 1000) : 1000;
        const bossExp = Math.floor(baseExp * (0.8 + Math.random() * 0.6));
        const boss = await ctx.database.create('xiuxian_boss', {
            channelId,
            name: (0, utils_1.randChoice)(BOSS_NAMES),
            level: top?.level ?? '江湖好手',
            hp: bossExp * BOSS_RATE.hp,
            maxHp: bossExp * BOSS_RATE.hp,
            atk: Math.floor(bossExp * BOSS_RATE.atk),
            stone: Math.floor(bossExp * 0.5),
            expReward: Math.floor(bossExp * 0.1),
        });
        return `天降妖魔！世界BOSS【${boss.name}】（编号${boss.id}）现世，气血${(0, utils_1.numberTo)(boss.maxHp)}，攻击${(0, utils_1.numberTo)(boss.atk)}，速速讨伐！`;
    });
    ctx.command('xiuxian/查看世界boss', '查看当前群内的世界BOSS')
        .action(async ({ session }) => {
        const list = await ctx.database.get('xiuxian_boss', { channelId: channelOf(session) });
        if (!list.length)
            return '本群暂无世界BOSS，可由管理员【创建世界boss】。';
        const lines = ['✨当前世界BOSS✨'];
        list.forEach((b) => lines.push(`编号${b.id} ${b.name}（${b.level}） 气血：${(0, utils_1.numberTo)(b.hp)}/${(0, utils_1.numberTo)(b.maxHp)}`));
        return lines.join('\n');
    });
    ctx.command('xiuxian/讨伐世界boss [id:integer]', '讨伐世界BOSS')
        .action(async ({ session }, id) => {
        const userId = session.userId;
        const pf = session.platform;
        const fighter = await (0, combat_stats_1.buildFighter)(srv, userId);
        if (!fighter)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const basePlayer = await srv.getPlayer(userId);
        if (!basePlayer)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        if ((0, utils_1.isHeavilyInjured)(basePlayer.exp, basePlayer.hp))
            return '道友重伤未愈，无法讨伐BOSS！';
        const channelId = channelOf(session);
        const list = await ctx.database.get('xiuxian_boss', { channelId });
        if (!list.length)
            return '本群暂无世界BOSS！';
        const boss = id ? list.find((b) => b.id === id) : list[0];
        if (!boss)
            return '没有这个编号的世界BOSS！';
        const bossFighter = {
            userId: `boss-${boss.id}`,
            name: boss.name,
            hp: Math.max(boss.hp, 1),
            atk: Math.floor(boss.atk),
            mp: 0,
            crit: 1,
            critDamage: 1.5,
            defense: 0,
        };
        fighter.hp = Math.max(basePlayer.hp, 1);
        const [log, victor, finalHp] = (0, utils_1.playerFight)(fighter, bossFighter, srv.data);
        const totalDmg = boss.hp - Math.max(finalHp[bossFighter.userId], 0);
        await recordBossDamage(boss.id, userId, pf, totalDmg);
        (0, battle_detail_1.storeBattleDetail)({
            kind: 'boss',
            userId,
            bossId: boss.id,
            detail: log.join('\n'),
        });
        const playerHp = finalHp[fighter.userId] ?? 0;
        await srv.applyBattleHp(userId, playerHp);
        if (victor === fighter.name) {
            await ctx.database.remove('xiuxian_boss', { id: boss.id });
            const rewardMsg = await distributeBossKillRewards(boss, userId, pf);
            const injury = playerHp <= 0 ? '\n道友气血归零，已进入重伤状态。' : '';
            return `道友历经${Math.ceil(log.length / 2)}回合，成功击杀【${boss.name}】！\n${rewardMsg}${injury}\n${battle_detail_1.BATTLE_DETAIL_HINT}`;
        }
        const bossHpLeft = Math.max(finalHp[bossFighter.userId], 0);
        await ctx.database.set('xiuxian_boss', { id: boss.id }, { hp: bossHpLeft });
        const injury = playerHp <= 0 ? '\n道友气血归零，已进入重伤状态。' : '';
        return `道友与【${boss.name}】激战落败，BOSS剩余气血${(0, utils_1.numberTo)(bossHpLeft)}，道友剩余气血${(0, utils_1.numberTo)(Math.max(playerHp, 0))}。${injury}\n${battle_detail_1.BATTLE_DETAIL_HINT}`;
    });
}
//# sourceMappingURL=boss.js.map