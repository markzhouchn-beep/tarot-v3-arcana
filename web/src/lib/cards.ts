// ============================================================
// lib/cards.ts · 卡牌路径常量（v3.0 复用 v2.0 牌图资源）
// 创建：2026-09-01 · 重写 2026-09-03 17:55（修 ID 映射）
//
// 后端 ID → 文件名映射：
// - 大阿：ar00-ar21 → 00_Fool.jpg - 21_World.jpg
// - 小阿：wands_NN → WandsNN.jpg（Cups/Swords/Pentacles 同理）
// ============================================================

const IMG_BASE = '/cards/rider-waite/';

/** 默认牌背（v2.0 复用 · 512×728 PNG RGBA） */
export const CARD_BACK_RARE_URL = `${IMG_BASE}card-back-rare.png`;

/** 大阿尔克那（22 张）：id=arNN → 文件=NN_Name.jpg */
const MAJOR_NAMES_EN: Record<number, string> = {
  0: 'Fool', 1: 'Magician', 2: 'High_Priestess', 3: 'Empress', 4: 'Emperor',
  5: 'Hierophant', 6: 'Lovers', 7: 'Chariot', 8: 'Strength', 9: 'Hermit',
  10: 'Wheel_of_Fortune', 11: 'Justice', 12: 'Hanged_Man', 13: 'Death',
  14: 'Temperance', 15: 'Devil', 16: 'Tower', 17: 'Star', 18: 'Moon',
  19: 'Sun', 20: 'Judgement', 21: 'World',
};

const SUIT_NAMES_EN: Record<string, string> = {
  wands: 'Wands',
  cups: 'Cups',
  swords: 'Swords',
  pentacles: 'Pentacles',
};

/**
 * 后端知识库牌 ID → v3.0 牌面图 URL
 * - ar00 → 00_Fool.jpg
 * - ar10 → 10_Wheel_of_Fortune.jpg
 * - wands_07 → Wands07.jpg
 * - cups_13 → Cups13.jpg
 */
export function cardImageById(id: string): string {
  if (!id) return '';

  // 大阿：arNN → NN_Name.jpg
  if (id.startsWith('ar')) {
    const num = parseInt(id.slice(2), 10);
    if (!isNaN(num) && MAJOR_NAMES_EN[num]) {
      const fileName = `${String(num).padStart(2, '0')}_${MAJOR_NAMES_EN[num]}.jpg`;
      return `${IMG_BASE}${fileName}`;
    }
  }

  // 小阿：suit_NN → SuitNN.jpg
  const match = id.match(/^(wands|cups|swords|pentacles)_(\d+)$/);
  if (match) {
    const [, suit, num] = match;
    const suitCap = SUIT_NAMES_EN[suit];
    if (suitCap) {
      return `${IMG_BASE}${suitCap}${num.padStart(2, '0')}.jpg`;
    }
  }

  // 兼容老 ID：major_00、major_01...
  if (id.startsWith('major_')) {
    const num = parseInt(id.slice(6), 10);
    if (!isNaN(num) && MAJOR_NAMES_EN[num]) {
      const fileName = `${String(num).padStart(2, '0')}_${MAJOR_NAMES_EN[num]}.jpg`;
      return `${IMG_BASE}${fileName}`;
    }
  }

  // 兜底：原 ID
  return `${IMG_BASE}${id}.jpg`;
}

/** 完整牌图 URL（外部传入文件名） */
export function cardImageUrl(file: string): string {
  return `${IMG_BASE}${file}`;
}

/** 是否是数字 ID（用于 fallback） */
export function isNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}

// 兼容导出（老代码可能用到）
export const MAJOR_ARCANA: Array<{ id: string; name: string; file: string }> = Object.entries(MAJOR_NAMES_EN).map(
  ([num, nameEn]) => ({
    id: `ar${num}`,
    name: nameEn,
    file: `${String(num).padStart(2, '0')}_${nameEn}.jpg`,
  })
);