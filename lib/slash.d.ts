import { Context } from 'koishi';
/**
 * 斜杠指令适配（QQ 官方机器人「指令面板 / 命令菜单」兼容）。
 *
 * 背景：QQ 官方机器人的「指令面板」在用户点击后，会把命令填成
 * **`/命令名`**（例如 `/修仙帮助`），但**不会**给机器人追加 @，也不会把 `/`
 * 从内容里去掉。若 Koishi 全局 `prefix` 没配 `/`，这些消息会因为命令名不匹配
 * 而**完全无响应**（用户点了面板却毫无反应）。
 *
 * 方案选型（三种，逐一实测后选定本实现）：
 * 1. ❌ **给每条命令挂 `/名` 别名**（meme 插件的做法）：需要包装 `ctx.command`。
 *    实测在本项目会**破坏 adminCtx 上的管理指令派发**——因为
 *    `ctx.command` 被临时替换期间，playCtx / adminCtx 派生上下文的命令注册
 *    链断裂，导致管理指令（重置状态/群组信息等）注册了却收不到消息。
 *    本项目 playCtx/adminCtx 是 `root.guild().intersect(...)` 等派生上下文，对包装敏感。
 * 2. ❌ **注册后遍历命令表补别名**：`ctx.commands` 并非 Koishi 公开 API，
 *    不同版本取不到，遍历不可靠。
 * 3. ✅ **前置中间件剥离开头的 `/`**（本实现）：在命令解析之前，
 *    把 `/修仙帮助` 改写成 `修仙帮助`，让 Koishi 按原有的无前缀命令正常匹配。
 *    **完全不触碰 `ctx.command`**，对 playCtx / adminCtx / 任何派生上下文零副作用，
 *    且自动对**所有**已注册命令（含未来新增的、含链式 `.alias()`）生效。
 *
 * 行为：
 * - `/修仙帮助` → `修仙帮助`（QQ 指令面板点击后的形式，可用）
 * - `修仙帮助` → 原样（手动 @ 机器人时可用，行为不变）
 * - `/灵庄存灵石 1000` → `灵庄存灵石 1000`（带参数亦可）
 * - 其他平台（OneBot / Napcat）若本就没有 `/` 前缀，不触发剥离，行为不变
 */
/** 判定是否需要剥离的会话平台；空数组表示对所有平台生效 */
export interface SlashOptions {
    /**
     * 仅对这些平台生效（取 `session.platform`）。
     * 默认 `[]` = **对所有平台生效**——因为剥离单个开头 `/` 是幂等且安全的：
     * 原本就以斜杠开头的消息在 QQ 面板场景下本就无法被识别，剥掉反而是修复；
     * 其他平台若未来出现同样的面板行为也能自动兜住。
     */
    platforms?: string[];
}
/**
 * 剥离开头的斜杠：仅当内容以 `/` 开头且不是 `//`（避免误伤 URL 路径）时剥离一个 `/`。
 * 导出便于单测。
 */
export declare function stripLeadingSlash(content: string): string;
/**
 * 注册斜杠兼容中间件。
 *
 * 必须在所有指令注册完成**之后**调用（挂在 root 上即可，对所有上下文生效）。
 *
 * @param ctx 插件根上下文
 * @param options 可选：限定生效平台（默认全平台）
 */
export declare function applySlashCompat(ctx: Context, options?: SlashOptions): void;
//# sourceMappingURL=slash.d.ts.map