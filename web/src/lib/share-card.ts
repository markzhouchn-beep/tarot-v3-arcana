// ============================================================
// lib/share-card.ts · 海报生成（纯 Canvas API，无 html2canvas）
// v3.0.2：3 模板统一显示：站点 + 牌阵 + 牌图(名称+正逆) + 问题 + 金句 + 氛围
// 创建：2026-09-02 · 重写 2026-09-03 17:30
// ============================================================

export interface ShareCardCard {
  id: string;
  name: string;
  orientation: 'upright' | 'reversed';
  position?: string;
  imageUrl?: string;        // 牌图 URL（可选）
}

export interface ShareCardData {
  // 基础
  siteName: string;          // e.g. "ARCANA 星语塔罗"
  siteUrl: string;           // e.g. "tarot.layershop.store"
  spreadName: string;        // e.g. "凯尔特十字"
  theme: 'love' | 'career' | 'money' | 'self';

  // 牌
  cards: ShareCardCard[];

  // 问题
  question: string;

  // 金句 + 短答案（AI 出 / 摘要 fallback）
  goldenPhrase: string;      // 一句金句型收尾
  briefAnswer: string;       // 简短答案

  // 氛围（AI 出 / fallback 占位）
  atmosphere: string;

  // 兼容旧字段
  cardName?: string;         // 主牌（氛围型用）
  summary?: string;          // 兼容旧数据
  sectionTitle?: string;
}

// 主题色（暗底金调，符合塔罗品牌）
const T = {
  bg: '#0d0b14',
  bgGrad: '#1a1428',
  gold: '#c9a96e',
  goldSoft: '#e6c890',
  text: '#f0eadf',
  textFaint: '#a89a82',
  accent: '#d4af37',
  line: '#3a2f4f',
};

const W = 1080;
const H = 1920; // 9:16 竖屏

const THEME_SYMBOL: Record<string, string> = {
  love: '💞', career: '💼', money: '💰', self: '🌙',
};

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
  ctx.moveTo(cx - 100, cy);
  ctx.lineTo(cx + 100, cy);
  ctx.stroke();
  ctx.fillStyle = T.gold;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawStars(ctx: CanvasRenderingContext2D, count = 30) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() * 1.5 + 0.3;
    ctx.fillStyle = `rgba(201, 169, 110, ${Math.random() * 0.4 + 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  align: CanvasTextAlign = 'center'
) {
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
  return y;
}

/**
 * 渲染一组牌（支持 1-10 张，自动布局）
 * @returns 渲染结束 y 坐标
 */
async function drawCardGrid(
  ctx: CanvasRenderingContext2D,
  cards: ShareCardCard[],
  cx: number,
  startY: number,
  maxWidth: number
): Promise<number> {
  const n = cards.length;
  if (n === 0) return startY;

  // 牌图大小根据数量自适应
  const layout =
    n === 1 ? { cols: 1, cardW: 220, cardH: 340, gap: 0 } :
    n <= 3 ? { cols: n, cardW: 200, cardH: 310, gap: 30 } :
    n <= 5 ? { cols: n, cardW: 170, cardH: 270, gap: 16 } :
    n <= 7 ? { cols: 4, cardW: 150, cardH: 240, gap: 16 } :
              { cols: 5, cardW: 130, cardH: 200, gap: 16 };

  const rows = Math.ceil(n / layout.cols);
  const rowH = layout.cardH + 60; // 牌 + 牌名 + 正逆

  // 预加载所有牌图
  const imgs = await Promise.all(cards.map(c => c.imageUrl ? loadImage(c.imageUrl) : Promise.resolve(null)));

  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / layout.cols);
    const col = i % layout.cols;
    const inRow = Math.min(n - row * layout.cols, layout.cols);
    const rowWidth = inRow * layout.cardW + (inRow - 1) * layout.gap;
    const x0 = cx - rowWidth / 2;
    const cardX = x0 + col * (layout.cardW + layout.gap);
    const cardY = startY + row * rowH;

    const card = cards[i];
    const img = imgs[i];

    // 卡牌（金边框 + 牌图 / 占位）
    ctx.save();
    // 卡图
    if (img) {
      const drawW = layout.cardW;
      const drawH = layout.cardH;
      // 卡片方向
      if (card.orientation === 'reversed') {
        ctx.translate(cardX + drawW / 2, cardY + drawH / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        ctx.drawImage(img, cardX, cardY, drawW, drawH);
      }
    } else {
      // 占位（深色 + 神秘符号）
      ctx.fillStyle = T.bgGrad;
      ctx.fillRect(cardX, cardY, layout.cardW, layout.cardH);
      ctx.strokeStyle = T.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(cardX, cardY, layout.cardW, layout.cardH);
      ctx.fillStyle = T.goldSoft;
      ctx.font = '500 32px "Cormorant Garamond", serif';
      ctx.textAlign = 'center';
      ctx.fillText('✦', cardX + layout.cardW / 2, cardY + layout.cardH / 2);
    }
    ctx.restore();

    // 卡牌金色边框
    ctx.strokeStyle = T.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(cardX, cardY, layout.cardW, layout.cardH);

    // 牌名
    ctx.fillStyle = T.text;
    ctx.font = '500 22px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.name, cardX + layout.cardW / 2, cardY + layout.cardH + 24);

    // 正/逆
    ctx.fillStyle = T.textFaint;
    ctx.font = '400 16px sans-serif';
    ctx.fillText(card.orientation === 'reversed' ? '逆位' : '正位', cardX + layout.cardW / 2, cardY + layout.cardH + 48);
  }

  return startY + rows * rowH;
}

// === 通用 header / footer ===

function drawHeader(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  // 顶部：站点名 + 主题符号
  ctx.fillStyle = T.gold;
  ctx.font = '700 36px "PingFang SC", "Noto Sans CJK SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦ ARCANA 星语塔罗 ✦', W / 2, 140);

  ctx.fillStyle = T.textFaint;
  ctx.font = '400 22px sans-serif';
  ctx.fillText(d.siteUrl, W / 2, 180);

  // 主题符号
  ctx.font = '600 64px "Cormorant Garamond", serif';
  ctx.fillStyle = T.goldSoft;
  const symbol = THEME_SYMBOL[d.theme] || '✦';
  ctx.fillText(symbol, W / 2, 280);

  // 牌阵名
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 44px "Cormorant Garamond", serif';
  ctx.fillText(d.spreadName, W / 2, 360);

  drawDivider(ctx, W / 2, 410, 2);
}

function drawFooter(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  // 底部品牌
  ctx.fillStyle = T.gold;
  ctx.font = '600 32px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`🌙 ${d.siteName}`, W / 2, H - 160);

  ctx.fillStyle = T.textFaint;
  ctx.font = '400 22px sans-serif';
  ctx.fillText(`扫码解锁你的牌阵 · ${d.siteUrl}`, W / 2, H - 120);
}

// ============================================================
// 模板 1：金句型（70% 用户用）
// 重点：大幅金句 + 完整牌阵 + 问题 + 氛围
// ============================================================
async function drawQuoteTemplate(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  drawBaseBackground(ctx);
  drawStars(ctx, 20);
  drawHeader(ctx, d);

  // 金句（最突出）
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 28px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦  金  句  ✦', W / 2, 500);

  // 金句主体（最大字号）
  ctx.fillStyle = T.text;
  ctx.font = '600 60px "Noto Serif SC", serif';
  const quote = (d.goldenPhrase || d.summary || d.question || '每张牌都是一面镜子').slice(0, 90);
  let y = drawWrappedText(ctx, `"${quote}"`, W / 2, 580, 940, 90);

  // 简短答案
  y += 30;
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 32px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, `— ${(d.briefAnswer || '').slice(0, 60)}`, W / 2, y, 900, 50);

  // 分隔
  y += 30;
  drawDivider(ctx, W / 2, y, 1);
  y += 40;

  // 问题
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 26px "Noto Serif SC", serif';
  ctx.fillText('— 你问的 —', W / 2, y);
  y += 36;
  ctx.fillStyle = T.text;
  ctx.font = '500 32px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, `"${d.question.slice(0, 60)}${d.question.length > 60 ? '…' : ''}"`, W / 2, y, 900, 48);

  // 牌图（小尺寸，最多 5 张）
  y += 30;
  const displayCards = d.cards.slice(0, 5);
  y = await drawCardGrid(ctx, displayCards, W / 2, y, 940);

  // 氛围
  y += 30;
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 22px "Noto Serif SC", serif';
  ctx.fillText('— 整体氛围 —', W / 2, y);
  y += 32;
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 28px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, d.atmosphere.slice(0, 80) || '温柔而坚定的能量在场', W / 2, y, 900, 44);

  drawFooter(ctx, d);
}

// ============================================================
// 模板 2：问题型（20% 用户用）
// 重点：问题 + 全牌展示 + 邀请扫码
// ============================================================
async function drawQuestionTemplate(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  drawBaseBackground(ctx);
  drawStars(ctx, 20);
  drawHeader(ctx, d);

  // 问题（最突出）
  ctx.fillStyle = T.textFaint;
  ctx.font = '500 26px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('— 你抽的牌 —', W / 2, 480);

  // 全牌展示（最多 10 张）
  const y0 = 530;
  const y1 = await drawCardGrid(ctx, d.cards, W / 2, y0, 940);

  // 问题
  let y = y1 + 50;
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 26px "Noto Serif SC", serif';
  ctx.fillText('— 你问的 —', W / 2, y);
  y += 36;
  ctx.fillStyle = T.text;
  ctx.font = '700 52px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, `"${d.question.slice(0, 50)}${d.question.length > 50 ? '…' : ''}"`, W / 2, y, 900, 72);

  // 金句小标
  y += 30;
  ctx.fillStyle = T.gold;
  ctx.font = 'italic 30px "Noto Serif SC", serif';
  y = drawWrappedText(ctx, (d.goldenPhrase || d.summary || '').slice(0, 80), W / 2, y, 900, 48);

  drawFooter(ctx, d);
}

// ============================================================
// 模板 3：氛围型（10% 用户用）
// 重点：主牌 + 氛围描述 + 神秘装饰
// ============================================================
async function drawMoodTemplate(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  drawBaseBackground(ctx);
  drawStars(ctx, 30);

  // 顶部小标签
  ctx.fillStyle = T.gold;
  ctx.font = '700 32px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`✦ ${d.siteName} ✦`, W / 2, 140);

  ctx.fillStyle = T.textFaint;
  ctx.font = '400 22px sans-serif';
  ctx.fillText(d.siteUrl, W / 2, 180);

  // 神秘符号外圈
  ctx.save();
  ctx.strokeStyle = T.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(W / 2, 480, 250, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = T.goldSoft;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(W / 2, 480, 200, 0, Math.PI * 2);
  ctx.stroke();

  // 主牌图（中央）
  const mainCard = d.cards[0];
  if (mainCard?.imageUrl) {
    const img = await loadImage(mainCard.imageUrl);
    if (img) {
      ctx.save();
      const cw = 220, ch = 340;
      if (mainCard.orientation === 'reversed') {
        ctx.translate(W / 2, 480);
        ctx.rotate(Math.PI);
        ctx.drawImage(img, -cw / 2, -ch / 2, cw, ch);
      } else {
        ctx.drawImage(img, W / 2 - cw / 2, 480 - ch / 2, cw, ch);
      }
      ctx.restore();
      ctx.strokeStyle = T.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - 110, 310, 220, 340);
    }
  } else {
    // 五角星占位
    ctx.strokeStyle = T.gold;
    ctx.lineWidth = 2;
    drawStar(ctx, W / 2, 480, 5, 130, 60);
  }
  ctx.restore();

  // 主牌名
  ctx.fillStyle = T.gold;
  ctx.font = '700 64px "Cormorant Garamond", serif';
  ctx.textAlign = 'center';
  ctx.fillText(mainCard?.name || d.cardName || '愚者', W / 2, 800);

  // 牌阵名
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 32px "Cormorant Garamond", serif';
  ctx.fillText(`${d.spreadName} · ${mainCard?.orientation === 'reversed' ? '逆位' : '正位'}`, W / 2, 850);

  // 氛围描述（大块）
  drawDivider(ctx, W / 2, 900);
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 24px "Noto Serif SC", serif';
  ctx.fillText('— 整  体  氛  围 —', W / 2, 950);
  ctx.fillStyle = T.text;
  ctx.font = '500 32px "Noto Serif SC", serif';
  drawWrappedText(ctx, d.atmosphere.slice(0, 120) || '温柔而坚定的能量在场', W / 2, 1010, 900, 50);

  // 金句（底部小标）
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 26px "Noto Serif SC", serif';
  drawWrappedText(ctx, (d.goldenPhrase || d.summary || '').slice(0, 60), W / 2, 1200, 900, 42);

  // 问题（小字）
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 24px "Noto Serif SC", serif';
  drawWrappedText(ctx, `"${d.question.slice(0, 50)}${d.question.length > 50 ? '…' : ''}"`, W / 2, 1340, 900, 40);

  drawFooter(ctx, d);
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
  ctx.stroke();
}

// === 主入口 ===

export async function generateShareCard(data: ShareCardData, template: 'quote' | 'question' | 'mood' = 'quote'): Promise<Blob> {
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

/**
 * 触发浏览器下载
 */
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