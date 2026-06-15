"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORK_REFRESH_DAILY_LIMIT = exports.RIFT_DAILY_LIMIT = exports.META_LAST_DAILY_RESET = void 0;
exports.todayStr = todayStr;
const timezone_1 = require("./timezone");
/** 上海时区日期 YYYY-MM-DD（用于每日重置与签到） */
function todayStr(d = new Date()) {
    return (0, timezone_1.shanghaiTodayStr)(d);
}
exports.META_LAST_DAILY_RESET = 'last_daily_reset_date';
exports.RIFT_DAILY_LIMIT = 3;
exports.WORK_REFRESH_DAILY_LIMIT = 3;
//# sourceMappingURL=daily-utils.js.map