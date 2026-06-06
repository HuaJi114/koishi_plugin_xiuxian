import { Context } from 'koishi';
import { Config } from '../config';
declare module 'koishi' {
    interface Tables {
        xiuxian_work: XiuxianWork;
    }
}
/** 悬赏令进行中的任务 */
export interface XiuxianWork {
    userId: string;
    workName: string;
    rate: number;
    award: number;
    time: number;
    itemId: number;
    successMsg: string;
    failMsg: string;
    startTime: Date;
}
/** 悬赏令模块：刷新、接取、结算、终止 */
export declare function applyWork(ctx: Context, _config: Config): void;
