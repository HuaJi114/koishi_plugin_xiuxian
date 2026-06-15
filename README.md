# koishi-plugin-huaji-xiuxian

群聊修仙文字 MUD，由 [nonebot-plugin-xiuxian-2](https://github.com/luolianxiyou/nonebot-plugin-xiuxian-2) 移植并重构为 Koishi 插件。

当前版本：**0.5.3**

## 依赖

| 服务 | 必需 | 说明 |
|------|------|------|
| `database` | 是 | 玩家、背包、宗门等数据 |
| [monetary](https://koishi.chat/market?keyword=monetary) | 是 | 灵石经济 |
| [markdown-to-image-service](https://www.npmjs.com/package/koishi-plugin-markdown-to-image-service) | 否 | 长文本转图片（可选） |

## 快速开始

1. 在 Koishi 控制台启用本插件
2. 发送 **我要修仙** 创建角色
3. 发送 **修仙帮助** 查看指令

## 0.5.3 更新摘要

### 数值显示

- 灵石、修为、气血、真元等**全部以精确整数**展示，不再使用「2.3万」等缩写，且不四舍五入

### 每日重置

- 每日 0 点重置（秘境次数、悬赏刷新、签到等）按 **Asia/Shanghai（UTC+8）** 计算

### 长文本转图片

控制台可配置：

| 配置项 | 默认 | 说明 |
|--------|------|------|
| `longTextToImage` | `false` | 是否启用 |
| `longTextLineThreshold` | `20` | 超过该行数转图片 |

需安装 `koishi-plugin-markdown-to-image-service`；未安装时自动降级为纯文本。

### 传承（合并升级线）

- **参悟传承** 与 **升级攻击修炼** 合并为同一条攻击修炼线（最高 9 重）
- 散修与宗门弟子均可使用，第 n 重消耗 `n×500000` 灵石
- 「虚神界」称谓已并入传承，不再单独存在

### 灵庄

- **灵庄帮助** 展示 7 级会员完整表格
- **灵庄信息** 显示时息、存入时间、下一级升级费用
- **灵庄升级会员** / **灵庄会员** 升级渠道

### 辅修功法

- 加载 `辅修功法.json`，可通过 **使用** 学习
- **我的修仙信息** 单独展示辅修功法列表

### 炼体

- **炼体帮助** / **炼体查看** / **炼体**
- 消耗灵石突破炼体境界，永久提升攻防与暴击（数据来自 `炼体境界.json`）

### 坊市（按群）

- **坊市查看** / **坊市购买** / **坊市上架** / **坊市下架**
- **背包帮助** 查看说明
- **系统坊市上架**（管理员）上架任意物品
- 每 3 小时对有坊市记录的群自动补货回血丹

### 物品描述

- 274+ 条物品 `desc` 已替换为 ≤20 字的修仙风描述
- 神通效果展示补全减伤百分比、持续伤害、发动率等数值

## 指令概览

| 分类 | 指令 |
|------|------|
| 基础 | 我要修仙、修仙签到、我的修仙信息、重入仙途 |
| 修炼 | 闭关、出关、灵石修炼、双修、炼体 |
| 经济 | 灵石、送灵石、偷灵石、抢劫、排行榜 |
| 背包/坊市 | 我的背包、使用、背包帮助、坊市查看、坊市购买、坊市上架 |
| 宗门 | 宗门帮助、宗门每日供奉、宗门任务 |
| 灵庄 | 灵庄帮助、灵庄信息、灵庄升级会员 |
| 传承 | 传承帮助、参悟传承 |
| 其他 | 悬赏令、秘境、炼丹、世界BOSS |

## 开发与测试

本目录为独立插件包 `koishi_plugin_xiuxian`（**不要与 `koishi-app` 根目录的 package.json 混淆**）。

```bash
cd koishi_plugin_xiuxian
npm install
npm run build
npm run test
npm run lint
npm run patch-desc   # 重新生成物品描述（可选）
```

## 发布

```bash
npm run bump -- -3   # 若在 monorepo 内用 yakumo bump
npm run build
npm run pub          # 若在 monorepo 内用 yakumo publish
```

## 许可证

MIT
