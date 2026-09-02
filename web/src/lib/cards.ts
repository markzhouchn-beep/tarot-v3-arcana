// ============================================================
// lib/cards.ts · 卡牌路径常量（v3.0 复用 v2.0 牌图资源）
// 创建：2026-09-01
// ============================================================

const IMG_BASE = '/cards/rider-waite/';

/** 默认牌背（v2.0 复用 · 512×728 PNG RGBA） */
export const CARD_BACK_RARE_URL = `${IMG_BASE}card-back-rare.png`;

/** 主牌 22 张（文件名映射） */
export const MAJOR_ARCANA: Array<{ id: string; name: string; file: string }> = [
  { id: 'major_00', name: '愚者',     file: '00_Fool.jpg' },
  { id: 'major_01', name: '魔术师',   file: '01_Magician.jpg' },
  { id: 'major_02', name: '女祭司',   file: '02_High_Priestess.jpg' },
  { id: 'major_03', name: '皇后',     file: '03_Empress.jpg' },
  { id: 'major_04', name: '皇帝',     file: '04_Emperor.jpg' },
  { id: 'major_05', name: '教皇',     file: '05_Hierophant.jpg' },
  { id: 'major_06', name: '恋人',     file: '06_Lovers.jpg' },
  { id: 'major_07', name: '战车',     file: '07_Chariot.jpg' },
  { id: 'major_08', name: '力量',     file: '08_Strength.jpg' },
  { id: 'major_09', name: '隐士',     file: '09_Hermit.jpg' },
  { id: 'major_10', name: '命运之轮', file: '10_Wheel_of_Fortune.jpg' },
  { id: 'major_11', name: '正义',     file: '11_Justice.jpg' },
  { id: 'major_12', name: '倒吊人',   file: '12_Hanged_Man.jpg' },
  { id: 'major_13', name: '死神',     file: '13_Death.jpg' },
  { id: 'major_14', name: '节制',     file: '14_Temperance.jpg' },
  { id: 'major_15', name: '恶魔',     file: '15_Devil.jpg' },
  { id: 'major_16', name: '塔',       file: '16_Tower.jpg' },
  { id: 'major_17', name: '星星',     file: '17_Star.jpg' },
  { id: 'major_18', name: '月亮',     file: '18_Moon.jpg' },
  { id: 'major_19', name: '太阳',     file: '19_Sun.jpg' },
  { id: 'major_20', name: '审判',     file: '20_Judgement.jpg' },
  { id: 'major_21', name: '世界',     file: '21_World.jpg' },
];

/** 完整牌图 URL */
export function cardImageUrl(file: string): string {
  return `${IMG_BASE}${file}`;
}

/** 后端知识库牌 ID → v3.0 牌面图 URL */
export function cardImageById(id: string): string {
  const m = MAJOR_ARCANA.find(c => c.id === id);
  if (m) return cardImageUrl(m.file);
  // 小阿尔克那：尝试直接用 id 作为文件名（Phase 1 后端知识库充实）
  return cardImageUrl(id + '.jpg');
}

/** 是否是数字 ID（用于 fallback） */
export function isNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}
