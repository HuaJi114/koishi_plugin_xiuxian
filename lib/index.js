"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usage = exports.Config = exports.inject = exports.name = void 0;
exports.apply = apply;
const config_1 = require("./config");
Object.defineProperty(exports, "Config", { enumerable: true, get: function () { return config_1.Config; } });
const service_1 = require("./service");
const base_1 = require("./modules/base");
const info_1 = require("./modules/info");
const cultivate_1 = require("./modules/cultivate");
const back_1 = require("./modules/back");
const sect_1 = require("./modules/sect");
const work_1 = require("./modules/work");
const bank_1 = require("./modules/bank");
const boss_1 = require("./modules/boss");
const rift_1 = require("./modules/rift");
const mixelixir_1 = require("./modules/mixelixir");
const impart_1 = require("./modules/impart");
const helpers_1 = require("./helpers");
const daily_reset_1 = require("./daily-reset");
exports.name = 'huaji-xiuxian';
exports.inject = ['database', 'monetary'];
exports.usage = `
## huaji-xiuxian

群聊修仙模拟器，由 [nonebot-plugin-xiuxian-2](https://github.com/luolianxiyou/nonebot-plugin-xiuxian-2) 移植重构而来。

灵石经济通过 [monetary](/market?keyword=monetary) 服务实现，请确保已安装并启用 \`database\` 与 \`monetary\` 服务。

发送 **我要修仙** 加入修仙世界，发送 **修仙帮助** 查看指令列表。
`;
function apply(ctx, config) {
    ctx.plugin(service_1.XiuxianService, config);
    (0, daily_reset_1.setupDailyReset)(ctx);
    // 启动时为已入库的管理员 QQ 同步 authority 999
    ctx.inject(['database', 'xiuxian'], () => {
        (0, helpers_1.syncAllAdminAuthority)(ctx, config).catch((err) => {
            ctx.logger('huaji-xiuxian').warn('同步管理员 authority 失败：%s', err.message);
        });
        ctx.xiuxian.normalizeAllPlayerHpMp().catch((err) => {
            ctx.logger('huaji-xiuxian').warn('气血真元校正失败：%s', err.message);
        });
        ctx.xiuxian.ensureExistingPlayersAsFreelancer().catch((err) => {
            ctx.logger('huaji-xiuxian').warn('已有账号归一散修失败：%s', err.message);
        });
        ctx.xiuxian.normalizeFreelancerState().catch((err) => {
            ctx.logger('huaji-xiuxian').warn('散修状态校验失败：%s', err.message);
        });
        ctx.xiuxian.ensurePresetSects().catch((err) => {
            ctx.logger('huaji-xiuxian').warn('初始化预设宗门失败：%s', err.message);
        });
        ctx.xiuxian.migrateSkillsFromBuff().catch((err) => {
            ctx.logger('huaji-xiuxian').warn('功法数据迁移失败：%s', err.message);
        });
        ctx.xiuxian.ensureDailyResetIfNeeded().catch((err) => {
            ctx.logger('huaji-xiuxian').warn('每日重置校验失败：%s', err.message);
        });
    });
    // 管理员首次发消息时补同步 authority（binding 可能尚未建立）
    ctx.middleware(async (session, next) => {
        const userId = session.userId;
        if (userId && config.adminQQ.includes(userId)) {
            await (0, helpers_1.ensureAdminAuthority)(ctx, session.platform, userId);
        }
        return next();
    });
    ctx.inject(['xiuxian'], (root) => {
        // 群聊限定：通过过滤上下文限定所有指令仅在群聊响应
        const cmdCtx = config.groupOnly ? root.guild() : root;
        cmdCtx.command('xiuxian', '修仙模拟器');
        cmdCtx.command('xiuxian/修仙帮助', '查看修仙指令帮助')
            .action(() => [
            '【huaji-xiuxian 指令帮助】',
            '— 基础：我要修仙 / 修仙签到 / 我的修仙信息 / 我的状态 / 改名 / 重入仙途',
            '— 突破：我的突破概率 / 突破 / 直接突破 / 渡厄突破',
            '— 修炼：闭关 / 出关 / 灵石修炼 / 双修',
            '— 经济：灵石 / 送灵石 / 偷灵石 / 抢劫 / 查看战斗详情 / 排行榜',
            '— 背包：我的背包 / 使用 / 换装 / 查看修仙界物品',
            '— 宗门：宗门帮助 / 宗门每日供奉 / 接取宗门任务 / 完成宗门任务',
            '— 悬赏：悬赏令帮助',
            '— 灵庄：灵庄信息',
            '— 世界BOSS：世界boss帮助',
            '— 秘境：秘境帮助',
            '— 炼丹：炼丹帮助 / 炼丹 / 炼制',
            '— 传承：传承帮助',
        ].join('\n'));
        (0, base_1.applyBase)(cmdCtx, config);
        (0, info_1.applyInfo)(cmdCtx, config);
        (0, cultivate_1.applyCultivate)(cmdCtx, config);
        (0, back_1.applyBack)(cmdCtx, config);
        (0, sect_1.applySect)(cmdCtx, config);
        (0, work_1.applyWork)(cmdCtx, config);
        (0, bank_1.applyBank)(cmdCtx, config);
        (0, boss_1.applyBoss)(cmdCtx, config);
        (0, rift_1.applyRift)(cmdCtx, config);
        (0, mixelixir_1.applyMixElixir)(cmdCtx, config);
        (0, impart_1.applyImpart)(cmdCtx, config);
        root.logger('huaji-xiuxian').info('huaji-xiuxian 插件已加载，发送 我要修仙 开始游戏~');
    });
}
//# sourceMappingURL=index.js.map