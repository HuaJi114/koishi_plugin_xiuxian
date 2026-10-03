"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripLeadingSlash = stripLeadingSlash;
exports.applySlashCompat = applySlashCompat;
/**
 * 剥离开头的斜杠：仅当内容以 `/` 开头且不是 `//`（避免误伤 URL 路径）时剥离一个 `/`。
 * 导出便于单测。
 */
function stripLeadingSlash(content) {
    if (typeof content !== 'string' || !content)
        return content;
    if (!content.startsWith('/'))
        return content;
    // `//foo` 视作用户本就输入的内容，不处理
    if (content.startsWith('//'))
        return content;
    return content.slice(1);
}
/**
 * 注册斜杠兼容中间件。
 *
 * 必须在所有指令注册完成**之后**调用（挂在 root 上即可，对所有上下文生效）。
 *
 * @param ctx 插件根上下文
 * @param options 可选：限定生效平台（默认全平台）
 */
function applySlashCompat(ctx, options = {}) {
    const platforms = options.platforms ?? [];
    // 用前置中间件（prepend = true）确保尽早改写 content，
    // 这样后续所有指令解析看到的都是已剥离斜杠的文本。
    ctx.middleware(async (session, next) => {
        if (platforms.length && !platforms.includes(session.platform))
            return next();
        // session.content 类型上可能为 undefined，先兜底再交给纯函数处理
        const original = session.content ?? '';
        const stripped = stripLeadingSlash(original);
        if (stripped !== original) {
            // 直接改写 content：后续中间件与命令解析都会读到新值
            ;
            session.content = stripped;
        }
        return next();
    }, true);
}
//# sourceMappingURL=slash.js.map