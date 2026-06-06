"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SECT_MISSION_CD_SECONDS = exports.SECT_MISSIONS = void 0;
exports.pickRandomMission = pickRandomMission;
exports.getMissionById = getMissionById;
exports.rollMissionMonsterCount = rollMissionMonsterCount;
exports.generateMissionMonsters = generateMissionMonsters;
exports.fightMissionMonsters = fightMissionMonsters;
exports.calcMissionReward = calcMissionReward;
const utils_1 = require("./utils");
exports.SECT_MISSIONS = [
    {
        id: 1,
        text: '前往黑风山谷营救被困采药弟子，清除围困妖兽。',
        monsters: ['黑风狼', '雾影妖狐', '铁喙凶禽', '裂地岩精'],
    },
    {
        id: 2,
        text: '下山驰援边陲村落，祛除邪祟、救治染病村民。',
        monsters: ['游魂邪祟', '腐面怨灵', '血瞳鬼婴', '阴煞伥鬼'],
    },
    {
        id: 3,
        text: '深入雾瘴密林采摘凝露草，规避瘴气毒虫，集齐足量药材交付药堂。',
        monsters: ['瘴气毒蛛', '噬人花妖', '雾隐毒蛇', '腐木甲虫'],
    },
    {
        id: 4,
        text: '登临断崖峭壁寻觅赤焰花，小心崖间异兽，不得损毁药株根茎。',
        monsters: ['崖壁金雕', '赤尾火蜥', '断魂石猿', '悬巢妖蝠'],
    },
    {
        id: 5,
        text: '打理宗门灵田，引水施肥、除虫护苗，保障灵谷按期成熟收成。',
        monsters: ['噬苗蝗群', '泥沼水蛭', '偷粮鼠妖', '腐根虫母'],
    },
    {
        id: 6,
        text: '培育药圃珍稀幼苗，调控法阵灵气，按时巡查防范野兽啃食。',
        monsters: ['啃根獠猪', '踏阵野牛', '窃灵花魅', '破阵灰狼'],
    },
    {
        id: 7,
        text: '去往西郊荒林猎杀黑鬃灰狼，收集兽皮兽牙上交库房充作炼器原料。',
        monsters: ['黑鬃灰狼', '独眼狼王', '裂爪狼妖', '荒林狈精'],
    },
    {
        id: 8,
        text: '围剿湖边泛滥水兽，控制种群数量，带回妖兽内丹换取历练酬劳。',
        monsters: ['泛滥水鳄', '漩涡水蛇', '湖底蛟影', '吞浪巨龟'],
    },
];
exports.SECT_MISSION_CD_SECONDS = 12 * 60 * 60;
function pickRandomMission() {
    return exports.SECT_MISSIONS[(0, utils_1.randInt)(0, exports.SECT_MISSIONS.length - 1)];
}
function getMissionById(id) {
    return exports.SECT_MISSIONS.find((m) => m.id === id);
}
/** 妖兽数量：1 只 40%，2 只 30%，3 只 30% */
function rollMissionMonsterCount() {
    const roll = (0, utils_1.randInt)(1, 100);
    if (roll <= 40)
        return 1;
    if (roll <= 70)
        return 2;
    return 3;
}
/**
 * 生成妖兽：数量×单只属性总量约为玩家（气血+攻击）的 75% 左右。
 */
function generateMissionMonsters(mission, userHp, userAtk) {
    const count = rollMissionMonsterCount();
    const userPower = Math.max(userHp + userAtk, 10);
    const targetTotal = Math.floor(userPower * 0.75 * (0.92 + Math.random() * 0.16));
    const perMonster = Math.max(Math.floor(targetTotal / count), 1);
    const monsters = [];
    let allocated = 0;
    for (let i = 0; i < count; i++) {
        const isLast = i === count - 1;
        const share = isLast ? Math.max(targetTotal - allocated, 1) : perMonster;
        allocated += share;
        const hpRatio = 0.55 + Math.random() * 0.15;
        const hp = Math.max(Math.floor(share * hpRatio), 1);
        const atk = Math.max(share - hp, 1);
        monsters.push({
            name: (0, utils_1.randChoice)(mission.monsters),
            hp,
            atk,
        });
    }
    return monsters;
}
/** 连续挑战多只妖兽，玩家气血在战斗间继承 */
function fightMissionMonsters(player, monsters, fight) {
    const log = [];
    let current = { ...player, hp: Math.max(player.hp, 1) };
    const initialMonsterHp = [];
    for (let i = 0; i < monsters.length; i++) {
        const m = monsters[i];
        initialMonsterHp.push(m.hp);
        const foe = {
            userId: `sect_monster_${i}`,
            name: m.name,
            hp: m.hp,
            atk: m.atk,
            mp: 0,
            crit: 0,
            critDamage: 1.5,
            defense: 0,
        };
        log.push(`——第${i + 1}战：${m.name}（气血${m.hp}，攻击${m.atk}）——`);
        const [roundLog, victor, finalHp] = fight(current, foe);
        log.push(...roundLog);
        if (victor !== player.name) {
            return { log, won: false, remainingHp: Math.max(finalHp[player.userId], 0), initialMonsterHp };
        }
        current = { ...current, hp: Math.max(finalHp[player.userId], 1) };
    }
    return { log, won: true, remainingHp: current.hp, initialMonsterHp };
}
/** 任务酬劳：各妖兽初始气血之和 × 0.1 × 妖兽数量（按需求公式） */
function calcMissionReward(initialMonsterHp) {
    const count = initialMonsterHp.length;
    if (!count)
        return 0;
    const totalHp = initialMonsterHp.reduce((sum, hp) => sum + hp, 0);
    return Math.floor(totalHp * 0.1 * count);
}
//# sourceMappingURL=sect-missions.js.map