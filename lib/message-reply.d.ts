import { Context, h, Session } from 'koishi';
import { Config } from './config';
declare module 'koishi' {
    interface Context {
        markdownToImage?: {
            convertToImage(markdown: string): Promise<Buffer>;
        };
    }
}
export declare function countLines(text: string): number;
/** 纯文本转 Markdown，便于渲染为图片 */
export declare function plainTextToMarkdown(text: string): string;
export declare function formatLongTextReply(ctx: Context, config: Config, text: string, session?: Session): Promise<string | h>;
//# sourceMappingURL=message-reply.d.ts.map