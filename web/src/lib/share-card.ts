// ============================================================
// lib/share-card.ts · 海报生成（纯 Canvas API）
// v3.0.3：修复 3 个模板压字/牌图不显示/无效圆环问题
// ============================================================

export interface ShareCardCard {
  id: string;
  name: string;
  orientation: 'upright' | 'reversed';
  position?: string;
  imageUrl?: string;
}

export interface ShareCardData {
  siteName: string;
  siteUrl: string;
  spreadName: string;
  theme: 'love' | 'career' | 'money' | 'self';
  cards: ShareCardCard[];
  question: string;
  goldenPhrase: string;
  briefAnswer: string;
  atmosphere: string;
  cardName?: string;
  summary?: string;
  sectionTitle?: string;
}

// 品牌色
const T = {
  bg: '#0d0b14',
  bgGrad: '#1a1428',
  gold: '#c9a96e',
  goldSoft: '#e6c890',
  text: '#f0eadf',
  textFaint: '#a89a82',
  line: '#3a2f4f',
};

const W = 1080;
const H = 1920;

// === 工具函数 ===

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawBaseBackground(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, T.bg);
  grad.addColorStop(0.5, T.bgGrad);
  grad.addColorStop(1, T.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 四角装饰边框
  ctx.strokeStyle = T.gold;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  drawCorner(ctx, 60, 60);
  drawCorner(ctx, W - 60, 60, true);
  drawCorner(ctx, 60, H - 60, false, true);
  drawCorner(ctx, W - 60, H - 60, true, true);
}

function drawCorner(ctx: CanvasRenderingContext2D, x: number, y: number, flipX = false, flipY = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.strokeStyle = T.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.lineTo(0, 0);
  ctx.lineTo(30, 0);
  ctx.stroke();
  ctx.fillStyle = T.gold;
  ctx.beginPath();
  ctx.arc(8, 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDivider(ctx: CanvasRenderingContext2D, cx: number, cy: number, w = 2) {
  ctx.strokeStyle = T.gold;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(cx - 80, cy);
  ctx.lineTo(cx + 80, cy);
  ctx.stroke();
  ctx.fillStyle = T.gold;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawStars(ctx: CanvasRenderingContext2D, count = 25) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() * 1.5 + 0.3;
    ctx.fillStyle = `rgba(201, 169, 110, ${Math.random() * 0.35 + 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 自动换行文字渲染
 * @returns 文字块底部 y 坐标
 */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  align: CanvasTextAlign = 'center'
): number {
  ctx.textAlign = align;
  const chars = text.split('');
  const lines: string[] = [];
  let current = '';
  for (const ch of chars) {
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  let y = startY;
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += lineHeight;
  }
  return y; // 返回文字块底部 y（不含额外间距）
}

/**
 * 渲染一组牌（最多 n 张，超出部分截断）
 * @param maxCards 最多渲染几张牌，默认全部
 * @returns 牌阵底部 y 坐标
 */
async function drawCardGrid(
  ctx: CanvasRenderingContext2D,
  cards: ShareCardCard[],
  cx: number,
  startY: number,
  maxWidth: number,
  maxCards?: number
): Promise<number> {
  const display = maxCards ? cards.slice(0, maxCards) : cards;
  const n = display.length;
  if (n === 0) return startY;

  // 根据数量确定尺寸和列数
  let cols: number, cardW: number, cardH: number, gap: number;
  if (n === 1) {
    cols = 1; cardW = 240; cardH = 370; gap = 0;
  } else if (n === 2) {
    cols = 2; cardW = 210; cardH = 325; gap = 20;
  } else if (n === 3) {
    cols = 3; cardW = 200; cardH = 310; gap = 16;
  } else if (n <= 5) {
    cols = Math.min(n, 3);
    cardW = 180; cardH = 280; gap = 12;
  } else {
    cols = 4; cardW = 150; cardH = 230; gap = 10;
  }

  const rows = Math.ceil(n / cols);
  // 每行高度 = 牌高度 + 牌名(20) + 正逆(18) + 间距(14)
  const rowH = cardH + 52;
  const labelGap = 14; // 行之间的额外间距

  // 预加载所有牌图
  const imgs = await Promise.all(display.map(c => c.imageUrl ? loadImage(c.imageUrl) : Promise.resolve(null)));

  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    // 计算当前行实际列数（最后一行可能不满）
    const inRow = Math.min(n - row * cols, cols);
    const rowWidth = inRow * cardW + (inRow - 1) * gap;
    const x0 = cx - rowWidth / 2;
    const cardX = x0 + col * (cardW + gap);
    const cardY = startY + row * (rowH + labelGap);

    const card = display[i];
    const img = imgs[i];

    // 牌图
    if (img) {
      const drawW = cardW, drawH = cardH;
      if (card.orientation === 'reversed') {
        ctx.save();
        ctx.translate(cardX + drawW / 2, cardY + drawH / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      } else {
        ctx.drawImage(img, cardX, cardY, drawW, drawH);
      }
    } else {
      // 占位
      ctx.fillStyle = T.bgGrad;
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = T.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(cardX, cardY, cardW, cardH);
      ctx.fillStyle = T.goldSoft;
      ctx.font = '500 36px serif';
      ctx.textAlign = 'center';
      ctx.fillText('✦', cardX + cardW / 2, cardY + cardH / 2 + 12);
    }

    // 边框
    ctx.strokeStyle = T.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    // 牌名
    ctx.fillStyle = T.text;
    ctx.font = '500 20px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.name, cardX + cardW / 2, cardY + cardH + 22);

    // 正/逆
    ctx.fillStyle = T.textFaint;
    ctx.font = '400 15px sans-serif';
    ctx.fillText(card.orientation === 'reversed' ? '逆位' : '正位', cardX + cardW / 2, cardY + cardH + 42);
  }

  return startY + rows * (rowH + labelGap) - labelGap;
}

// === 通用 header ===

function drawHeader(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  ctx.fillStyle = T.gold;
  ctx.font = '700 44px "PingFang SC", "Noto Sans CJK SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('塔罗匣 Arcana Box', W / 2, 120);

  ctx.fillStyle = T.textFaint;
  ctx.font = '400 20px sans-serif';
  ctx.fillText(d.siteUrl, W / 2, 158);

  drawDivider(ctx, W / 2, 196, 1.5);
}

function drawFooter(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  const y = H - 100;
  drawDivider(ctx, W / 2, y - 20, 1.5);

  ctx.fillStyle = T.gold;
  ctx.font = '600 34px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('塔罗匣 Arcana Box', W / 2, y + 30);

  ctx.fillStyle = T.textFaint;
  ctx.font = '400 20px sans-serif';
  ctx.fillText(`tarotbox.cn`, W / 2, y + 58);
}

// ============================================================
// 模板 1：金句型
// 布局：品牌 → 问题 → 金句 → 答案 → 牌阵 → 氛围 → footer
// ============================================================
async function drawQuoteTemplate(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  drawBaseBackground(ctx);
  drawStars(ctx, 20);
  drawHeader(ctx, d);

  let y = 240;

  // 问题（小字标签 + 内容）
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 22px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('— 你问的 —', W / 2, y);
  y += 30;
  ctx.fillStyle = T.text;
  ctx.font = '500 30px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, `"${d.question.slice(0, 60)}"`, W / 2, y, 880, 46);

  y += 20;
  drawDivider(ctx, W / 2, y, 1);
  y += 24;

  // 金句标签
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 24px "Noto Serif SC", serif';
  ctx.fillText('✦  金  句  ✦', W / 2, y);
  y += 36;

  // 金句主体（最大字号）
  ctx.fillStyle = T.text;
  ctx.font = '600 54px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, `"${d.goldenPhrase || d.summary || '每张牌都是一面镜子'}".slice(0, 80)`, W / 2, y, 920, 82);

  y += 16;

  // 简短答案
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 28px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, `— ${(d.briefAnswer || '').slice(0, 60)}`, W / 2, y, 880, 44);

  y += 16;
  drawDivider(ctx, W / 2, y, 1);
  y += 24;

  // 牌阵（最多 5 张，留足空间）
  const displayCards = d.cards.slice(0, 5);
  y = await drawCardGrid(ctx, displayCards, W / 2, y, 940, 5);

  y += 16;

  // 氛围
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 22px "Noto Serif SC", serif';
  ctx.fillText('— 整体氛围 —', W / 2, y);
  y += 30;
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 26px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, d.atmosphere.slice(0, 80) || '温柔而坚定的能量在场', W / 2, y, 880, 42);

  drawFooter(ctx, d);
}

// ============================================================
// 模板 2：问题型
// 布局：品牌 → 牌阵 → 问题 → 金句 → footer
// ============================================================
async function drawQuestionTemplate(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  drawBaseBackground(ctx);
  drawStars(ctx, 20);
  drawHeader(ctx, d);

  let y = 240;

  // 牌阵（最多 10 张）
  const displayCards = d.cards.slice(0, 10);
  y = await drawCardGrid(ctx, displayCards, W / 2, y, 940);

  y += 20;
  drawDivider(ctx, W / 2, y, 1);
  y += 24;

  // 问题
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 22px "Noto Serif SC", serif';
  ctx.fillText('— 你问的 —', W / 2, y);
  y += 30;
  ctx.fillStyle = T.text;
  ctx.font = '700 46px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, `"${d.question.slice(0, 50)}${d.question.length > 50 ? '…' : ''}"`, W / 2, y, 880, 68);

  y += 16;

  // 金句
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 26px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, (d.goldenPhrase || d.summary || '').slice(0, 80), W / 2, y, 880, 42);

  y += 16;

  // 氛围（小字）
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 22px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, `氛围：${(d.atmosphere || '').slice(0, 60)}`, W / 2, y, 880, 36);

  drawFooter(ctx, d);
}

// ============================================================
// 模板 3：氛围型
// 布局：品牌 → 主牌 + 牌名 → 氛围 → 金句 → 问题 → footer
// ============================================================
async function drawMoodTemplate(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  drawBaseBackground(ctx);
  drawStars(ctx, 30);

  // 品牌（顶部）
  ctx.fillStyle = T.gold;
  ctx.font = '700 44px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('塔罗匣 Arcana Box', W / 2, 120);

  ctx.fillStyle = T.textFaint;
  ctx.font = '400 20px sans-serif';
  ctx.fillText(d.siteUrl, W / 2, 158);

  drawDivider(ctx, W / 2, 196, 1.5);

  const mainCard = d.cards[0];

  // 主牌展示区（居中偏上）
  const cardCenterX = W / 2;
  const cardTop = 240;
  const cardW = 240;
  const cardH = 370;
  const cardLeft = cardCenterX - cardW / 2;

  if (mainCard?.imageUrl) {
    const img = await loadImage(mainCard.imageUrl);
    if (img) {
      ctx.save();
      if (mainCard.orientation === 'reversed') {
        ctx.translate(cardCenterX, cardTop + cardH / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(img, -cardW / 2, -cardH / 2, cardW, cardH);
      } else {
        ctx.drawImage(img, cardLeft, cardTop, cardW, cardH);
      }
      ctx.restore();
      ctx.strokeStyle = T.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(cardLeft, cardTop, cardW, cardH);
    } else {
      drawCardPlaceholder(ctx, cardLeft, cardTop, cardW, cardH);
    }
  } else {
    drawCardPlaceholder(ctx, cardLeft, cardTop, cardW, cardH);
  }

  let y = cardTop + cardH;

  // 牌名（大字）
  ctx.fillStyle = T.gold;
  ctx.font = '700 58px "Cormorant Garamond", serif';
  ctx.textAlign = 'center';
  ctx.fillText(mainCard?.name || d.cardName || '愚者', W / 2, y + 50);

  // 牌阵 + 正逆
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 28px "Cormorant Garamond", serif';
  ctx.fillText(`${d.spreadName} · ${mainCard?.orientation === 'reversed' ? '逆位' : '正位'}`, W / 2, y + 86);

  y += 110;
  drawDivider(ctx, W / 2, y, 1);
  y += 24;

  // 氛围标签
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 22px "Noto Serif SC", serif';
  ctx.fillText('— 整体氛围 —', W / 2, y);
  y += 30;

  // 氛围内容
  ctx.fillStyle = T.text;
  ctx.font = '500 30px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, d.atmosphere.slice(0, 100) || '温柔而坚定的能量在场', W / 2, y, 880, 46);

  y += 20;

  // 金句
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 26px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, (d.goldenPhrase || d.summary || '').slice(0, 80), W / 2, y, 880, 42);

  y += 20;

  // 问题（小字）
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 22px "Noto Serif SC", serif';
  ctx.fillText('— 你问的 —', W / 2, y);
  y += 28;
  ctx.fillStyle = T.text;
  ctx.font = '400 24px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, `"${d.question.slice(0, 60)}${d.question.length > 60 ? '…' : ''}"`, W / 2, y, 880, 38);

  drawFooter(ctx, d);
}

function drawCardPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = T.bgGrad;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = T.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = T.goldSoft;
  ctx.font = '500 40px serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦', x + w / 2, y + h / 2 + 14);
}

// === 主入口 ===

export async function generateShareCard(
  data: ShareCardData,
  template: 'quote' | 'question' | 'mood' = 'quote'
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  if ('fonts' in document) {
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise(resolve => setTimeout(resolve, 1500)),
      ]);
    } catch { /* 忽略 */ }
  }

  switch (template) {
    case 'quote': await drawQuoteTemplate(ctx, data); break;
    case 'question': await drawQuestionTemplate(ctx, data); break;
    case 'mood': await drawMoodTemplate(ctx, data); break;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png', 0.95);
  });
}

export function downloadShareCard(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
