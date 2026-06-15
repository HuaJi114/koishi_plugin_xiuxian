"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeSkillBuffs = mergeSkillBuffs;
exports.formatSkillEffect = formatSkillEffect;
exports.formatMergedSkillSummary = formatMergedSkillSummary;
const utils_1 = require("./utils");
function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
function pct(v) {
    return typeof v === 'number' ? `${Math.round(v * 1000) / 10}%` : null;
}
function formatSecSkillDetail(info) {
    const parts = [];
    const st = num(info.skill_type);
    if (st === 1) {
        const av = info.atkvalue;
        const mult = Array.isArray(av) ? av[0] : av;
        parts.push(`直接伤害(攻击×${mult})`);
    }
    else if (st === 2) {
        parts.push(`持续${num(info.turncost) || 1}回合，每回合${(0, utils_1.formatAmount)(Math.floor(num(info.atkvalue) * 100))}%攻击伤害`);
    }
    else if (st === 3) {
        const bv = num(info.buffvalue);
        const bt = num(info.bufftype);
        if (bt === 2)
            parts.push(`减伤提升${(0, utils_1.formatAmount)(Math.floor(bv * 100))}%`);
        else if (bt === 1)
            parts.push(`攻击增益${(0, utils_1.formatAmount)(Math.floor(bv * 100))}%`);
        else
            parts.push(`战斗增益(类型${bt})`);
    }
    if (info.rate !== undefined)
        parts.push(`发动率${info.rate}%`);
    if (info.mpcost)
        parts.push(`消耗真元${pct(info.mpcost)}`);
    if (info.hpcost)
        parts.push(`消耗气血${pct(info.hpcost)}`);
    if (info.turncost !== undefined && st !== 2)
        parts.push(`持续${info.turncost}回合`);
    return parts;
}
/** 数值型功法加成：同属性取最高，不叠加（含辅修功法） */
function mergeSkillBuffs(skills, data) {
    const result = { hpbuff: 0, mpbuff: 0, atkbuff: 0, ratebuff: 0 };
    for (const s of skills) {
        if (s.skillType === '神通')
            continue;
        const info = data.getItem(s.skillId);
        if (!info)
            continue;
        result.hpbuff = Math.max(result.hpbuff, num(info.hpbuff));
        result.mpbuff = Math.max(result.mpbuff, num(info.mpbuff));
        result.atkbuff = Math.max(result.atkbuff, num(info.atkbuff));
        result.ratebuff = Math.max(result.ratebuff, num(info.ratebuff));
    }
    return result;
}
function formatSkillEffect(info) {
    const parts = [];
    const h = pct(info.hpbuff);
    const m = pct(info.mpbuff);
    const a = pct(info.atkbuff);
    const r = pct(info.ratebuff);
    if (h)
        parts.push(`气血+${h}`);
    if (m)
        parts.push(`真元+${m}`);
    if (a)
        parts.push(`攻击+${a}`);
    if (r)
        parts.push(`修炼效率+${r}`);
    if (info.item_type === '神通') {
        parts.push(...formatSecSkillDetail(info));
    }
    return parts.length ? parts.join('，') : info.desc || '无详细效果';
}
function formatMergedSkillSummary(merged) {
    const parts = [];
    const pctFmt = (v) => `${Math.round(v * 1000) / 10}%`;
    if (merged.hpbuff > 0)
        parts.push(`气血+${pctFmt(merged.hpbuff)}`);
    if (merged.mpbuff > 0)
        parts.push(`真元+${pctFmt(merged.mpbuff)}`);
    if (merged.atkbuff > 0)
        parts.push(`攻击+${pctFmt(merged.atkbuff)}`);
    if (merged.ratebuff > 0)
        parts.push(`修炼效率+${pctFmt(merged.ratebuff)}`);
    return parts.length ? parts.join('，') : '无';
}
//# sourceMappingURL=skills.js.map