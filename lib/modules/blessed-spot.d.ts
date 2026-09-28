import { Context } from 'koishi';
import { Config } from '../config';
/**
 * 洞天经营模块（满级/长线玩法 D）：
 * 1. 开辟洞府 —— 消耗灵石开辟个人洞府，获得洞府名称
 * 2. 灵气升级 —— 消耗灵石提升洞府灵气等级，等级越高闭关修炼加成越高
 * 3. 灵田种植 —— 消耗灵石播种药材，成熟后收获入背包
 * 4. 洞府信息 —— 查看洞府灵气、灵田、种植情况
 */
declare module 'koishi' {
    interface Tables {
        xiuxian_blessed: XiuxianBlessed;
    }
}
/** 洞府数据表（种植状态），每名玩家一行 */
export interface XiuxianBlessed {
    userId: string;
    /** 灵田正在种植的药材物品 ID（0 表示空闲） */
    plantId: number;
    /** 灵田播种时间 */
    plantAt: Date;
    /** 灵田成熟所需分钟数 */
    plantMinutes: number;
}
export declare function applyBlessedSpot(ctx: Context, _config: Config): void;
//# sourceMappingURL=blessed-spot.d.ts.map