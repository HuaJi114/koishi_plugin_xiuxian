# koishi-plugin-huaji-xiuxian

[![npm](https://img.shields.io/npm/v/koishi-plugin-huaji-xiuxian?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-huaji-xiuxian)

群聊修仙模拟器 —— 由 [nonebot-plugin-xiuxian-2](https://github.com/QingMuCat/nonebot_plugin_xiuxian_2) 完整移植、重构而来的 Koishi v4 插件。

修炼、境界、灵根、宗门、世界 BOSS、悬赏令、炼丹、秘境、传承……在群聊中开启你的修仙之旅。

## 特性

- **标准 Koishi 生态**：使用 `ctx.command` 注册指令、`ctx.model` 持久化数据、`Service` 提供核心服务，支持多平台适配器。
- **灵石经济基于 monetary**：所有灵石（货币）操作通过 [`koishi-plugin-monetary`](https://www.npmjs.com/package/koishi-plugin-monetary) 服务实现，**不内置任何货币逻辑**。
- **TypeScript 严格模式**：全量类型注解，模块化拆分，易于维护扩展。
- **可视化配置**：修炼速度、境界惩罚、签到灵石、各类冷却等均可在控制台 Schema 中调整。

## 依赖

本插件依赖以下服务，请在 Koishi 中一并安装并启用：

- `database`（任意数据库实现，如 `@koishijs/plugin-database-sqlite`）
- `monetary`（`koishi-plugin-monetary`）

## 安装

在 Koishi 插件市场搜索 `huaji-xiuxian` 安装，或在工作区中本地安装后启用。

## 快速开始

1. 安装并启用 `database`、`monetary` 与本插件。
2. 在群聊中发送 **我要修仙** 创建角色。
3. 发送 **修仙帮助** 查看完整指令列表。

## 指令一览

| 分类 | 指令 |
| --- | --- |
| 基础 | `我要修仙` `修仙签到` `我的修仙信息` `我的状态` `改名` `重入仙途` |
| 突破 | `我的突破概率` `突破` `直接突破` `渡厄突破` |
| 修炼 | `闭关` `出关` `灵石修炼` `双修` |
| 经济 | `灵石` `送灵石` `偷灵石` `抢劫` `排行榜` |
| 背包 | `我的背包` `使用` `换装` `查看修仙界物品` |
| 宗门 | `宗门帮助` 等系列指令 |
| 悬赏令 | `悬赏令帮助` 等系列指令 |
| 灵庄 | `灵庄信息` 等系列指令 |
| 世界 BOSS | `世界boss帮助` `查看世界boss` `讨伐世界boss` |
| 秘境 | `秘境帮助` `探索秘境` |
| 炼丹 | `炼丹帮助` `凝丹` |
| 传承 | `传承帮助` `参悟传承` |

## 变更说明（移植 / 重构记录）

### 主要移植内容

- **用户与角色系统**：玩家信息、灵根生成、境界进阶、属性（气血 / 真元 / 攻击）等完整移植。
- **修炼系统**：闭关、出关、灵石修炼、双修（含每日次数限制）。
- **突破系统**：普通突破、直接突破、渡厄突破，突破概率读取 `突破概率.json`。
- **经济系统**：灵石通过 monetary 服务管理，含送 / 偷 / 抢劫等交互。
- **背包与物品**：装备、功法、丹药的使用与换装，物品图鉴查询。
- **宗门系统**：创建 / 加入 / 退出 / 捐献 / 职位变更 / 传位 / 攻击修炼等。
- **悬赏令系统**：刷新 / 接取 / 结算 / 终止，奖励与成功率按境界计算。
- **灵庄（银行）**：存取灵石、会员升级、利息结算。
- **世界 BOSS**：生成 / 查看 / 讨伐与战利品掉落。
- **排行榜**：战力与修为榜单。

### 重构点

- 将 NoneBot 的事件 / 指令体系全面替换为 Koishi 的 `ctx.command` 与服务注入。
- 原 SQLite 直连改为 Koishi `ctx.model` 表定义（`xiuxian_player` / `xiuxian_cd` / `xiuxian_sect` / `xiuxian_back` / `xiuxian_buff` / `xiuxian_bank` / `xiuxian_work` / `xiuxian_boss`）。
- 灵石由插件自管改为通过 `monetary` 服务（平台 `userId` ↔ Koishi `uid` 映射）。
- 所有静态数据（境界 / 灵根 / 物品 / 悬赏）由 `data/xiuxian` 下 JSON 在 `GameData` 中统一加载缓存。
- 以 `突破概率.json` 的键顺序作为境界进阶的唯一可信来源，动态推导境界等级 `rank`。

### 注意事项

- **秘境、炼丹、传承** 为简化移植版本：保留核心玩法（随机探索奖励、凝练丹药、永久强化攻击修炼），完整丹方 / 多阶段事件 / 虚神界体系将在后续版本补全。
- 世界 BOSS 的属性以当前修为最高玩家为基准生成，以适配本插件的境界命名体系。
- 默认仅在群聊响应（可在配置中关闭 `groupOnly`）。
- 插件启用后请尽快设置管理员QQ号
## 许可证

[MIT](https://choosealicense.com/licenses/mit/)

## 特别感谢

- [nonebot-plugin-xiuxian-2](https://github.com/QingMuCat/nonebot_plugin_xiuxian_2)：原始玩法与数据来源。
- [Koishi](https://koishi.chat/)：本插件的开发框架。
