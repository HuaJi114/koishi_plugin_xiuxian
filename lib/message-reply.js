"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countLines = countLines;
exports.plainTextToMarkdown = plainTextToMarkdown;
exports.formatLongTextReply = formatLongTextReply;
const koishi_1 = require("koishi");
function countLines(text) {
    if (!text)
        return 0;
    return text.split(/\r?\n/).length;
}
/** 纯文本转 Markdown，便于渲染为图片 */
function plainTextToMarkdown(text) {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const lines = escaped.split(/\r?\n/);
    return ['# 修仙', '', ...lines.map((line) => line || '&nbsp;')].join('\n');
}
async function formatLongTextReply(ctx, config, text, session) {
    if (!config.longTextToImage)
        return text;
    if (countLines(text) <= config.longTextLineThreshold)
        return text;
    if (!ctx.markdownToImage?.convertToImage) {
        ctx.logger('huaji-xiuxian').warn('长文本转图已开启但未安装 markdownToImage 服务，已降级为纯文本');
        return text;
    }
    try {
        const markdown = plainTextToMarkdown(text);
        const buffer = await ctx.markdownToImage.convertToImage(markdown);
        return koishi_1.h.image(buffer, 'image/png');
    }
    catch (err) {
        ctx.logger('huaji-xiuxian').warn('长文本转图失败：%s', err.message);
        return text;
    }
}
//# sourceMappingURL=message-reply.js.map