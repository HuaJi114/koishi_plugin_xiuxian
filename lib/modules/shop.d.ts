import { Context } from 'koishi';
import { Config } from '../config';
import { XiuxianShopItem } from '../types';
declare module 'koishi' {
    interface Tables {
        xiuxian_shop: XiuxianShopItem;
    }
}
/** 坊市模块（按群独立） */
export declare function applyShop(ctx: Context, config: Config): void;
//# sourceMappingURL=shop.d.ts.map