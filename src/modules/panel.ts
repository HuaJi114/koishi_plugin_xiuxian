import { Config } from '../config'
import { normalizePlatformId } from '../helpers'

/** 内置默认面板条目（点击后填入聊天框的指令文本） */
export const DEFAULT_PANEL_ENTRIES = [
  '修仙帮助',
  '我要修仙',
  '修仙签到',
  '我的状态',
  '我的修仙信息',
  '我的背包',
  '闭关',
  '突破',
  '排行榜',
  '我的宗门',
  '灵田情况',
  '洞府信息',
]

/** 用于认领/识别本插件所创建面板的 remark 前缀 */
const PANEL_REMARK_PREFIX = 'xiuxian-panel'

/** 单个指令面板最多关联群体数（官方限制单次 20 个 group_openids） */
const MAX_TARGET_GROUPS = 20

/** 单面板最多元素数（官方限制 20） */
const MAX_ITEMS = 20

interface PanelItem {
  name: string
  desc?: string
  type: 'command' | 'link'
  only_admin?: boolean
  link?: string
}

/** 解析配置中的面板条目文本：按行拆分、去空白；为空则用内置默认 */
export function resolvePanelEntries(raw: string | undefined): string[] {
  const lines = (raw ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  return lines.length ? lines.slice(0, MAX_ITEMS) : [...DEFAULT_PANEL_ENTRIES]
}

/** 将指令名列表转为官方 PanelItem 结构（command 类型：name 即点击后填入聊天框的文本） */
export function buildPanelItems(entries: string[]): PanelItem[] {
  return entries.slice(0, MAX_ITEMS).map((name) => ({
    type: 'command',
    name: name.length > 14 ? name.slice(0, 14) : name,
    desc: name.length > 30 ? name.slice(0, 30) : name,
  }))
}

/** 适配器机器人（adapter-qq 的 QQBot）的最小形态：带鉴权的 http 客户端 + getAccessToken */
interface QqBotLike {
  platform: string
  selfId?: string
  config?: { id?: string }
  getAccessToken?: () => Promise<string>
  // satori HTTP 客户端：http(url, config) => Promise<{ data: any }>
  http: (url: string, config?: Record<string, any>) => Promise<{ data: any }>
}

function panelRemarkForChunk(index: number): string {
  return index === 0 ? PANEL_REMARK_PREFIX : `${PANEL_REMARK_PREFIX}-${index + 1}`
}

/** 拉取指定场景全部面板，返回 remark -> panel_id 的映射 */
async function listGroupPanels(bot: QqBotLike): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let cursor = ''
  // 分页拉取（每页最多 50），直到 is_end
  for (let page = 0; page < 20; page++) {
    const res = await bot.http('/v2/panels', {
      method: 'GET',
      params: { scope: 'group', limit: 50, cursor },
    })
    const body = res?.data ?? {}
    const records: any[] = Array.isArray(body.records) ? body.records : []
    for (const rec of records) {
      const remark = rec?.panel?.remark
      if (typeof remark === 'string' && remark.startsWith(PANEL_REMARK_PREFIX) && rec.panel_id) {
        map.set(remark, rec.panel_id)
      }
    }
    if (body.is_end || !body.next_cursor) break
    cursor = body.next_cursor
  }
  return map
}

/**
 * 对单个 adapter-qq 机器人推送/更新指令面板。
 * - 白名单开启：target_type=specific + 白名单群 openid（超过 20 个自动分多个面板）
 * - 白名单关闭：target_type=all（全局所有群）
 * 推送失败抛出错误，由调用方决定是否告警。
 */
export async function pushCommandPanel(bot: QqBotLike, config: Config, logger?: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void }): Promise<void> {
  if (typeof bot.getAccessToken === 'function') {
    await bot.getAccessToken()
  }

  const entries = resolvePanelEntries(config.panelEntries)
  const items = buildPanelItems(entries)

  // 目标群列表：白名单开启且非空 → 这些群；否则全局 all
  let groupOpenids: string[] = []
  let globalAll = false
  if (config.groupWhitelistEnabled) {
    groupOpenids = config.groupWhitelist
      .map((g) => normalizePlatformId(g))
      .filter(Boolean)
    if (groupOpenids.length === 0) {
      logger?.warn?.('指令面板：白名单已开启但列表为空，无可推送的群，跳过。')
      return
    }
  } else {
    globalAll = true
  }

  // 按群数分块（每块最多 MAX_TARGET_GROUPS 个群）
  const chunks: string[][] = globalAll
    ? [[]]
    : Array.from({ length: Math.ceil(groupOpenids.length / MAX_TARGET_GROUPS) }, (_, i) =>
        groupOpenids.slice(i * MAX_TARGET_GROUPS, (i + 1) * MAX_TARGET_GROUPS),
      )

  const existing = await listGroupPanels(bot)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const remark = panelRemarkForChunk(i)
    const target = globalAll
      ? { target_type: 'all' }
      : { target_type: 'specific', group_openids: chunk }
    const body = {
      scope: 'group',
      ...target,
      panel: { items, remark },
    }
    const panelId = existing.get(remark)
    if (panelId) {
      await bot.http(`/v2/panels/${panelId}`, { method: 'PUT', data: body })
      logger?.info?.('指令面板：已更新面板 %s（群数=%d，条目=%d）', panelId, chunk.length, items.length)
    } else {
      const res = await bot.http('/v2/panels', { method: 'POST', data: body })
      logger?.info?.('指令面板：已创建面板 %s（群数=%d，条目=%d）', res?.data?.panel_id, chunk.length, items.length)
    }
  }

  // 清理多余的旧面板（白名单缩减导致分块数变少时）
  for (const [remark, panelId] of existing) {
    const idx = remark === PANEL_REMARK_PREFIX ? 0 : Number(remark.slice(PANEL_REMARK_PREFIX.length + 1)) - 1
    if (idx >= chunks.length || idx < 0 || Number.isNaN(idx)) {
      await bot.http(`/v2/panels/${panelId}`, { method: 'DELETE' })
      logger?.info?.('指令面板：已删除多余旧面板 %s', panelId)
    }
  }
}

/** 遍历一批机器人，对官方 QQ 机器人（adapter-qq）逐个推送面板，返回可读的汇总文本 */
export async function pushAllPanels(bots: QqBotLike[], config: Config, logger: { info?: (...a: any[]) => void; warn?: (...a: any[]) => void }): Promise<string> {
  const qqBots = bots.filter((b) => b && b.platform === 'qq' && typeof b.http === 'function')
  if (qqBots.length === 0) {
    return '未找到已连接的官方 QQ 机器人（adapter-qq），跳过指令面板推送。'
  }
  const lines: string[] = []
  for (const bot of qqBots) {
    try {
      await pushCommandPanel(bot, config, logger)
      lines.push(`已推送指令面板至机器人 ${bot.selfId || bot.config?.id || '(未知)'}。`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.warn?.('指令面板：机器人 %s 推送失败：%s', bot.selfId || bot.config?.id || '', msg)
      lines.push(`机器人 ${bot.selfId || bot.config?.id || '(未知)'} 推送失败：${msg}`)
    }
  }
  return lines.join('\n')
}
