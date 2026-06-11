/** 本地日期 YYYY-MM-DD（用于每日重置兜底） */
export function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const META_LAST_DAILY_RESET = 'last_daily_reset_date'

export const RIFT_DAILY_LIMIT = 3
export const WORK_REFRESH_DAILY_LIMIT = 3
