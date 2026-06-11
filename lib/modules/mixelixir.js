"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyMixElixir = applyMixElixir;
const mix_elixir_util_1 = require("../mix-elixir-util");
/** 用户上次炼丹查询到的配方列表 */
const pendingRecipes = new Map();
/** 炼丹模块（对照 nonebot xiuxian_mixelixir） */
function applyMixElixir(ctx, _config) {
    const srv = ctx.xiuxian;
    ctx.command('xiuxian/炼丹帮助', '炼丹系统帮助')
        .action(() => [
        '炼丹帮助信息:',
        '1、炼丹：扫描背包药材，列出可炼制配方',
        '2、炼制 <序号>：按列表序号炼制丹药（需有炼丹炉）',
        '3、炼丹配方帮助：主药+药引需冷热调和，辅药决定丹药类型',
    ].join('\n'));
    ctx.command('xiuxian/炼丹配方帮助', '炼丹配方说明')
        .action(() => [
        '炼丹配方信息:',
        '1、炼丹需要主药、药引、辅药，并持有炼丹炉',
        '2、主药和药引控制冷热调和，失和则无法成丹',
        '3、辅药类型与数量决定产出何种合成丹药',
    ].join('\n'));
    ctx.command('xiuxian/炼丹', '扫描背包并列出可炼制丹方')
        .action(async ({ session }) => {
        const userId = session.userId;
        const player = await srv.getPlayer(userId);
        if (!player)
            return '修仙界没有道友的信息，请输入【我要修仙】加入！';
        const backs = await srv.getBack(userId);
        const hasLdl = backs.some((b) => {
            const t = b.goodsType;
            const info = srv.data.getItem(b.goodsId);
            return t === '炼丹炉' || info?.item_type === '炼丹炉';
        });
        if (!hasLdl)
            return '道友背包内没有炼丹炉，无法炼丹！';
        const yaocaiList = [];
        for (const b of backs) {
            const info = srv.data.getItem(b.goodsId);
            if (!info || info.item_type !== '药材')
                continue;
            yaocaiList.push({ id: b.goodsId, info, num: b.goodsNum });
        }
        if (!yaocaiList.length)
            return '道友背包内没有药材，无法炼丹！';
        const mixItems = srv.data.getItemsByType(['合成丹药']);
        const recipes = (0, mix_elixir_util_1.findMixRecipes)(yaocaiList, mixItems);
        if (!recipes.length)
            return '系统未检测到可用丹方，道友背包内的药材不满足配方或冷热失和！';
        pendingRecipes.set(userId, recipes);
        const lines = ['☆------可炼制丹方------☆'];
        recipes.slice(0, 20).forEach((r, i) => {
            lines.push(`${i + 1}、${r.elixirName}：${r.formulaShort}`);
            lines.push(`   效果：${r.desc}`);
        });
        if (recipes.length > 20)
            lines.push(`（仅显示前20条，共${recipes.length}条）`);
        lines.push('请发送【炼制 <序号>】执行炼制，例如：炼制 1');
        return lines.join('\n');
    });
    ctx.command('xiuxian/炼制 <num:integer>', '按序号炼制丹药')
        .action(async ({ session }, num) => {
        const userId = session.userId;
        if (!num || num < 1)
            return '请输入正确的配方序号！';
        const recipes = pendingRecipes.get(userId);
        if (!recipes?.length)
            return '请先发送【炼丹】查看可用配方！';
        const recipe = recipes[num - 1];
        if (!recipe)
            return '没有这个序号的配方，请重新【炼丹】查看列表！';
        const consume = async (goodsId, need) => {
            const item = await srv.getBackItem(userId, goodsId);
            return !!item && item.goodsNum >= need;
        };
        if (!(await consume(recipe.mainId, recipe.mainNum))) {
            return `药材不足：${recipe.mainName} 需要 ${recipe.mainNum} 个！`;
        }
        if (!(await consume(recipe.yaoyinId, recipe.yaoyinNum))) {
            return `药材不足：${recipe.yaoyinName} 需要 ${recipe.yaoyinNum} 个！`;
        }
        if (!(await consume(recipe.fuyaoId, recipe.fuyaoNum))) {
            return `药材不足：${recipe.fuyaoName} 需要 ${recipe.fuyaoNum} 个！`;
        }
        const mainInfo = srv.data.getItem(recipe.mainId);
        const yyInfo = srv.data.getItem(recipe.yaoyinId);
        if ((0, mix_elixir_util_1.tiaohe)(mainInfo, recipe.mainNum, yyInfo, recipe.yaoyinNum)) {
            return '冷热调和失败！丹炉中灵火暴走，本次炼制未能成丹（药材未消耗）。';
        }
        await srv.reduceBack(userId, recipe.mainId, recipe.mainNum, 0);
        await srv.reduceBack(userId, recipe.yaoyinId, recipe.yaoyinNum, 0);
        await srv.reduceBack(userId, recipe.fuyaoId, recipe.fuyaoNum, 0);
        const elixir = srv.data.getItem(recipe.elixirId);
        await srv.sendBack(userId, recipe.elixirId, elixir.name, elixir.item_type ?? '合成丹药', 1);
        return `丹成！消耗${recipe.formulaShort}，炼制出一枚【${recipe.elixirName}】！`;
    });
}
//# sourceMappingURL=mixelixir.js.map