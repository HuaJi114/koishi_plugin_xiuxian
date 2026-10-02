import { Config } from '../config';
/** 内置默认面板条目（点击后填入聊天框的指令文本） */
export declare const DEFAULT_PANEL_ENTRIES: string[];
interface PanelItem {
    name: string;
    desc?: string;
    type: 'command' | 'link';
    only_admin?: boolean;
    link?: string;
}
/** 解析配置中的面板条目文本：按行拆分、去空白；为空则用内置默认 */
export declare function resolvePanelEntries(raw: string | undefined): string[];
/** 将指令名列表转为官方 PanelItem 结构（command 类型：name 即点击后填入聊天框的文本） */
export declare function buildPanelItems(entries: string[]): PanelItem[];
/** 适配器机器人（adapter-qq 的 QQBot）的最小形态：带鉴权的 http 客户端 + getAccessToken */
interface QqBotLike {
    platform: string;
    selfId?: string;
    config?: {
        id?: string;
    };
    getAccessToken?: () => Promise<string>;
    http: (url: string, config?: Record<string, any>) => Promise<{
        data: any;
    }>;
}
/**
 * 对单个 adapter-qq 机器人推送/更新指令面板。
 * - 白名单开启：target_type=specific + 白名单群 openid（超过 20 个自动分多个面板）
 * - 白名单关闭：target_type=all（全局所有群）
 * 推送失败抛出错误，由调用方决定是否告警。
 */
export declare function pushCommandPanel(bot: QqBotLike, config: Config, logger?: {
    info?: (...a: any[]) => void;
    warn?: (...a: any[]) => void;
}): Promise<void>;
/** 遍历一批机器人，对官方 QQ 机器人（adapter-qq）逐个推送面板，返回可读的汇总文本 */
export declare function pushAllPanels(bots: QqBotLike[], config: Config, logger: {
    info?: (...a: any[]) => void;
    warn?: (...a: any[]) => void;
}): Promise<string>;
export {};
//# sourceMappingURL=panel.d.ts.map