# koishi-plugin-huaji-xiuxian

群聊修仙文字 MUD 插件，由 [nonebot-plugin-xiuxian-2](https://github.com/luolianxiyou/nonebot-plugin-xiuxian-2) 移植并重构为 Koishi 插件。

当前版本：**0.4.0**

## 依赖

| 服务 | 说明 |
|------|------|
| `database` | 玩家、背包、宗门等数据持久化 |
| [monetary](https://koishi.chat/market?keyword=monetary) | 灵石经济系统 |

在 Koishi 控制台启用本插件前，请确保上述服务已安装并开启。可在插件配置中设置 `currency` 指定 monetary 货币种类（默认 `default`）。

## 快速开始

1. 在 Koishi 控制台安装并启用 `koishi-plugin-huaji-xiuxian`
2. 向机器人发送 **我要修仙** 创建角色
3. 发送 **修仙帮助** 查看完整指令列表

默认仅在群聊中响应指令（可在配置中关闭 `groupOnly`）。

---

## 近期更新（0.4.0）

### 功法与神通

- 支持同时学习**多本功法**与**多个神通**，数据存储于 `xiuxian_skill` 表
- 功法/辅修功法加成按属性**取最高值合并**，不重复叠加
- **【我的修仙信息】** 展示已学功法、神通列表及合并后的属性加成
- 战斗中随机释放已学**神通**（直接伤害 / 持续伤害 / 增益等类型）
- 启动时自动将旧版 `buff` 表中的功法数据迁移至新表

### 战斗系统

- **抢劫**、**讨伐世界 BOSS** 改为**回合制战斗**（`playerFight`），结算双方气血变化
- 战斗结束后 **120 秒内** 可发送 **查看战斗详情**（别名 **战斗详情**）回顾完整战报
- 法器、防具、功法加成统一经 `combat-stats` 计算，装备后攻击等属性正确生效
- **【使用】** 支持法器/防具穿戴、功法/神通学习、丹药批量使用等完整逻辑

### 秘境探索

- 每位道友**每日 3 次**探索机会（**0 点**刷新，持久化至数据库）
- 每次探索成功后需等待 **1 小时** 冷却方可再次进入
- 探索结果随机：灵石、修为、物品或受伤，并提示当日剩余次数

### 悬赏令

- **【悬赏令】**：查看/刷新当前悬赏列表，**不消耗**每日刷新次数
- **【悬赏令刷新】**：主动刷新列表，每日 **3 次免费**，超出后每次消耗 **50 万** 灵石
- 刷新次数于 **0 点**重置并写入数据库

### 炼丹

- 实装完整炼丹流程，移除旧版随机 **【凝丹】** 逻辑
- **【炼丹】**：扫描背包，列出当前可炼制的丹方
- **【炼制 \<序号\>】**：按列表序号消耗药材炼制对应丹药
- **【炼丹帮助】** / **【炼丹配方帮助】** 查看说明

### 重入仙途

- **【重入仙途】** 清除全部修仙存档（境界、背包、宗门关系、技能等），**保留灵石**
- 消耗可在配置中设置的灵石（默认 10 万），完成后需重新发送 **我要修仙** 建号
- 宗主需先传位或解散宗门方可重入

### 每日重置

- 每日 **0 点**自动重置：秘境次数、悬赏刷新次数、签到标记等
- 插件启动时补跑遗漏的重置；每小时校验是否跨日，防止长期运行漏重置

### 物品与背包

- **【查看修仙界物品】** 支持按**物品名称**模糊查询（如 `精铁符剑`），仍支持按类型/编号查询
- 物品详情展示品阶、境界要求、属性加成、神通效果、耐药性、可炼制丹药等扩展信息
- **【使用 \<名称\> [数量]】** 支持按名称使用背包物品

---

## 指令概览

发送 **修仙帮助** 可查看完整列表。以下为常用指令分组：

| 分类 | 指令 |
|------|------|
| 基础 | 我要修仙、修仙签到、我的修仙信息、我的状态、改名、重入仙途 |
| 突破 | 我的突破概率、突破、直接突破、渡厄突破 |
| 修炼 | 闭关、出关、灵石修炼、双修 |
| 经济 | 灵石、送灵石、偷灵石、抢劫、查看战斗详情、排行榜 |
| 背包 | 我的背包、使用、换装、查看修仙界物品 |
| 宗门 | 宗门帮助、宗门每日供奉、接取宗门任务、完成宗门任务 |
| 悬赏 | 悬赏令、悬赏令刷新、悬赏令接取、悬赏令结算、悬赏令帮助 |
| 灵庄 | 灵庄信息 |
| 世界 BOSS | 世界boss帮助、查看世界boss、讨伐世界boss |
| 秘境 | 秘境帮助、探索秘境 |
| 炼丹 | 炼丹帮助、炼丹、炼制 |
| 传承 | 传承帮助 |

管理员可在配置 `adminQQ` 中填写 QQ 号，对应用户自动获得 authority 999，可执行创建世界 BOSS 等管理指令。

---

## 项目结构

```
huaji-xiuxian/
├── data/xiuxian/          # 游戏静态数据（境界、物品、悬赏、BOSS 等 JSON）
├── src/
│   ├── index.ts           # 插件入口
│   ├── service.ts         # 核心服务（数据、战斗、删档、每日重置）
│   ├── skills.ts          # 功法/神通合并与展示
│   ├── combat-stats.ts    # 战斗属性计算
│   ├── item-use.ts        # 物品使用逻辑
│   ├── battle-detail.ts   # 战斗详情缓存
│   ├── mix-elixir-util.ts # 炼丹配方检测
│   ├── daily-utils.ts     # 每日限额常量
│   ├── modules/           # 各玩法模块（base、info、cultivate、back…）
│   └── test/run-tests.ts  # 纯逻辑单元测试
├── lib/                   # 构建产物（npm run build 输出）
├── package.json
└── tsconfig.json
```

---

## 开发

本插件位于 Koishi 工作区 `external/huaji-xiuxian`。构建与依赖管理请在**应用根目录** `koishi-app` 执行，参见 [工作区开发](https://koishi.chat/zh-CN/guide/develop/workspace.html)。

```bash
# 在 koishi-app 目录 — 工作区标准方式
npm run build huaji-xiuxian
npm run dev

# 添加插件依赖
npm install <package> -w koishi-plugin-huaji-xiuxian
```

也可在插件目录直接操作：

```bash
cd external/huaji-xiuxian
npm run build    # 编译 TypeScript → lib/
npm run test     # 运行单元测试（无需启动 Koishi）
npm run lint     # 类型检查
```

### 测试说明

`npm run test` 运行 `src/test/run-tests.ts`，覆盖以下逻辑：

- 功法加成合并（同属性取 max）
- 物品名称查询
- 每日限额常量（秘境 3 次、悬赏刷新 3 次）
- 炼丹配方检测
- 回合制战斗结算
- 装备属性（如精铁符剑攻击加成）

请勿使用 `npx tsc src/test/run-tests.ts` 单文件编译——会绕过 `tsconfig.json`，导致 node_modules 类型误报。

---

## 发布

修改版本号后，在应用根目录执行，参见 [发布插件](https://koishi.chat/zh-CN/guide/develop/publish.html)：

```bash
npm run bump huaji-xiuxian -- -3   # 小版本 +1
npm run build huaji-xiuxian
npm run pub huaji-xiuxian
```

---

## 许可证

MIT
