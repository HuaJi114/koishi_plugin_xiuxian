import { Context } from 'koishi';
import { Config } from '../config';
import { XiuxianPlot } from '../types';
/**
 * 洞天经营模块（满级/长线玩法 D）：
 * 1. 开辟洞府 —— 消耗灵石开辟个人洞府，自动获得 1 块灵田
 * 2. 灵气升级 —— 消耗灵石提升洞府灵气等级，等级越高闭关修炼加成越高
 * 3. 灵田种植 —— 消耗背包中的 1 份药材，种到第一块空闲灵田（交互选择药材）
 * 4. 灵田收获 —— 成熟后收获，按洞府灵气等级随机获得 2~8 份药材
 * 5. 开垦灵田 —— 花费灵石扩建灵田（第 2 块 100 万，之后每块翻倍，上限 999 块）
 * 6. 洞府信息 / 灵田情况 —— 查看洞府与灵田状态
 */
declare module 'koishi' {
    interface Tables {
        xiuxian_plot: XiuxianPlot;
    }
}
export declare function applyBlessedSpot(ctx: Context, _config: Config): void;
//# sourceMappingURL=blessed-spot.d.ts.map