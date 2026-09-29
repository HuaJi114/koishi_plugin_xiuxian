"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const koishi_1 = require("koishi");
exports.Config = koishi_1.Schema.intersect([
    koishi_1.Schema.object({
        currency: koishi_1.Schema.string().default('default').description('灵石所使用的 monetary 货币种类标识。'),
        groupOnly: koishi_1.Schema.boolean().default(true).description('是否仅在群聊（非私聊）中响应指令。'),
        adminQQ: koishi_1.Schema.array(String).role('table').default([]).description('管理员 QQ 号列表。填写后自动将对应用户的 Koishi authority 设为 999，可执行需 authority 999 的管理指令。'),
        groupWhitelistEnabled: koishi_1.Schema.boolean().default(false).description('启用群聊白名单：仅白名单内的 QQ 群可游玩本插件，其余群静默忽略（不回复任何消息）。'),
        groupWhitelist: koishi_1.Schema.array(String).role('table').default([]).description('白名单 QQ 群号列表（纯数字，如 123456789）。仅当上方开关开启时生效；列表为空时所有群均不响应。'),
        allowPrivateChat: koishi_1.Schema.boolean().default(false).description('白名单开启时，是否也响应私聊消息（默认关闭，仅响应白名单群）。'),
        userBlacklist: koishi_1.Schema.array(String).role('table').default([]).description('QQ 号黑名单：列表中的用户无论私聊还是群聊，本插件均不响应（无需开启白名单即生效）。'),
        globalCommandCd: koishi_1.Schema.number().default(0).description('全局指令冷却（秒）。同一群内任一玩家触发某指令后，该群所有玩家对该指令进入冷却，0 表示关闭。'),
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
        levelUpProbability: koishi_1.Schema.number().default(2).description('突破失败时固定增加的成功率（百分比），用于失败累计保底，成功突破后清零。'),
    }).description('突破设置'),
    koishi_1.Schema.object({
        remakeCost: koishi_1.Schema.number().default(100000).description('重入仙途（洗灵根）的消费。'),
        giveStoneTax: koishi_1.Schema.number().role('').default(0.1).description('赠送灵石的手续费比例。'),
        stealCost: koishi_1.Schema.number().default(1000000).description('偷灵石失败的赔偿。'),
        stealCd: koishi_1.Schema.number().default(600).description('偷灵石冷却时间（秒）。每次出手（无论成败）后进入冷却。'),
        stealLowerLimit: koishi_1.Schema.number().role('').default(0.01).description('偷灵石获取下限（百分比）。'),
        stealUpperLimit: koishi_1.Schema.number().role('').default(0.2).description('偷灵石获取上限（百分比）。'),
        robCd: koishi_1.Schema.number().default(600).description('抢劫冷却时间（秒）。每次发起决斗后进入冷却。'),
    }).description('灵石互动'),
    koishi_1.Schema.object({
        sectMinLevel: koishi_1.Schema.string().default('铭纹境圆满').description('创建宗门所需最低境界。'),
        sectCreateCost: koishi_1.Schema.number().default(5000000).description('创建宗门的消费。'),
    }).description('宗门设置'),
    koishi_1.Schema.object({
        longTextToImage: koishi_1.Schema.boolean().default(false).description('启用后，超长回复（超过 longTextLineThreshold 行）将转为图片发出。基于 Puppeteer（需安装 koishi-plugin-markdown-to-image-service 及其依赖的 @koishijs/plugin-puppeteer），已内嵌中文字体，白底等宽卡片，无需额外配置字体。'),
        longTextLineThreshold: koishi_1.Schema.number().default(20).description('超过该行数的文本将自动转为图片。'),
        shopServiceCharge: koishi_1.Schema.number().role('').default(0.05).description('坊市成交手续费比例。'),
        shopRestockThreshold: koishi_1.Schema.number().default(5).description('神秘人补货阈值：坊市全部商品数低于该值时，神秘人才会自动上架补货。'),
        shopCapacity: koishi_1.Schema.number().default(30).description('坊市容量上限：商品总数达到该值后禁止任何上架（含玩家与系统）。'),
        shopExpireHours: koishi_1.Schema.number().default(72).description('坊市物品过期小时数：超过该时长无人购买将自动下架（玩家物品发回背包）。'),
    }).description('消息与坊市'),
]);
//# sourceMappingURL=config.js.map