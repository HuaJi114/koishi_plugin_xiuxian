"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BATTLE_DETAIL_HINT = void 0;
exports.storeBattleDetail = storeBattleDetail;
exports.getBattleDetail = getBattleDetail;
const BATTLE_DETAIL_TTL_MS = 120000;
const records = [];
function prune(now = Date.now()) {
    for (let i = records.length - 1; i >= 0; i--) {
        if (records[i].expireAt <= now)
            records.splice(i, 1);
    }
}
function storeBattleDetail(record) {
    prune();
    records.push({ ...record, expireAt: Date.now() + BATTLE_DETAIL_TTL_MS });
}
function getBattleDetail(userId, kind) {
    const now = Date.now();
    prune(now);
    for (let i = records.length - 1; i >= 0; i--) {
        const r = records[i];
        if (r.expireAt <= now)
            continue;
        if (r.userId !== userId)
            continue;
        if (kind && r.kind !== kind)
            continue;
        return r;
    }
    return undefined;
}
exports.BATTLE_DETAIL_HINT = '120秒内可回复【查看战斗详情】查看战斗过程。';
//# sourceMappingURL=battle-detail.js.map