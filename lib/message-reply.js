"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.countLines = countLines;
exports.plainTextToMarkdown = plainTextToMarkdown;
exports.formatLongTextReply = formatLongTextReply;
const koishi_1 = require("koishi");
const fs = __importStar(require("fs"));
const nodePath = __importStar(require("path"));
function countLines(text) {
    if (!text)
        return 0;
    return text.split(/\r?\n/).length;
}
// sarasa 字体 base64 缓存（首次渲染时读取，避免每次重建大字符串）
let cachedFontBase64;
/** 读取并缓存插件自带的中文字体（sarasa-mono-sc-regular.ttf），失败返回 null */
function getSarasaBase64() {
    if (cachedFontBase64 !== undefined)
        return cachedFontBase64;
    try {
        const fontPath = nodePath.resolve(__dirname, '../data/xiuxian/font/sarasa-mono-sc-regular.ttf');
        const buf = fs.readFileSync(fontPath);
        cachedFontBase64 = buf.toString('base64');
    }
    catch {
        cachedFontBase64 = null;
    }
    return cachedFontBase64;
}
function escapeHtmlForCard(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/<\/pre>/gi, '&lt;/pre&gt;');
}
/**
 * 将纯文本包装为「白底深字等宽卡」的 Markdown。
 * 借助 markdown-to-image-service 开启的 html:true，注入 <style> 内嵌字体并强制白卡样式，
 * 保证任意环境下中文不乱码、等宽排版、白底可读（不依赖宿主主题/系统字体）。
 */
function plainTextToMarkdown(text) {
    const escaped = escapeHtmlForCard(text);
    const fontB64 = getSarasaBase64();
    const fontFace = fontB64
        ? `@font-face{font-family:'Sarasa';src:url(data:font/ttf;base64,${fontB64}) format('truetype');font-display:swap;}`
        : '';
    const style = `<style>${fontFace}` +
        `html,body{background:#ffffff!important;margin:0!important}` +
        `.markdown-body{background:transparent!important;font-family:'Sarasa',monospace!important;color:#1f2328!important;white-space:pre-wrap!important;word-break:break-all!important;line-height:1.6!important}` +
        `pre{font-family:'Sarasa',monospace!important;white-space:pre-wrap!important;word-break:break-all!important;margin:0!important;color:#1f2328!important}` +
        `</style>`;
    return `${style}\n<pre>${escaped}</pre>`;
}
async function formatLongTextReply(ctx, config, text) {
    if (!config.longTextToImage)
        return text;
    if (countLines(text) <= config.longTextLineThreshold)
        return text;
    if (!ctx.markdownToImage?.convertToImage) {
        ctx.logger('huaji-xiuxian').warn('长文本转图已开启但未安装 markdownToImage 服务（需 koishi-plugin-markdown-to-image-service 及 @koishijs/plugin-puppeteer），已降级为纯文本');
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