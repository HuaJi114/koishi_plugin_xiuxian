import { Context, h } from 'koishi';
import { Config } from './config';
declare module 'koishi' {
    interface Context {
        markdownToImage?: {
            convertToImage(markdown: string): Promise<Buffer>;
        };
    }
}
export declare function countLines(text: string): number;
/**
 * 将纯文本包装为「白底深字等宽卡」的 Markdown。
 * 借助 markdown-to-image-service 开启的 html:true，注入 <style> 内嵌字体并强制白卡样式，
 * 保证任意环境下中文不乱码、等宽排版、白底可读（不依赖宿主主题/系统字体）。
 */
export declare function plainTextToMarkdown(text: string): string;
export declare function formatLongTextReply(ctx: Context, config: Config, text: string): Promise<string | h>;
//# sourceMappingURL=message-reply.d.ts.map