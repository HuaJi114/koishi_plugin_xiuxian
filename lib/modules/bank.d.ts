import { Context } from 'koishi';
import { Config } from '../config';
declare module 'koishi' {
    interface Tables {
        xiuxian_bank: XiuxianBank;
    }
}
/** 灵庄存款表 */
export interface XiuxianBank {
    userId: string;
    saveStone: number;
    saveTime: Date;
    bankLevel: number;
}
/** 灵庄（银行）模块：存取灵石、升级会员、结算利息 */
export declare function applyBank(ctx: Context, _config: Config): void;
//# sourceMappingURL=bank.d.ts.map