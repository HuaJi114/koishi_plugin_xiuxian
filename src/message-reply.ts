import { Context, h, Session } from 'koishi'
import { Config } from './config'

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

/** 纯文本转 Markdown，便于渲染为图片 */
export function plainTextToMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const lines = escaped.split(/\r?\n/)
  return ['# 修仙', '', ...lines.map((line) => line || '&nbsp;')].join('\n')
}

export async function formatLongTextReply(
  ctx: Context,
  config: Config,
  text: string,
  session?: Session,
): Promise<string | h> {
  if (!config.longTextToImage) return text
  if (countLines(text) <= config.longTextLineThreshold) return text
  if (!ctx.markdownToImage?.convertToImage) {
    ctx.logger('huaji-xiuxian').warn('长文本转图已开启但未安装 markdownToImage 服务，已降级为纯文本')
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
