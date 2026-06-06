import { Context } from 'koishi';
import { Config } from './config';
export declare const name = "huaji-xiuxian";
export declare const inject: string[];
export { Config };
export declare const usage = "\n## huaji-xiuxian\n\n\u7FA4\u804A\u4FEE\u4ED9\u6A21\u62DF\u5668\uFF0C\u7531 [nonebot-plugin-xiuxian-2](https://github.com/luolianxiyou/nonebot-plugin-xiuxian-2) \u79FB\u690D\u91CD\u6784\u800C\u6765\u3002\n\n\u7075\u77F3\u7ECF\u6D4E\u901A\u8FC7 [monetary](/market?keyword=monetary) \u670D\u52A1\u5B9E\u73B0\uFF0C\u8BF7\u786E\u4FDD\u5DF2\u5B89\u88C5\u5E76\u542F\u7528 `database` \u4E0E `monetary` \u670D\u52A1\u3002\n\n\u53D1\u9001 **\u6211\u8981\u4FEE\u4ED9** \u52A0\u5165\u4FEE\u4ED9\u4E16\u754C\uFF0C\u53D1\u9001 **\u4FEE\u4ED9\u5E2E\u52A9** \u67E5\u770B\u6307\u4EE4\u5217\u8868\u3002\n";
export declare function apply(ctx: Context, config: Config): void;
