import { $, Context, Service, Session } from 'koishi'
import { Config } from './config'
import { GameData } from './data'
import { calcInitialStats, clampBaseHpMp, getEffectiveMaxHpMp } from './utils'
import { computeCombatStats } from './combat-stats'
import { mergeSkillBuffs } from './skills'
import { todayStr, META_LAST_DAILY_RESET } from './daily-utils'
import { findPresetSect, PRESET_SECTS } from './preset-sects'
import { XiuxianBack, XiuxianBuff, XiuxianPlayer, XiuxianSect, XiuxianSkill } from './types'

declare module 'koishi' {
  interface Context {
    xiuxian: XiuxianService
  }
}

/**
 * 修仙核心服务。
 * 封装数据库表的增删改查、灵石经济（通过 monetary 服务）、玩家状态管理等，
 * 对应原插件的 XiuxianDateManage。
 */
export class XiuxianService extends Service {
  static inject = ['database', 'monetary']

  readonly data: GameData

  constructor(ctx: Context, public config: Config) {
    super(ctx, 'xiuxian', true)
    this.data = new GameData()
    this.extendModels()
  }

  // ==================== 数据库模型 ====================

  private extendModels() {
    const ctx = this.ctx
    ctx.model.extend('xiuxian_player', {
      userId: 'string',
      platform: 'string',
      uid: 'unsigned',
      root: 'string',
      rootType: 'string',
      level: { type: 'string', initial: '江湖好手' },
      power: 'unsigned',
      createTime: 'timestamp',
      isSign: { type: 'integer', initial: 0 },
      exp: { type: 'double', initial: 100 },
      userName: 'string',
      levelUpCd: 'timestamp',
      levelUpRate: { type: 'integer', initial: 0 },
      sectId: { type: 'integer', initial: 0 },
      sectPosition: { type: 'integer', initial: 0 },
      hp: { type: 'double', initial: 0 },
      mp: { type: 'double', initial: 0 },
      atk: { type: 'double', initial: 0 },
      atkPractice: { type: 'integer', initial: 0 },
      sectTask: { type: 'integer', initial: 0 },
      sectMissionId: { type: 'integer', initial: 0 },
      sectMissionDoneAt: 'timestamp',
      sectContribution: { type: 'double', initial: 0 },
      sectElixirGet: { type: 'integer', initial: 0 },
      sectOfferingGet: { type: 'integer', initial: 0 },
      blessedSpotFlag: { type: 'integer', initial: 0 },
      blessedSpotName: 'string',
      riftCd: 'timestamp',
      riftDailyCount: { type: 'integer', initial: 0 },
      workRefreshCount: { type: 'integer', initial: 0 },
      lastSignDate: 'string',
    }, { primary: 'userId' })

    ctx.model.extend('xiuxian_cd', {
      userId: 'string',
      type: { type: 'integer', initial: 0 },
      createTime: 'timestamp',
      scheduledTime: { type: 'integer', initial: 0 },
    }, { primary: 'userId' })

    ctx.model.extend('xiuxian_sect', {
      sectId: 'unsigned',
      sectName: 'string',
      sectOwner: 'string',
      sectScale: { type: 'double', initial: 0 },
      sectUsedStone: { type: 'double', initial: 0 },
      sectFairyland: { type: 'integer', initial: 0 },
      sectMaterials: { type: 'double', initial: 0 },
      mainBuff: { type: 'integer', initial: 0 },
      secBuff: { type: 'integer', initial: 0 },
      elixirRoomLevel: { type: 'integer', initial: 0 },
    }, { primary: 'sectId', autoInc: true })

    ctx.model.extend('xiuxian_back', {
      userId: 'string',
      goodsId: 'unsigned',
      goodsName: 'string',
      goodsType: 'string',
      goodsNum: { type: 'integer', initial: 0 },
      createTime: 'timestamp',
      updateTime: 'timestamp',
      remake: 'string',
      dayNum: { type: 'integer', initial: 0 },
      allNum: { type: 'integer', initial: 0 },
      actionTime: 'timestamp',
      state: { type: 'integer', initial: 0 },
      bindNum: { type: 'integer', initial: 0 },
    }, { primary: ['userId', 'goodsId'] })

    ctx.model.extend('xiuxian_buff', {
      userId: 'string',
      mainBuff: { type: 'integer', initial: 0 },
      secBuff: { type: 'integer', initial: 0 },
      faqiBuff: { type: 'integer', initial: 0 },
      fabaoWeapon: { type: 'integer', initial: 0 },
      armorBuff: { type: 'integer', initial: 0 },
      atkBuff: { type: 'double', initial: 0 },
      blessedSpot: { type: 'integer', initial: 0 },
      subBuff: { type: 'integer', initial: 0 },
    }, { primary: 'userId' })

    ctx.model.extend('xiuxian_meta', {
      key: 'string',
      value: 'string',
    }, { primary: 'key' })

    ctx.model.extend('xiuxian_skill', {
      userId: 'string',
      skillId: 'unsigned',
      skillType: 'string',
      learnedAt: 'timestamp',
    }, { primary: ['userId', 'skillId'] })
  }

  // ==================== 玩家信息 ====================

  /** 根据平台用户 ID 获取玩家（不含功法加成） */
  async getPlayer(userId: string): Promise<XiuxianPlayer | undefined> {
    const [player] = await this.ctx.database.get('xiuxian_player', { userId })
    return player
  }

  /** 根据道号获取玩家 */
  async getPlayerByName(userName: string): Promise<XiuxianPlayer | undefined> {
    const [player] = await this.ctx.database.get('xiuxian_player', { userName })
    return player
  }

  /** 获取玩家并应用功法/装备加成（对应 final_user_data） */
  async getRealPlayer(userId: string): Promise<XiuxianPlayer | undefined> {
    await this.syncEquipBuffs(userId)
    const player = await this.getPlayer(userId)
    if (!player) return undefined
    const buff = await this.getBuff(userId)
    const skills = await this.getLearnedSkills(userId)
    const merged = mergeSkillBuffs(skills, this.data)
    const stats = computeCombatStats(player, buff, this.data, merged)
    const mainHp = merged.hpbuff
    const mainMp = merged.mpbuff
    const { maxHp, maxMp } = getEffectiveMaxHpMp(player.exp, mainHp, mainMp)
    const { hp: baseHp, mp: baseMp } = clampBaseHpMp(player.exp, player.hp, player.mp)
    return {
      ...player,
      hp: Math.min(Math.floor(baseHp * (1 + mainHp)), maxHp),
      mp: Math.min(Math.floor(baseMp * (1 + mainMp)), maxMp),
      atk: stats.finalAtk,
    }
  }

  /**
   * 将背包中 state=1 的装备同步到 buff 表。
   * 修复仅更新了背包装备状态、未写入 faqiBuff/armorBuff 的历史数据。
   */
  async syncEquipBuffs(userId: string): Promise<void> {
    const backs = await this.ctx.database.get('xiuxian_back', { userId, state: 1, goodsNum: { $gte: 1 } })
    const buff = await this.getBuff(userId)
    let faqiId = 0
    let armorId = 0
    for (const b of backs) {
      const info = this.data.getItem(b.goodsId)
      const equipType = info?.item_type === '法器' ? '法器'
        : info?.item_type === '防具' ? '防具'
        : b.goodsType === '装备'
          ? (b.goodsName.includes('甲') || b.goodsName.includes('袍') || b.goodsName.includes('衣') ? '防具' : '法器')
          : null
      if (equipType === '法器') faqiId = b.goodsId
      if (equipType === '防具') armorId = b.goodsId
    }
    if (faqiId !== buff.faqiBuff || armorId !== buff.armorBuff) {
      await this.ctx.database.set('xiuxian_buff', { userId }, { faqiBuff: faqiId, armorBuff: armorId })
    }
  }

  /** 创建玩家，已存在则返回提示 */
  async createPlayer(session: Session, root: string, rootType: string, power: number, userName: string): Promise<string> {
    const userId = session.userId!
    const platform = session.platform
    const existing = await this.getPlayer(userId)
    if (existing) return '您已迈入修仙世界，输入【我的修仙信息】获取数据吧！'
    let uid = await this.getCanonicalUid(userId, platform)
    if (uid <= 0) {
      const user = await session.getUser(userId, ['id'])
      uid = user?.id ?? 0
      if (uid <= 0) {
        const created = await this.ctx.database.createUser(platform, userId, { createdAt: new Date() })
        uid = created.id
      }
    }
    const exp = 100
    const { hp, mp, atk } = calcInitialStats(exp, rootType, this.data)
    await this.ctx.database.create('xiuxian_player', {
      userId,
      platform,
      uid,
      root,
      rootType,
      level: '江湖好手',
      power,
      exp,
      hp,
      mp,
      atk,
      createTime: new Date(),
      userName,
      sectId: 0,
      sectPosition: 0,
      sectContribution: 0,
    })
    await this.getCd(userId)
    await this.getBuff(userId)
    return `欢迎进入修仙世界，你的灵根为：${root}，类型是：${rootType}，你的战力为：${power}，当前境界：江湖好手`
  }

  // ==================== 灵石经济（monetary） ====================

  /** 查询时尝试的 currency 列表（配置项优先，兼容 monetary 默认的 default） */
  private monetaryCurrencies(): string[] {
    const primary = this.config.currency
    return primary === 'default' ? ['default'] : [primary, 'default']
  }

  /** 收集与平台用户 ID 可能关联的全部 Koishi uid */
  private async collectMonetaryUids(userId: string, platform?: string): Promise<number[]> {
    const uids = new Set<number>()
    const player = await this.getPlayer(userId)
    if (player?.uid && player.uid > 0) uids.add(player.uid)

    const plat = platform ?? player?.platform
    if (plat) {
      const user = await this.ctx.database.getUser(plat, userId, ['id'])
      if (user?.id) uids.add(user.id)
    }

    const bindings = await this.ctx.database.get('binding', { pid: userId }, ['aid', 'platform'])
    for (const binding of bindings) {
      if (binding.aid > 0) uids.add(binding.aid)
    }
    return [...uids]
  }

  /** 回写玩家表中的 uid / platform 缓存 */
  private async syncPlayerUid(userId: string, uid: number, platform?: string): Promise<void> {
    const player = await this.getPlayer(userId)
    if (!player) return
    const plat = platform ?? player.platform
    if (player.uid !== uid || (plat && player.platform !== plat)) {
      await this.ctx.database.set('xiuxian_player', { userId }, {
        uid,
        ...(plat ? { platform: plat } : {}),
      })
    }
  }

  /**
   * 获取写入 monetary 时使用的 canonical uid（不创建新用户，避免重复 uid）。
   */
  async getCanonicalUid(userId: string, platform?: string): Promise<number> {
    const player = await this.getPlayer(userId)
    const plat = platform ?? player?.platform

    if (plat) {
      const user = await this.ctx.database.getUser(plat, userId, ['id'])
      if (user?.id) {
        await this.syncPlayerUid(userId, user.id, plat)
        return user.id
      }
    }

    const bindings = await this.ctx.database.get('binding', { pid: userId }, ['aid', 'platform'])
    if (plat) {
      const match = bindings.find((b) => b.platform === plat)
      if (match?.aid) {
        await this.syncPlayerUid(userId, match.aid, plat)
        return match.aid
      }
    }
    if (bindings.length === 1 && bindings[0].aid) {
      await this.syncPlayerUid(userId, bindings[0].aid, bindings[0].platform)
      return bindings[0].aid
    }

    if (player?.uid && player.uid > 0) return player.uid

    this.ctx.logger('huaji-xiuxian').warn('无法解析 monetary uid：userId=%s platform=%s', userId, plat ?? '')
    return 0
  }

  /** @deprecated 请使用 getCanonicalUid */
  async resolveMonetaryUid(userId: string, platform?: string): Promise<number> {
    return this.getCanonicalUid(userId, platform)
  }

  /** 只读汇总用户在所有候选 uid/currency 下的灵石总额 */
  private async sumMonetary(userId: string, platform?: string): Promise<number> {
    const uids = await this.collectMonetaryUids(userId, platform)
    let total = 0
    for (const uid of uids) {
      for (const currency of this.monetaryCurrencies()) {
        const [data] = await this.ctx.database.get('monetary', { uid, currency }, ['value'])
        if (data) total += data.value ?? 0
      }
    }
    return total
  }

  /** 将余额迁移到 canonical uid + 配置 currency，避免分散在多条记录 */
  private async normalizeMonetary(userId: string, platform?: string): Promise<{ uid: number; currency: string; value: number }> {
    const canonicalUid = await this.getCanonicalUid(userId, platform)
    const targetCurrency = this.config.currency
    const uids = await this.collectMonetaryUids(userId, platform)

    let total = 0
    const stale: Array<{ uid: number; currency: string }> = []

    for (const uid of uids) {
      for (const currency of this.monetaryCurrencies()) {
        const [data] = await this.ctx.database.get('monetary', { uid, currency }, ['value'])
        if (!data) continue
        const value = data.value ?? 0
        total += value
        if (uid !== canonicalUid || currency !== targetCurrency) {
          stale.push({ uid, currency })
        }
      }
    }

    if (canonicalUid <= 0) {
      return { uid: 0, currency: targetCurrency, value: total }
    }

    for (const row of stale) {
      await this.ctx.database.remove('monetary', row)
    }

    if (total > 0) {
      const [primary] = await this.ctx.database.get('monetary', { uid: canonicalUid, currency: targetCurrency }, ['value'])
      if (primary) {
        await this.ctx.database.set('monetary', { uid: canonicalUid, currency: targetCurrency }, { value: total })
      } else {
        await this.ctx.database.create('monetary', { uid: canonicalUid, currency: targetCurrency, value: total })
      }
    } else {
      await this.ctx.database.remove('monetary', { uid: canonicalUid, currency: targetCurrency })
    }

    await this.syncPlayerUid(userId, canonicalUid, platform)
    return { uid: canonicalUid, currency: targetCurrency, value: total }
  }

  /** 按平台用户 ID 查询灵石 */
  async getStoneForUser(userId: string, platform?: string): Promise<number> {
    return this.sumMonetary(userId, platform)
  }

  /** 按平台用户 ID 增加灵石 */
  async gainStoneForUser(userId: string, amount: number, platform?: string): Promise<void> {
    if (amount <= 0) return
    const entry = await this.normalizeMonetary(userId, platform)
    if (entry.uid <= 0) {
      this.ctx.logger('huaji-xiuxian').warn('增加灵石失败：无法解析 uid，userId=%s', userId)
      return
    }
    await this.gainStone(entry.uid, amount, entry.currency)
  }

  /** 按平台用户 ID 扣除灵石 */
  async costStoneForUser(userId: string, amount: number, platform?: string): Promise<boolean> {
    if (amount <= 0) return true
    const entry = await this.normalizeMonetary(userId, platform)
    if (entry.uid <= 0 || entry.value < amount) return false
    return this.costStone(entry.uid, amount, entry.currency)
  }

  /** 查询玩家灵石数量 */
  async getStone(uid: number, currency = this.config.currency): Promise<number> {
    for (const cur of currency === this.config.currency ? this.monetaryCurrencies() : [currency]) {
      const [data] = await this.ctx.database.get('monetary', { uid, currency: cur }, ['value'])
      if (data) return data.value ?? 0
    }
    return 0
  }

  /** 增加灵石（累加至已有记录，不存在则创建） */
  async gainStone(uid: number, amount: number, currency = this.config.currency): Promise<void> {
    if (amount <= 0 || uid <= 0) return
    const [existing] = await this.ctx.database.get('monetary', { uid, currency }, ['value'])
    if (existing) {
      await this.ctx.database.set('monetary', { uid, currency }, (row) => ({
        value: $.add(row.value, amount),
      }))
    } else {
      await this.ctx.database.create('monetary', { uid, currency, value: amount })
    }
  }

  /** 扣除灵石，成功返回 true，余额不足返回 false */
  async costStone(uid: number, amount: number, currency = this.config.currency): Promise<boolean> {
    if (amount <= 0) return true
    if (uid <= 0) return false
    const [existing] = await this.ctx.database.get('monetary', { uid, currency }, ['value'])
    if (!existing || existing.value < amount) return false
    await this.ctx.database.set('monetary', { uid, currency }, (row) => ({
      value: $.subtract(row.value, amount),
    }))
    return true
  }

  /** 通过平台用户 ID 查询灵石 */
  async getStoneByUserId(userId: string, platform?: string): Promise<number> {
    const player = await this.getPlayer(userId)
    if (!player) return 0
    return this.getStoneForUser(userId, platform ?? player.platform)
  }

  // ==================== 修为 / 战力 / 境界 ====================

  /** 更新战力：power = exp * 灵根倍率 * 境界倍率 */
  async updatePower(userId: string): Promise<void> {
    const player = await this.getPlayer(userId)
    if (!player) return
    const rootSpeed = this.data.roots[player.rootType]?.type_speeds ?? 1
    const levelSpend = this.data.levels[player.level]?.spend ?? 1
    const power = Math.round(player.exp * rootSpeed * levelSpend)
    await this.ctx.database.set('xiuxian_player', { userId }, { power })
  }

  /** 增加修为 */
  async addExp(userId: string, exp: number): Promise<void> {
    await this.ctx.database.set('xiuxian_player', { userId }, (row) => ({ exp: $.add(row.exp, Math.floor(exp)) }))
  }

  /** 减少修为 */
  async reduceExp(userId: string, exp: number): Promise<void> {
    await this.ctx.database.set('xiuxian_player', { userId }, (row) => ({ exp: $.subtract(row.exp, Math.floor(exp)) }))
  }

  /** 增加攻击修炼等级（传承） */
  async addAtkPractice(userId: string, amount: number): Promise<void> {
    await this.ctx.database.set('xiuxian_player', { userId }, (row) => ({ atkPractice: $.add(row.atkPractice, amount) }))
  }

  /** 炼体数据 */
  async getExercises(userId: string) {
    const [row] = await this.ctx.database.get('xiuxian_exercises', { userId })
    return row
  }

  /** 更新境界 */
  async setLevel(userId: string, level: string): Promise<void> {
    await this.ctx.database.set('xiuxian_player', { userId }, { level })
  }

  /** 更新突破冷却为当前时间 */
  async setLevelCd(userId: string): Promise<void> {
    await this.ctx.database.set('xiuxian_player', { userId }, { levelUpCd: new Date() })
  }

  /** 更新突破附加概率 */
  async setLevelRate(userId: string, rate: number): Promise<void> {
    await this.ctx.database.set('xiuxian_player', { userId }, { levelUpRate: rate })
  }

  /** 更新道号，已存在则返回提示 */
  async setUserName(userId: string, userName: string): Promise<string> {
    const existing = await this.getPlayerByName(userName)
    if (existing) return '已存在该道号！'
    await this.ctx.database.set('xiuxian_player', { userId }, { userName })
    return '道友的道号更新成功拉~'
  }

  /** 重置气血/真元/攻击为基础值 */
  async resetState(userId?: string): Promise<void> {
    const query = userId ? { userId } : {}
    await this.ctx.database.set('xiuxian_player', query, (row) => ({
      hp: $.multiply(row.exp, 0.5),
      mp: row.exp,
      atk: $.multiply(row.exp, 0.1),
    }))
  }

  /** 直接设置气血、真元（自动限制在基础上限内） */
  async setHpMp(userId: string, hp: number, mp: number): Promise<void> {
    const player = await this.getPlayer(userId)
    if (!player) return
    const clamped = clampBaseHpMp(player.exp, hp, mp)
    await this.ctx.database.set('xiuxian_player', { userId }, clamped)
  }

  /** 战斗结束后写入双方剩余气血 */
  async applyBattleHp(userId: string, combatHp: number): Promise<void> {
    const player = await this.getPlayer(userId)
    if (!player) return
    await this.setHpMp(userId, Math.max(combatHp, 0), player.mp)
  }

  /** 洗点重入：清除全部数据（保留灵石），返回后需重新【我要修仙】 */
  async wipeAndRemake(userId: string, platform: string): Promise<string> {
    const player = await this.getPlayer(userId)
    if (!player) return '修仙界没有你的足迹，输入 我要修仙 加入修仙世界吧！'
    if (!(await this.costStoneForUser(userId, this.config.remakeCost, platform))) {
      return '你的灵石还不够呢，快去赚点灵石吧！'
    }
    const ownedSect = await this.getSectByOwner(userId)
    if (ownedSect) {
      return '道友为一宗之主，请先转让宗主之位或解散宗门后再重入仙途！'
    }
    await this.wipeUserData(userId)
    return '逆天改命，前尘尽散！请发送【我要修仙】重新踏入仙路。'
  }

  /** 清除用户全部游戏数据（不触碰 monetary 灵石） */
  async wipeUserData(userId: string): Promise<void> {
    await this.ctx.database.remove('xiuxian_back', { userId })
    await this.ctx.database.remove('xiuxian_buff', { userId })
    await this.ctx.database.remove('xiuxian_cd', { userId })
    await this.ctx.database.remove('xiuxian_skill', { userId })
    await this.ctx.database.remove('xiuxian_work', { userId })
    await this.ctx.database.remove('xiuxian_boss_participant', { userId })
    await this.ctx.database.remove('xiuxian_exercises', { userId })
    await this.ctx.database.remove('xiuxian_bank', { userId })
    await this.ctx.database.remove('xiuxian_player', { userId })
  }

  /** @deprecated 使用 wipeAndRemake */
  async ramake(userId: string, _root: string, _rootType: string): Promise<string> {
    const player = await this.getPlayer(userId)
    if (!player) return '修仙界没有你的足迹，输入 我要修仙 加入修仙世界吧！'
    return this.wipeAndRemake(userId, player.platform)
  }

  /** 签到 */
  async sign(userId: string, platform?: string): Promise<string> {
    const player = await this.getPlayer(userId)
    if (!player) return '修仙界没有你的足迹，输入 我要修仙 加入修仙世界吧！'
    const today = todayStr()
    if (player.isSign === 1 && player.lastSignDate === today) {
      return '今日已签到，请明日0点后再来。'
    }
    const { signInLingShiLowerLimit: lo, signInLingShiUpperLimit: hi } = this.config
    const stone = Math.floor(Math.random() * (hi - lo + 1)) + lo
    await this.ctx.database.set('xiuxian_player', { userId }, { isSign: 1, lastSignDate: today })
    await this.gainStoneForUser(userId, stone, platform ?? player.platform)
    return `签到成功，获取${stone}块灵石!`
  }

  /** 每日 0 点重置：所有「单日限次」指令计数 */
  async resetDailyFlags(): Promise<void> {
    await this.ctx.database.set('xiuxian_player', {}, {
      isSign: 0,
      sectOfferingGet: 0,
      sectElixirGet: 0,
      riftDailyCount: 0,
      workRefreshCount: 0,
      lastSignDate: '',
    })
    await this.ctx.database.set('xiuxian_back', {}, { dayNum: 0 })
    await this.setMeta(META_LAST_DAILY_RESET, todayStr())
  }

  /** 启动或跨日时补执行每日重置 */
  async ensureDailyResetIfNeeded(): Promise<void> {
    const today = todayStr()
    const last = await this.getMeta(META_LAST_DAILY_RESET)
    if (last === today) return
    await this.resetDailyFlags()
  }

  async getMeta(key: string): Promise<string | undefined> {
    const [row] = await this.ctx.database.get('xiuxian_meta', { key })
    return row?.value
  }

  async setMeta(key: string, value: string): Promise<void> {
    const existing = await this.getMeta(key)
    if (existing !== undefined) {
      await this.ctx.database.set('xiuxian_meta', { key }, { value })
    } else {
      await this.ctx.database.create('xiuxian_meta', { key, value })
    }
  }

  /** @deprecated 请使用 resetDailyFlags */
  async resetSign(): Promise<void> {
    return this.resetDailyFlags()
  }

  // ==================== 状态 / 冷却 ====================

  /** 获取用户状态，不存在则创建 */
  async getCd(userId: string) {
    const [cd] = await this.ctx.database.get('xiuxian_cd', { userId })
    if (cd) return cd
    await this.ctx.database.create('xiuxian_cd', { userId, type: 0 })
    return undefined
  }

  /** 更新用户状态 */
  async setState(userId: string, type: number, scheduledTime = 0): Promise<void> {
    await this.getCd(userId)
    await this.ctx.database.set('xiuxian_cd', { userId }, {
      type,
      createTime: type === 0 ? new Date(0) : new Date(),
      scheduledTime,
    })
  }

  // ==================== 功法 / 神通 ====================

  async getLearnedSkills(userId: string): Promise<XiuxianSkill[]> {
    return this.ctx.database.get('xiuxian_skill', { userId })
  }

  async hasSkill(userId: string, skillId: number): Promise<boolean> {
    const [row] = await this.ctx.database.get('xiuxian_skill', { userId, skillId })
    return !!row
  }

  async learnSkill(userId: string, skillId: number, skillType: XiuxianSkill['skillType']): Promise<void> {
    if (await this.hasSkill(userId, skillId)) return
    await this.ctx.database.create('xiuxian_skill', {
      userId, skillId, skillType, learnedAt: new Date(),
    })
    const buff = await this.getBuff(userId)
    const patch: Partial<XiuxianBuff> = {}
    if (skillType === '功法' && !buff.mainBuff) patch.mainBuff = skillId
    if (skillType === '神通' && !buff.secBuff) patch.secBuff = skillId
    if (skillType === '辅修功法' && !buff.subBuff) patch.subBuff = skillId
    if (Object.keys(patch).length) {
      await this.ctx.database.set('xiuxian_buff', { userId }, patch)
    }
  }

  async getSecSkillIds(userId: string): Promise<number[]> {
    const skills = await this.getLearnedSkills(userId)
    return skills.filter((s) => s.skillType === '神通').map((s) => s.skillId)
  }

  /** 将旧 buff 单字段迁移到 skill 表 */
  async migrateSkillsFromBuff(): Promise<void> {
    const FLAG = 'skill_table_migrated_v1'
    if (await this.getMeta(FLAG)) return
    const buffs = await this.ctx.database.get('xiuxian_buff', {})
    for (const b of buffs) {
      if (b.mainBuff > 0) await this.learnSkill(b.userId, b.mainBuff, '功法')
      if (b.secBuff > 0) await this.learnSkill(b.userId, b.secBuff, '神通')
      if (b.subBuff > 0) await this.learnSkill(b.userId, b.subBuff, '辅修功法')
    }
    await this.setMeta(FLAG, new Date().toISOString())
  }

  // ==================== Buff ====================

  /** 获取用户 Buff 信息，不存在则初始化 */
  async getBuff(userId: string): Promise<XiuxianBuff> {
    const [buff] = await this.ctx.database.get('xiuxian_buff', { userId })
    if (buff) return buff
    return this.ctx.database.create('xiuxian_buff', { userId })
  }

  async setMainBuff(userId: string, id: number) {
    await this.getBuff(userId)
    await this.ctx.database.set('xiuxian_buff', { userId }, { mainBuff: id })
  }

  async setSecBuff(userId: string, id: number) {
    await this.getBuff(userId)
    await this.ctx.database.set('xiuxian_buff', { userId }, { secBuff: id })
  }

  async setFaqiBuff(userId: string, id: number) {
    await this.getBuff(userId)
    await this.ctx.database.set('xiuxian_buff', { userId }, { faqiBuff: id })
  }

  async setArmorBuff(userId: string, id: number) {
    await this.getBuff(userId)
    await this.ctx.database.set('xiuxian_buff', { userId }, { armorBuff: id })
  }

  async setSubBuff(userId: string, id: number) {
    await this.getBuff(userId)
    await this.ctx.database.set('xiuxian_buff', { userId }, { subBuff: id })
  }

  async addAtkBuff(userId: string, amount: number) {
    const buff = await this.getBuff(userId)
    await this.ctx.database.set('xiuxian_buff', { userId }, { atkBuff: buff.atkBuff + amount })
    await this.updatePower(userId)
  }

  async setBlessedSpot(userId: string, level: number) {
    await this.getBuff(userId)
    await this.ctx.database.set('xiuxian_buff', { userId }, { blessedSpot: level })
  }

  async setAtk(userId: string, atk: number) {
    await this.ctx.database.set('xiuxian_player', { userId }, { atk })
  }

  /** 装备法器（自动卸下原法器） */
  async equipFaqi(userId: string, goodsId: number): Promise<void> {
    const buff = await this.getBuff(userId)
    const now = new Date()
    if (buff.faqiBuff && buff.faqiBuff !== goodsId) {
      await this.ctx.database.set('xiuxian_back', { userId, goodsId: buff.faqiBuff }, { state: 0, updateTime: now })
    }
    await this.setFaqiBuff(userId, goodsId)
    await this.ctx.database.set('xiuxian_back', { userId, goodsId }, { state: 1, updateTime: now, actionTime: now })
    await this.updatePower(userId)
  }

  /** 装备防具（自动卸下原防具） */
  async equipArmor(userId: string, goodsId: number): Promise<void> {
    const buff = await this.getBuff(userId)
    const now = new Date()
    if (buff.armorBuff && buff.armorBuff !== goodsId) {
      await this.ctx.database.set('xiuxian_back', { userId, goodsId: buff.armorBuff }, { state: 0, updateTime: now })
    }
    await this.setArmorBuff(userId, goodsId)
    await this.ctx.database.set('xiuxian_back', { userId, goodsId }, { state: 1, updateTime: now, actionTime: now })
    await this.updatePower(userId)
  }

  // ==================== 背包 ====================

  /** 获取背包（数量 >= 1） */
  async getBack(userId: string): Promise<XiuxianBack[]> {
    return this.ctx.database.get('xiuxian_back', { userId, goodsNum: { $gte: 1 } })
  }

  /** 获取背包中某物品 */
  async getBackItem(userId: string, goodsId: number): Promise<XiuxianBack | undefined> {
    const [item] = await this.ctx.database.get('xiuxian_back', { userId, goodsId })
    return item
  }

  /** 添加物品到背包 */
  async sendBack(userId: string, goodsId: number, goodsName: string, goodsType: string, goodsNum: number, bindFlag = 0): Promise<void> {
    const info = this.data.getItem(goodsId)
    const storedType = info?.item_type ?? goodsType
    const now = new Date()
    const item = await this.getBackItem(userId, goodsId)
    if (item) {
      const bindNum = bindFlag === 1 ? item.bindNum + goodsNum : item.bindNum
      await this.ctx.database.set('xiuxian_back', { userId, goodsId }, {
        goodsNum: item.goodsNum + goodsNum,
        updateTime: now,
        bindNum,
      })
    } else {
      await this.ctx.database.create('xiuxian_back', {
        userId, goodsId, goodsName, goodsType: storedType, goodsNum,
        createTime: now, updateTime: now,
        bindNum: bindFlag === 1 ? goodsNum : 0,
      })
    }
  }

  /** 使用/减少背包物品 */
  async reduceBack(userId: string, goodsId: number, num = 1, useKey = 0): Promise<void> {
    const item = await this.getBackItem(userId, goodsId)
    if (!item) return
    const now = new Date()
    let { dayNum, allNum, bindNum } = item
    const info = this.data.getItem(goodsId)
    const elixirType = info?.item_type ?? item.goodsType
    const isElixir = elixirType === '丹药' || elixirType === '合成丹药'
    if (isElixir && useKey === 1) {
      if (item.bindNum >= 1) bindNum = item.bindNum - num
      dayNum += num
      allNum += num
    }
    await this.ctx.database.set('xiuxian_back', { userId, goodsId }, {
      updateTime: now,
      actionTime: now,
      goodsNum: item.goodsNum - num,
      dayNum,
      allNum,
      bindNum,
    })
  }

  // ==================== 排行榜 ====================

  /** 境界排行榜 TOP10 */
  async realmTop(): Promise<XiuxianPlayer[]> {
    const players = await this.ctx.database.get('xiuxian_player', { userName: { $ne: '' } })
    return players
      .sort((a, b) => {
        const ia = this.data.getLevelIndex(a.level)
        const ib = this.data.getLevelIndex(b.level)
        if (ia !== ib) return ib - ia // 序号越大境界越低，故倒序使高境界靠前
        return b.exp - a.exp
      })
      .slice(0, 10)
  }

  /** 获取修为最高的玩家 */
  async getTopExpPlayer(): Promise<XiuxianPlayer | undefined> {
    const [top] = await this.ctx.database
      .select('xiuxian_player')
      .orderBy('exp', 'desc')
      .limit(1)
      .execute()
    return top
  }

  /** 战力排行榜 TOP10 */
  async powerTop(): Promise<XiuxianPlayer[]> {
    return this.ctx.database
      .select('xiuxian_player')
      .where({ userName: { $ne: '' } })
      .orderBy('power', 'desc')
      .limit(10)
      .execute()
  }

  /** 灵石排行榜 TOP10 */
  async stoneTop(): Promise<Array<{ userName: string; stone: number }>> {
    const players = await this.ctx.database.get('xiuxian_player', { userName: { $ne: '' } })
    const results: Array<{ userName: string; stone: number }> = []
    for (const p of players) {
      const stone = await this.getStoneForUser(p.userId, p.platform)
      if (stone > 0) results.push({ userName: p.userName, stone })
    }
    return results.sort((a, b) => b.stone - a.stone).slice(0, 10)
  }

  // ==================== 宗门 ====================

  /** 初始化系统预设四大宗门（不存在则创建） */
  /** 修正所有玩家超出上限的气血/真元 */
  async normalizeAllPlayerHpMp(): Promise<void> {
    const players = await this.ctx.database.get('xiuxian_player', {})
    let fixed = 0
    for (const p of players) {
      const clamped = clampBaseHpMp(p.exp, p.hp, p.mp)
      if (clamped.hp !== p.hp || clamped.mp !== p.mp) {
        await this.ctx.database.set('xiuxian_player', { userId: p.userId }, clamped)
        fixed++
      }
    }
    if (fixed) {
      this.ctx.logger('huaji-xiuxian').info('已修正 %d 名玩家超出上限的气血/真元', fixed)
    }
  }

  /** 一次性迁移：升级前已存在的账号默认归一为散修（不自动加入任何宗门） */
  async ensureExistingPlayersAsFreelancer(): Promise<void> {
    const FLAG = 'legacy_freelancer_default_v1'
    const [done] = await this.ctx.database.get('xiuxian_meta', { key: FLAG })
    if (done) return

    const players = await this.ctx.database.get('xiuxian_player', {})
    let adjusted = 0
    for (const p of players) {
      if (p.sectId || p.sectPosition || p.sectContribution) {
        await this.ctx.database.set('xiuxian_player', { userId: p.userId }, {
          sectId: 0,
          sectPosition: 0,
          sectContribution: 0,
        })
        adjusted++
      }
    }
    await this.ctx.database.create('xiuxian_meta', { key: FLAG, value: new Date().toISOString() })
    if (players.length) {
      this.ctx.logger('huaji-xiuxian').info(
        '已有账号默认归一为散修（共 %d 人，调整 %d 人）',
        players.length,
        adjusted,
      )
    }
  }

  /** 宗门数据异常时回退为散修 */
  async normalizeFreelancerState(): Promise<void> {
    const players = await this.ctx.database.get('xiuxian_player', { sectId: { $gt: 0 } })
    for (const p of players) {
      const sect = await this.getSectById(p.sectId)
      if (!sect) {
        await this.ctx.database.set('xiuxian_player', { userId: p.userId }, {
          sectId: 0,
          sectPosition: 0,
          sectContribution: 0,
        })
      }
    }
  }

  async ensurePresetSects(): Promise<void> {
    for (const preset of PRESET_SECTS) {
      const [existing] = await this.ctx.database.get('xiuxian_sect', { sectName: preset.name })
      if (existing) continue
      await this.ctx.database.create('xiuxian_sect', {
        sectName: preset.name,
        sectOwner: preset.sectOwner,
        sectScale: preset.sectScale,
        sectUsedStone: preset.sectUsedStone,
        sectFairyland: preset.sectFairyland,
        sectMaterials: preset.sectMaterials,
        mainBuff: preset.mainBuff,
        secBuff: preset.secBuff,
        elixirRoomLevel: preset.elixirRoomLevel,
      })
      this.ctx.logger('huaji-xiuxian').info('已创建预设宗门：%s', preset.name)
    }
  }

  async getSectByName(sectName: string): Promise<XiuxianSect | undefined> {
    const [sect] = await this.ctx.database.get('xiuxian_sect', { sectName })
    return sect
  }

  /** 按宗门名称加入（用于建号选择与常规加入） */
  async joinSectByName(userId: string, sectName: string): Promise<string> {
    const player = await this.getPlayer(userId)
    if (!player) return '修仙界没有道友的信息，请输入【我要修仙】加入！'
    if (player.sectId) return '道友已有宗门，请先【退出宗门】后再选择！'

    await this.ensurePresetSects()
    const preset = findPresetSect(sectName)
    if (!preset) {
      const names = PRESET_SECTS.map((s) => s.name).join('、')
      return `未找到宗门【${sectName.trim()}】，请从以下宗门中选择：\n${names}`
    }

    const sect = await this.getSectByName(preset.name)
    if (!sect) return '宗门数据异常，请联系管理员。'

    await this.ctx.database.set('xiuxian_player', { userId }, { sectId: sect.sectId, sectPosition: 4 })
    return `道友成功加入宗门【${sect.sectName}】，成为外门弟子！\n${preset.desc}`
  }

  async getSectById(sectId: number): Promise<XiuxianSect | undefined> {
    const [sect] = await this.ctx.database.get('xiuxian_sect', { sectId })
    return sect
  }

  async getSectByOwner(userId: string): Promise<XiuxianSect | undefined> {
    const [sect] = await this.ctx.database.get('xiuxian_sect', { sectOwner: userId })
    return sect
  }

  async createSect(userId: string, sectName: string): Promise<XiuxianSect> {
    return this.ctx.database.create('xiuxian_sect', { sectName, sectOwner: userId })
  }

  async getSectMembers(sectId: number): Promise<XiuxianPlayer[]> {
    return this.ctx.database.get('xiuxian_player', { sectId })
  }

  /** 宗门建设度排行榜 */
  async sectScaleTop(): Promise<XiuxianSect[]> {
    return this.ctx.database
      .select('xiuxian_sect')
      .orderBy('sectScale', 'desc')
      .limit(10)
      .execute()
  }
}
