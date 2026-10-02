import { Context } from 'koishi';
import { Config } from '../config';
/**
 * 金银阁判定（纯函数，便于测试）。
 * 三同点(豹子)庄家通杀；4–10 小、11–17 大；押中返回 'win'。
 */
export declare function judgeJinyinge(bet: '大' | '小', d1: number, d2: number, d3: number): 'win' | 'lose' | 'triple';
/**
 * 虚神界对决轮盘判定（纯函数，便于测试）。
 * 6 膛 1 发真弹随机分布；challenger 在奇数膛(1,3,5)开枪、target 在偶数膛(2,4,6)开枪。
 * 返回哪一方「暴毙」（bulletPos 为奇数 → challenger 死，偶数 → target 死）。
 */
export declare function rouletteDies(bulletPos: number): 'challenger' | 'target';
export declare function applyGamble(ctx: Context, config: Config): void;
//# sourceMappingURL=gamble.d.ts.map