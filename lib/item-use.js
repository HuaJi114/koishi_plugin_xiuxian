"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getItemUseCategory = getItemUseCategory;
exports.useBackItem = useBackItem;
exports.unequipItem = unequipItem;
const utils_1 = require("./utils");
/** 根据物品数据判定使用类别（兼容背包中历史的 goodsType 字段） */
function getItemUseCategory(info, back) {
    const t = info.item_type ?? back?.goodsType ?? info.type ?? '';
    if (t === '法器' || t === '防具' || t === '装备')
        return 'equipment';
    if (t === '功法' || t === '神通' || t === '辅修功法' || t === '技能')
        return 'skill';
    if (t === '丹药' || t === '合成丹药')
        return 'elixir';
    if (t === '聚灵旗')
        return 'jlq';
    return 'other';
}
function goodsRankOf(info) {
    return Number(info.rank ?? 99999);
}
/** 玩家境界是否满足物品最低要求（USERRANK：数值越小境界越高） */
function meetsMinRealm(data, playerLevel, goodsRank) {
    return data.itemRankByLevel(playerLevel) <= goodsRank;
}
function realmName(data, info) {
    return info['境界'] || data.rankToLevelName(goodsRankOf(info));
}
/** 批量使用数量受每日/总耐药性限制 */
function bulkUseCheck(info, useNum, dayNum, allNum) {
    const dayLimit = Number(info.day_num ?? Number.MAX_SAFE_INTEGER);
    const allLimit = Number(info.all_num ?? Number.MAX_SAFE_INTEGER);
    let dayCan = useNum;
    if (dayNum + useNum > dayLimit)
        dayCan = Math.max(dayLimit - dayNum, 0);
    let allCan = useNum;
    if (allNum + useNum > allLimit)
        allCan = Math.max(allLimit - allNum, 0);
    return Math.min(dayCan, allCan, useNum);
}
async function useBackItem(ctx, srv, userId, back, info, useNum = 1) {
    const category = getItemUseCategory(info, back);
    switch (category) {
        case 'equipment':
            return useEquipment(ctx, srv, userId, back, info);
        case 'skill':
            return useSkillBook(srv, userId, back, info);
        case 'elixir':
            return useElixir(srv, userId, back.goodsId, info, useNum);
        case 'jlq':
            return useJulingqi(srv, userId, back.goodsId, info);
        default:
            return `【${info.name}】暂不支持使用，可用于炼丹或坊市交易。`;
    }
}
async function useEquipment(_ctx, srv, userId, back, info) {
    if (back.state === 1)
        return '该装备已被装备，请勿重复装备！';
    const goodsId = back.goodsId;
    const name = info.name;
    const type = info.item_type ?? back.goodsType;
    if (type === '法器') {
        await srv.equipFaqi(userId, goodsId);
        return `成功装备${name}！`;
    }
    if (type === '防具') {
        await srv.equipArmor(userId, goodsId);
        return `成功装备${name}！`;
    }
    if (type === '装备') {
        const isArmor = name.includes('甲') || name.includes('袍') || name.includes('衣');
        if (isArmor)
            await srv.equipArmor(userId, goodsId);
        else
            await srv.equipFaqi(userId, goodsId);
        return `成功装备${name}！`;
    }
    return '无法识别该装备类型！';
}
async function useSkillBook(srv, userId, back, info) {
    const goodsId = back.goodsId;
    const skillType = (info.item_type === '辅修功法' ? '辅修功法'
        : info.item_type === '神通' ? '神通' : '功法');
    if (await srv.hasSkill(userId, goodsId)) {
        return `道友已学会该${skillType}：${info.name}，请勿重复学习！`;
    }
    await srv.learnSkill(userId, goodsId, skillType);
    await srv.reduceBack(userId, goodsId, 1, 0);
    return `恭喜道友学会${skillType}：${info.name}！`;
}
async function useElixir(srv, userId, goodsId, info, useNum) {
    const player = (await srv.getPlayer(userId));
    const data = srv.data;
    const userRank = data.itemRankByLevel(player.level);
    const goodsRank = goodsRankOf(info);
    const name = info.name;
    const buffType = info.buff_type;
    const buff = Number(info.buff ?? 0);
    const realm = realmName(data, info);
    const backItem = await srv.getBackItem(userId, goodsId);
    if (!backItem || backItem.goodsNum < useNum) {
        return `背包内${name}数量不足${useNum}个！`;
    }
    const dayNum = backItem.dayNum ?? 0;
    const allNum = backItem.allNum ?? 0;
    const { maxHp, maxMp } = (0, utils_1.getBaseMaxHpMp)(player.exp);
    const isQishi = player.root === '器师';
    switch (buffType) {
        case 'level_up_rate': {
            if (!meetsMinRealm(data, player.level, goodsRank)) {
                return `丹药：${name}的最低使用境界为${realm}，道友不满足使用条件`;
            }
            if (goodsRank - userRank > 6) {
                return `道友当前境界为：${player.level}，丹药：${name}已不能满足道友，请寻找适合道友的丹药吧！`;
            }
            if (dayNum >= Number(info.day_num ?? Infinity)) {
                return `道友使用的丹药：${name}已经达到每日上限，今日使用已经没效果了哦~`;
            }
            if (allNum >= Number(info.all_num ?? Infinity)) {
                return `道友使用的丹药：${name}已经达到耐药性上限！`;
            }
            const actual = bulkUseCheck(info, useNum, dayNum, allNum);
            if (actual <= 0)
                return `道友使用的丹药：${name}已达到使用上限！`;
            await srv.reduceBack(userId, goodsId, actual, 1);
            await srv.setLevelRate(userId, player.levelUpRate + buff * actual);
            return `道友实际成功使用丹药：${name} ${actual}个，下一次突破的成功概率提高${buff * actual}%！`;
        }
        case 'level_up_big': {
            if (goodsRank !== userRank) {
                return `丹药：${name}的使用境界为${realm}，道友不满足使用条件！`;
            }
            if (allNum >= Number(info.all_num ?? Infinity)) {
                return `道友使用的丹药：${name}已经达到耐药性上限！`;
            }
            const actual = bulkUseCheck(info, useNum, dayNum, allNum);
            if (actual <= 0)
                return `道友使用的丹药：${name}已达到使用上限！`;
            await srv.reduceBack(userId, goodsId, actual, 1);
            await srv.setLevelRate(userId, player.levelUpRate + buff * actual);
            return `道友实际成功使用丹药：${name} ${actual}个，下一次突破的成功概率提高${buff * actual}%！`;
        }
        case 'hp': {
            if (!isQishi && !meetsMinRealm(data, player.level, goodsRank)) {
                return `丹药：${name}的使用境界为${realm}以上，道友不满足使用条件！`;
            }
            if (dayNum >= Number(info.day_num ?? Infinity)) {
                return `道友使用的丹药：${name}已经达到每日上限，今日使用已经没效果了哦~`;
            }
            if (allNum >= Number(info.all_num ?? Infinity)) {
                return `道友使用的丹药：${name}已经达到耐药性上限！`;
            }
            const actual = bulkUseCheck(info, useNum, dayNum, allNum);
            if (actual <= 0)
                return `道友使用的丹药：${name}已达到使用上限！`;
            if (player.hp >= maxHp && player.mp >= maxMp)
                return '道友的状态是满的，用不了哦！';
            const recoverHp = Math.floor(buff * maxHp * actual);
            const recoverMp = Math.floor(buff * maxMp * actual);
            const newHp = Math.min(player.hp + recoverHp, maxHp);
            const newMp = Math.min(player.mp + recoverMp, maxMp);
            const pct = Math.min(Math.floor(buff * 100 * actual), 100);
            await srv.reduceBack(userId, goodsId, actual, 1);
            await srv.setHpMp(userId, newHp, newMp);
            return `道友实际成功使用丹药：${name} ${actual}个，状态恢复了${pct}%！`;
        }
        case 'all': {
            if (!isQishi && !meetsMinRealm(data, player.level, goodsRank)) {
                return `丹药：${name}的使用境界为${realm}以上，道友不满足使用条件！`;
            }
            if (dayNum >= Number(info.day_num ?? Infinity)) {
                return `道友使用的丹药：${name}已经达到每日上限，今日使用已经没效果了哦~`;
            }
            if (allNum >= Number(info.all_num ?? Infinity)) {
                return `道友使用的丹药：${name}已经达到耐药性上限！`;
            }
            if (player.hp >= maxHp && player.mp >= maxMp)
                return '道友的状态是满的，用不了哦！';
            await srv.reduceBack(userId, goodsId, 1, 1);
            await srv.resetState(userId);
            return `道友实际成功使用丹药：${name} 1个，状态已全部恢复！`;
        }
        case 'atk_buff': {
            if (!meetsMinRealm(data, player.level, goodsRank)) {
                return `丹药：${name}的使用境界为${realm}以上，道友不满足使用条件！`;
            }
            if (allNum >= Number(info.all_num ?? Infinity)) {
                return `道友使用的丹药：${name}已经达到耐药性上限！`;
            }
            const actual = bulkUseCheck(info, useNum, dayNum, allNum);
            if (actual <= 0)
                return `道友使用的丹药：${name}已达到使用上限！`;
            const gain = buff * actual;
            await srv.addAtkBuff(userId, gain);
            await srv.reduceBack(userId, goodsId, actual, 1);
            return `道友实际成功使用丹药：${name} ${actual}个，攻击力永久增加${gain}点！`;
        }
        case 'exp_up': {
            if (!meetsMinRealm(data, player.level, goodsRank)) {
                return `丹药：${name}的使用境界为${realm}以上，道友不满足使用条件！`;
            }
            if (allNum >= Number(info.all_num ?? Infinity)) {
                return `道友使用的丹药：${name}已经达到耐药性上限！`;
            }
            const actual = bulkUseCheck(info, useNum, dayNum, allNum);
            if (actual <= 0)
                return `道友使用的丹药：${name}已达到使用上限！`;
            const exp = buff * actual;
            await srv.addExp(userId, exp);
            await srv.updatePower(userId);
            const updated = (await srv.getPlayer(userId));
            const newHp = Math.floor(updated.hp + exp / 2);
            const newMp = Math.floor(updated.mp + exp);
            const newAtk = Math.floor(updated.atk + exp / 10);
            await srv.setHpMp(userId, newHp, newMp);
            await srv.setAtk(userId, newAtk);
            await srv.reduceBack(userId, goodsId, actual, 1);
            return `道友实际成功使用丹药：${name} ${actual}个，修为增加${exp}点！`;
        }
        default:
            return '该类型的丹药目前暂时不支持使用！';
    }
}
async function useJulingqi(srv, userId, goodsId, info) {
    const player = (await srv.getPlayer(userId));
    if (!player.blessedSpotFlag)
        return '道友还未拥有洞天福地，无法使用该物品';
    const buff = await srv.getBuff(userId);
    const speed = Number(info['修炼速度'] ?? 0);
    if (speed <= 0)
        return '聚灵旗数据异常，无法使用！';
    if (buff.blessedSpot >= speed) {
        return '该聚灵旗的等级不能满足道友的福地了，使用了也没效果';
    }
    await srv.setBlessedSpot(userId, speed);
    await srv.reduceBack(userId, goodsId, 1, 0);
    return `道友洞天福地的聚灵旗已经替换为：${info.name}`;
}
async function unequipItem(ctx, srv, userId, back, info) {
    const type = info.item_type ?? back.goodsType;
    if (type !== '法器' && type !== '防具' && type !== '装备') {
        return `请检查该装备 ${info.name} 是否在背包内！`;
    }
    if (back.state !== 1)
        return `【${info.name}】当前未装备！`;
    if (type === '法器' || (type === '装备' && !(info.name.includes('甲') || info.name.includes('袍') || info.name.includes('衣')))) {
        await srv.setFaqiBuff(userId, 0);
    }
    else {
        await srv.setArmorBuff(userId, 0);
    }
    await ctx.database.set('xiuxian_back', { userId, goodsId: back.goodsId }, { state: 0, updateTime: new Date() });
    await srv.updatePower(userId);
    return `成功卸下${info.name}！`;
}
//# sourceMappingURL=item-use.js.map