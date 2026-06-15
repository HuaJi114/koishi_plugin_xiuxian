/** 每日重置与签到使用的时区（中国标准时间） */
export const DAILY_RESET_TZ = 'Asia/Shanghai'

type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function shanghaiParts(d: Date): DateParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: DAILY_RESET_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const map: Record<string, string> = {}
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

/** 上海本地日期 YYYY-MM-DD */
export function shanghaiTodayStr(d = new Date()): string {
  const p = shanghaiParts(d)
  const m = String(p.month).padStart(2, '0')
  const day = String(p.day).padStart(2, '0')
  return `${p.year}-${m}-${day}`
}

/** 距离下一个上海 0 点的毫秒数 */
export function msUntilShanghaiMidnight(from = new Date()): number {
  const p = shanghaiParts(from)
  const elapsedSec = p.hour * 3600 + p.minute * 60 + p.second
  const elapsedMs = elapsedSec * 1000 + from.getMilliseconds()
  return Math.max(86400000 - elapsedMs, 1)
}
