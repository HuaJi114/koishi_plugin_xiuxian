"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const koishi_1 = require("koishi");
exports.Config = koishi_1.Schema.intersect([
    koishi_1.Schema.object({
        currency: koishi_1.Schema.string().default('default').description('灵石所使用的 monetary 货币种类标识。'),
        groupOnly: koishi_1.Schema.boolean().default(true).description('是否仅在群聊（非私聊）中响应指令。'),
        adminQQ: koishi_1.Schema.array(String).role('table').default([]).description('管理员 QQ 号列表。填写后自动将对应用户的 Koishi authority 设为 999，可执行需 authority 999 的管理指令。'),
        globalCommandCd: koishi_1.Schema.number().default(0).description('全局指令调用冷却（秒），0 表示关闭。'),
    }).description('基础设置'),
    koishi_1.Schema.object({
        signInLingShiLowerLimit: koishi_1.Schema.number().default(200000).description('每日签到灵石下限。'),
        signInLingShiUpperLimit: koishi_1.Schema.number().default(500000).description('每日签到灵石上限。'),
        closingExp: koishi_1.Schema.number().default(30).description('闭关每分钟获取的修为。'),
        closingExpUpperLimit: koishi_1.Schema.number().role('').default(1.5).description('闭关获取修为上限（下个境界所需修为的倍数）。'),
        userInfoCd: koishi_1.Schema.number().default(60).description('我的存档冷却时间（秒）。'),
    }).description('修炼与签到'),
    koishi_1.Schema.object({
        levelUpCd: koishi_1.Schema.number().default(60).description('突破冷却时间（分钟）。'),
        levelPunishmentFloor: koishi_1.Schema.number().default(1).description('突破失败扣除修为惩罚下限（百分比）。'),
        levelPunishmentLimit: koishi_1.Schema.number().default(10).description('突破失败扣除修为惩罚上限（百分比）。'),
        levelUpProbability: koishi_1.Schema.number().role('').default(0.3).description('突破失败时增加突破概率的比例。'),
    }).description('突破设置'),
    koishi_1.Schema.object({
        remakeCost: koishi_1.Schema.number().default(100000).description('重入仙途（洗灵根）的消费。'),
        giveStoneTax: koishi_1.Schema.number().role('').default(0.1).description('赠送灵石的手续费比例。'),
        stealCost: koishi_1.Schema.number().default(1000000).description('偷灵石失败的赔偿。'),
        stealCd: koishi_1.Schema.number().default(600).description('偷灵石冷却时间（秒）。'),
        stealLowerLimit: koishi_1.Schema.number().role('').default(0.01).description('偷灵石获取下限（百分比）。'),
        stealUpperLimit: koishi_1.Schema.number().role('').default(0.2).description('偷灵石获取上限（百分比）。'),
        robCd: koishi_1.Schema.number().default(600).description('抢劫冷却时间（秒）。'),
    }).description('灵石互动'),
    koishi_1.Schema.object({
        sectMinLevel: koishi_1.Schema.string().default('铭纹境圆满').description('创建宗门所需最低境界。'),
        sectCreateCost: koishi_1.Schema.number().default(5000000).description('创建宗门的消费。'),
    }).description('宗门设置'),
]);
//# sourceMappingURL=config.js.map