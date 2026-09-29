import { Context, h } from 'koishi'
import { Config } from './config'
import * as fs from 'fs'
import * as nodePath from 'path'

declare module 'koishi' {
  interface Context {
    markdownToImage?: {
      convertToImage(markdown: string): Promise<Buffer>
    }
  }
}

export function countLines(text: string): number {
  if (!text) return 0
  return text.split(/\r?\n/).length
}

// sarasa 字体 base64 缓存（首次渲染时读取，避免每次重建大字符串）
let cachedFontBase64: string | null | undefined

/** 读取并缓存插件自带的中文字体（sarasa-mono-sc-regular.ttf），失败返回 null */
function getSarasaBase64(): string | null {
  if (cachedFontBase64 !== undefined) return cachedFontBase64
  try {
    const fontPath = nodePath.resolve(__dirname, '../data/xiuxian/font/sarasa-mono-sc-regular.ttf')
    const buf = fs.readFileSync(fontPath)
    cachedFontBase64 = buf.toString('base64')
  } catch {
    cachedFontBase64 = null
  }
  return cachedFontBase64
}

function escapeHtmlForCard(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/<\/pre>/gi, '&lt;/pre&gt;')
}

/**
 * 将纯文本包装为「白底深字等宽卡」的 Markdown。
 * 借助 markdown-to-image-service 开启的 html:true，注入 <style> 内嵌字体并强制白卡样式，
 * 保证任意环境下中文不乱码、等宽排版、白底可读（不依赖宿主主题/系统字体）。
 */
export function plainTextToMarkdown(text: string): string {
  const escaped = escapeHtmlForCard(text)
  const fontB64 = getSarasaBase64()
  const fontFace = fontB64
    ? `@font-face{font-family:'Sarasa';src:url(data:font/ttf;base64,${fontB64}) format('truetype');font-display:swap;}`
    : ''
  const style =
    `<style>${fontFace}` +
    `html,body{background:#ffffff!important;margin:0!important}` +
    `.markdown-body{background:transparent!important;font-family:'Sarasa',monospace!important;color:#1f2328!important;white-space:pre-wrap!important;word-break:break-all!important;line-height:1.6!important}` +
    `pre{font-family:'Sarasa',monospace!important;white-space:pre-wrap!important;word-break:break-all!important;margin:0!important;color:#1f2328!important}` +
    `</style>`
  return `${style}\n<pre>${escaped}</pre>`
}

export async function formatLongTextReply(
  ctx: Context,
  config: Config,
  text: string,
): Promise<string | h> {
  if (!config.longTextToImage) return text
  if (countLines(text) <= config.longTextLineThreshold) return text
  if (!ctx.markdownToImage?.convertToImage) {
    ctx.logger('huaji-xiuxian').warn('长文本转图已开启但未安装 markdownToImage 服务（需 koishi-plugin-markdown-to-image-service 及 @koishijs/plugin-puppeteer），已降级为纯文本')
    return text
  }
  try {
    const markdown = plainTextToMarkdown(text)
    const buffer = await ctx.markdownToImage.convertToImage(markdown)
    return h.image(buffer, 'image/png')
  } catch (err) {
    ctx.logger('huaji-xiuxian').warn('长文本转图失败：%s', (err as Error).message)
    return text
  }
}
