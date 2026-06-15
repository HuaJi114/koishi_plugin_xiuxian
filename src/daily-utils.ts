import { shanghaiTodayStr } from './timezone'

/** 上海时区日期 YYYY-MM-DD（用于每日重置与签到） */
export function todayStr(d = new Date()): string {
  return shanghaiTodayStr(d)
}

export const META_LAST_DAILY_RESET = 'last_daily_reset_date'

export const RIFT_DAILY_LIMIT = 3
export const WORK_REFRESH_DAILY_LIMIT = 3
