// ============================================================
// lib/tarot-knowledge.js · 78 张塔罗牌意库
// 创建：2026-09-01 · 完整 78 张牌意数据（凌晨补完，2026-09-02 02:50）
//
// 22 大阿卡纳 + 56 小阿卡纳 = 完整 78 张
// 数据格式：{ id, name_cn, name_en, suit, number, keywords_up, keywords_down, energy_up, energy_down }
// ============================================================

// 22 大阿卡纳
const MAJOR_ARCANA = [
  { id: 'ar00', name_cn: '愚者', name_en: 'The Fool', suit: 'major', number: 0,
    keywords_up: ['新开始', '纯真', '冒险', '自由', '潜能'],
    keywords_down: ['鲁莽', '天真', '犹豫不决', '失去方向'],
    energy_up: '一段全新旅程即将开启，带着无限可能。勇敢迈出第一步。',
    energy_down: '当前缺乏方向感，需要先停下来想清楚再行动。' },
  { id: 'ar01', name_cn: '魔术师', name_en: 'The Magician', suit: 'major', number: 1,
    keywords_up: ['创造力', '技能', '专注', '显化', '意志力'],
    keywords_down: ['操控', '欺骗', '未发挥潜力', '自我怀疑'],
    energy_up: '你拥有实现目标的所有资源，关键在于专注。',
    energy_down: '注意是否在用技巧回避真正的核心问题，或才能未发挥。' },
  { id: 'ar02', name_cn: '女祭司', name_en: 'The High Priestess', suit: 'major', number: 2,
    keywords_up: ['直觉', '潜意识', '神秘', '智慧', '内在声音'],
    keywords_down: ['沉默', '疏离', '忽略直觉', '隐秘动机'],
    energy_up: '倾听你内心已经知道但尚未说出口的答案。',
    energy_down: '你可能忽视了重要的内在信号，值得慢下来感受。' },
  { id: 'ar03', name_cn: '皇后', name_en: 'The Empress', suit: 'major', number: 3,
    keywords_up: ['丰盛', '母性', '创造', '感官', '自然'],
    keywords_down: ['过度', '依赖', '创造力受阻', '情感窒息'],
    energy_up: '丰盈的能量正在涌现，无论是关系、事业还是身体层面的滋养。',
    energy_down: '可能在某段关系中过度付出，需要重新找回自己的中心。' },
  { id: 'ar04', name_cn: '皇帝', name_en: 'The Emperor', suit: 'major', number: 4,
    keywords_up: ['权威', '结构', '稳定', '领导力', '纪律'],
    keywords_down: ['专制', '僵化', '控制欲', '缺乏纪律'],
    energy_up: '建立清晰的边界和结构会让你更有力量。',
    energy_down: '可能在某段关系或工作中感到被过度控制。' },
  { id: 'ar05', name_cn: '教皇', name_en: 'The Hierophant', suit: 'major', number: 5,
    keywords_up: ['传统', '教导', '信念', '群体', '精神指引'],
    keywords_down: ['教条', '反叛', '虚伪', '形式主义'],
    energy_up: '向有经验的人请教，会得到超出预期的答案。',
    energy_down: '可能在被过时的规则束缚，值得问自己「这真的适合我吗？」' },
  { id: 'ar06', name_cn: '恋人', name_en: 'The Lovers', suit: 'major', number: 6,
    keywords_up: ['爱', '和谐', '关系', '选择', '价值观'],
    keywords_down: ['失衡', '错误选择', '冲突', '价值冲突'],
    energy_up: '一个重要的关系或选择正在浮现，跟随内心的真实。',
    energy_down: '可能在关系中感到两难，需要重新对齐核心价值观。' },
  { id: 'ar07', name_cn: '战车', name_en: 'The Chariot', suit: 'major', number: 7,
    keywords_up: ['意志力', '胜利', '决心', '方向', '突破'],
    keywords_down: ['失控', '失去方向', '对立', '侵略性'],
    energy_up: '集中意志力，朝着明确方向前进，会突破关键障碍。',
    energy_down: '可能在多个方向上拉扯，需要先决定优先级。' },
  { id: 'ar08', name_cn: '力量', name_en: 'Strength', suit: 'major', number: 8,
    keywords_up: ['内在力量', '勇气', '耐心', '柔中带刚', '同理心'],
    keywords_down: ['软弱', '怀疑', '失去信心', '压抑情绪'],
    energy_up: '真正的力量来自温柔的坚持，不是强迫。',
    energy_down: '你可能对自己太苛刻，需要更多的自我接纳。' },
  { id: 'ar09', name_cn: '隐士', name_en: 'The Hermit', suit: 'major', number: 9,
    keywords_up: ['内省', '独处', '智慧', '寻找真理', '导师'],
    keywords_down: ['孤立', '逃避', '过度封闭', '拒绝指引'],
    energy_up: '退后一步独处反思，会得到更清晰的答案。',
    energy_down: '孤独可能是逃避的借口，需要重新连接外界。' },
  { id: 'ar10', name_cn: '命运之轮', name_en: 'Wheel of Fortune', suit: 'major', number: 10,
    keywords_up: ['转变', '循环', '机遇', '命运', '突破'],
    keywords_down: ['不顺', '停滞', '抗拒变化', '坏运气'],
    energy_up: '命运之轮正在转动，重要的机遇即将到来。',
    energy_down: '当前可能在低潮期，但轮子会再次上升——挺住。' },
  { id: 'ar11', name_cn: '正义', name_en: 'Justice', suit: 'major', number: 11,
    keywords_up: ['公正', '真相', '因果', '责任', '清晰'],
    keywords_down: ['不公', '推卸责任', '失衡', '判断失误'],
    energy_up: '诚实地面对自己和他人，会得到公正的答案。',
    energy_down: '可能在某件事上有失衡，需要重新评估。' },
  { id: 'ar12', name_cn: '倒吊人', name_en: 'The Hanged Man', suit: 'major', number: 12,
    keywords_up: ['放手', '新视角', '暂停', '牺牲', '顿悟'],
    keywords_down: ['停滞', '抗拒', '无谓牺牲', '拖延'],
    energy_up: '换个角度看待困境，会看到原本没看到的出路。',
    energy_down: '你可能在用错误的方式坚持，是时候松手了。' },
  { id: 'ar13', name_cn: '死神', name_en: 'Death', suit: 'major', number: 13,
    keywords_up: ['结束', '转化', '新生', '蜕变', '放下'],
    keywords_down: ['抗拒变化', '停滞', '恐惧', '拖延死亡'],
    energy_up: '一段重要章节正在结束，为全新的开始让路。',
    energy_down: '你可能在抗拒必要的告别，会让自己持续痛苦。' },
  { id: 'ar14', name_cn: '节制', name_en: 'Temperance', suit: 'major', number: 14,
    keywords_up: ['平衡', '耐心', '调和', '中庸', '身心整合'],
    keywords_down: ['失衡', '极端', '缺乏耐心', '不协调'],
    energy_up: '在不极端的道路上稳步前进，会带来最深的结果。',
    energy_down: '生活中某些方面过度或不足，需要重新平衡。' },
  { id: 'ar15', name_cn: '恶魔', name_en: 'The Devil', suit: 'major', number: 15,
    keywords_up: ['束缚', '诱惑', '执念', '阴影', '物质主义'],
    keywords_down: ['解脱', '觉醒', '打破束缚', '看清真相'],
    energy_up: '看清是什么在束缚你——多数锁链都是自己造的。',
    energy_down: '你正在从某些执念或束缚中走出来，值得庆祝。' },
  { id: 'ar16', name_cn: '塔', name_en: 'The Tower', suit: 'major', number: 16,
    keywords_up: ['突变', '崩塌', '真相', '解放', '重建'],
    keywords_down: ['抗拒崩塌', '延迟的危机', '灾难恐惧', '勉强维持'],
    energy_up: '一次突然的崩塌正在清空不再适合你的结构。',
    energy_down: '可能在勉强维持已经不可持续的局面。' },
  { id: 'ar17', name_cn: '星星', name_en: 'The Star', suit: 'major', number: 17,
    keywords_up: ['希望', '灵感', '治愈', '宁静', '信念'],
    keywords_down: ['失望', '绝望', '失去信念', '断联'],
    energy_up: '最黑暗的时刻已经过去，新的希望正在升起。',
    energy_down: '你暂时与自己的希望断联了，但它们还在。' },
  { id: 'ar18', name_cn: '月亮', name_en: 'The Moon', suit: 'major', number: 18,
    keywords_up: ['幻象', '潜意识', '不安', '直觉', '梦境'],
    keywords_down: ['释放恐惧', '真相浮现', '走出迷雾', '清晰'],
    energy_up: '目前看不清全貌，不必急——迷雾会逐渐散去。',
    energy_down: '你正在走出迷茫，越来越看清事实。' },
  { id: 'ar19', name_cn: '太阳', name_en: 'The Sun', suit: 'major', number: 19,
    keywords_up: ['成功', '喜悦', '活力', '清晰', '丰盛'],
    keywords_down: ['暂时的阴霾', '过度乐观', '倦怠', '被忽视'],
    energy_up: '光明、能量和成功正在包围你，享受这份喜悦。',
    energy_down: '你可能暂时看不到光，但它从未消失。' },
  { id: 'ar20', name_cn: '审判', name_en: 'Judgement', suit: 'major', number: 20,
    keywords_up: ['觉醒', '重生', '召唤', '原谅', '反思'],
    keywords_down: ['自我批判', '忽视召唤', '无法原谅', '沉溺过去'],
    energy_up: '一个深刻的觉醒正在发生，回应内心的召唤。',
    energy_down: '你可能在用过去批判自己，是时候放下了。' },
  { id: 'ar21', name_cn: '世界', name_en: 'The World', suit: 'major', number: 21,
    keywords_up: ['完成', '圆满', '整合', '成就', '新循环'],
    keywords_down: ['未完成', '拖延收尾', '缺乏闭合', '停滞'],
    energy_up: '一个重要循环即将圆满，准备好进入下一个阶段。',
    energy_down: '某些事需要你画上句号，才能真正向前。' },
];

// 56 小阿卡纳（4 个 suit × 14 张：1-10 + 侍从/骑士/王后/国王）
const SUITS_DATA = {
  wands: { name_cn: '权杖', theme: '行动、热情、创造力', emoji: '🔥' },
  cups: { name_cn: '圣杯', theme: '情感、关系、直觉', emoji: '💧' },
  swords: { name_cn: '宝剑', theme: '思想、沟通、冲突', emoji: '⚔️' },
  pentacles: { name_cn: '星币', theme: '物质、工作、健康', emoji: '🌍' },
};

function generateMinorArcana(suitKey, suitInfo, baseKeywords) {
  const cards = [];
  // 1-10
  const numbers = [
    { n: 1, cn: 'Ace', kw_up: ['新开始', '潜力', baseKeywords[0]], kw_down: ['延迟', '错失', '犹豫'] },
    { n: 2, cn: '二', kw_up: ['平衡', '选择', baseKeywords[1]], kw_down: ['失衡', '逃避', '纠结'] },
    { n: 3, cn: '三', kw_up: ['成长', '扩展', baseKeywords[2]], kw_down: ['过度', '分散', '停滞'] },
    { n: 4, cn: '四', kw_up: ['稳定', '基础', baseKeywords[3]], kw_down: ['僵化', '停滞', '无聊'] },
    { n: 5, cn: '五', kw_up: ['挑战', '冲突', baseKeywords[4]], kw_down: ['恢复', '和解', '危机化解'] },
    { n: 6, cn: '六', kw_up: ['和谐', '过渡', '胜利'], kw_down: ['停滞', '怀旧', '拒绝前进'] },
    { n: 7, cn: '七', kw_up: ['坚持', '评估', '策略'], kw_down: ['放弃', '欺骗', '失策'] },
    { n: 8, cn: '八', kw_up: ['行动', '快速', '讯息'], kw_down: ['混乱', '延误', '干扰'] },
    { n: 9, cn: '九', kw_up: ['丰收', '成就', '警觉'], kw_down: ['焦虑', '失去', '过忧'] },
    { n: 10, cn: '十', kw_up: ['完成', '圆满', '负担'], kw_down: ['解脱', '新开始', '放下'] },
  ];
  for (const n of numbers) {
    cards.push({
      id: `${suitKey}_${String(n.n).padStart(2, '0')}`,
      name_cn: `${suitInfo.name_cn}${n.cn}`,
      name_en: `${n.cn} of ${suitKey.charAt(0).toUpperCase() + suitKey.slice(1)}`,
      suit: suitKey,
      number: n.n,
      keywords_up: n.kw_up,
      keywords_down: n.kw_down,
      energy_up: `${suitInfo.theme}方面的新阶段即将到来。`,
      energy_down: `${suitInfo.theme}方面需要重新评估和调整。`,
    });
  }
  // 侍从/骑士/王后/国王
  const courts = [
    { n: 11, cn: '侍从', kw_up: ['学习', '好奇', '新讯息'], kw_down: ['不成熟', '分心', '肤浅'] },
    { n: 12, cn: '骑士', kw_up: ['行动', '冒险', '前进'], kw_down: ['鲁莽', '冲动', '延迟'] },
    { n: 13, cn: '王后', kw_up: ['成熟', '滋养', '直觉'], kw_down: ['依赖', '情绪化', '过度保护'] },
    { n: 14, cn: '国王', kw_up: ['权威', '掌控', '稳定'], kw_down: ['专制', '僵化', '冷漠'] },
  ];
  for (const c of courts) {
    cards.push({
      id: `${suitKey}_${String(c.n).padStart(2, '0')}`,
      name_cn: `${suitInfo.name_cn}${c.cn}`,
      name_en: `${c.cn} of ${suitKey.charAt(0).toUpperCase() + suitKey.slice(1)}`,
      suit: suitKey,
      number: c.n,
      keywords_up: c.kw_up,
      keywords_down: c.kw_down,
      energy_up: `${suitInfo.theme}方面的成熟能量正在指引你。`,
      energy_down: `${suitInfo.theme}方面需要更多内在功课。`,
    });
  }
  return cards;
}

const MINOR_ARCANA = [
  ...generateMinorArcana('wands', SUITS_DATA.wands, ['灵感', '选择', '扩展', '基础', '冲突']),
  ...generateMinorArcana('cups', SUITS_DATA.cups, ['情感', '伙伴', '庆祝', '冥想', '失落']),
  ...generateMinorArcana('swords', SUITS_DATA.swords, ['突破', '联盟', '伤痛', '休息', '冲突']),
  ...generateMinorArcana('pentacles', SUITS_DATA.pentacles, ['机会', '波动', '技艺', '占有', '焦虑']),
];

const TAROT_DECK = [...MAJOR_ARCANA, ...MINOR_ARCANA];

/**
 * 随机抽 N 张牌（不重复）
 * @param {number} count
 * @param {boolean} allowReverse - 是否允许逆位
 * @returns {Array}
 */
export function drawCards(count, allowReverse = true) {
  // Fisher-Yates 洗牌（保证均匀分布）
  // Array.sort(() => Math.random() - 0.5) 是经典错误：现代浏览器（V8 11+）对短数组使用 TimSort，
  // 比较函数返回值会被忽略，导致分布严重不均，某些牌永远抽不到
  const shuffled = [...TAROT_DECK];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = shuffled.slice(0, Math.min(count, shuffled.length));

  return picked.map((card, i) => ({
    id: card.id,
    name: card.name_cn,
    name_en: card.name_en,
    suit: card.suit,
    number: card.number,
    orientation: allowReverse && Math.random() < 0.3 ? 'reversed' : 'upright',
    position: `位置 ${i + 1}`,
    keywords_up: card.keywords_up,
    keywords_down: card.keywords_down,
    energy_up: card.energy_up,
    energy_down: card.energy_down,
  }));
}

/**
 * Yes/No 映射（不调 AI，从牌意库直接拼装）
 */
export function inferYesNo(card) {
  // 简化规则：大阿卡纳奇数编号 + 权杖系列 → 是
  // 大阿卡纳偶数编号 + 圣杯系列 → 否
  // 宝剑 → 不确定
  // 星币 → 视情况
  if (card.suit === 'major') {
    return card.number % 2 === 1 ? '是' : '否';
  }
  if (card.suit === 'wands') return '是';
  if (card.suit === 'cups') return '否';
  if (card.suit === 'swords') return '不确定';
  if (card.suit === 'pentacles') return '视情况而定';
  return '不确定';
}

export const DECK_SIZE = 78;
export const MAJOR_ARCANA_COUNT = 22;
export const MINOR_ARCANA_COUNT = 56;

export default {
  drawCards,
  inferYesNo,
  DECK_SIZE,
};