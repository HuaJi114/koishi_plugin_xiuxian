"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORK_REFRESH_DAILY_LIMIT = exports.RIFT_DAILY_LIMIT = exports.META_LAST_DAILY_RESET = void 0;
exports.todayStr = todayStr;
/** 本地日期 YYYY-MM-DD（用于每日重置兜底） */
function todayStr(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
exports.META_LAST_DAILY_RESET = 'last_daily_reset_date';
exports.RIFT_DAILY_LIMIT = 3;
exports.WORK_REFRESH_DAILY_LIMIT = 3;
//# sourceMappingURL=daily-utils.js.map