"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESET_SECTS = void 0;
exports.formatSectRegisterPrompt = formatSectRegisterPrompt;
exports.formatPresetSectList = formatPresetSectList;
exports.findPresetSect = findPresetSect;
/** 四大预设宗门，参数按宗门特色写死 */
exports.PRESET_SECTS = [
    {
        name: '青冥剑宗',
        desc: '执掌山岳剑道，弟子以青锋悟道，行侠于群山险峰。',
        sectOwner: 'system',
        sectScale: 5200000,
        sectUsedStone: 680000,
        sectFairyland: 2,
        sectMaterials: 95000,
        mainBuff: 0,
        secBuff: 0,
        elixirRoomLevel: 2,
    },
    {
        name: '玄水灵府',
        desc: '栖身渊泽秘境，专修水系灵法，掌河湖水系灵力。',
        sectOwner: 'system',
        sectScale: 4800000,
        sectUsedStone: 920000,
        sectFairyland: 4,
        sectMaterials: 160000,
        mainBuff: 0,
        secBuff: 0,
        elixirRoomLevel: 3,
    },
    {
        name: '赤焰焚天阁',
        desc: '扎根火山腹地，擅烈焰神通，性情刚烈杀伐果断。',
        sectOwner: 'system',
        sectScale: 6500000,
        sectUsedStone: 540000,
        sectFairyland: 1,
        sectMaterials: 78000,
        mainBuff: 0,
        secBuff: 0,
        elixirRoomLevel: 2,
    },
    {
        name: '厚土万岳门',
        desc: '安居荒原巨岩，修炼固本土功，镇守大地疆隅。',
        sectOwner: 'system',
        sectScale: 8800000,
        sectUsedStone: 1100000,
        sectFairyland: 2,
        sectMaterials: 220000,
        mainBuff: 0,
        secBuff: 0,
        elixirRoomLevel: 1,
    },
];
const REGISTER_PROMPT = [
    '',
    '—— 仙途归属 ——',
    '回复【加入宗门】查看四大宗门并择一而入；',
    '回复【成为散修】则暂不加入宗门，日后可自行创建或加入。',
].join('\n');
function formatSectRegisterPrompt() {
    return REGISTER_PROMPT;
}
function formatPresetSectList() {
    const lines = ['可选宗门如下，请回复宗门全名加入：'];
    exports.PRESET_SECTS.forEach((s, i) => {
        lines.push(`${i + 1}. ${s.name}`);
        lines.push(`   ${s.desc}`);
    });
    return lines.join('\n');
}
/** 根据名称查找预设宗门（支持全名匹配） */
function findPresetSect(name) {
    const trimmed = name.trim();
    return exports.PRESET_SECTS.find((s) => s.name === trimmed);
}
//# sourceMappingURL=preset-sects.js.map