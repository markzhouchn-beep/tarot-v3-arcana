// ============================================================
// lib/share-card.ts · 分享卡生成（纯 Canvas API）
// v3.0.4：基于 share-card-design.md 设计规则重写
// 核心原则：Header(0-200) + Content(200-1680) + Footer(1680-1850)，内容不越界
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

// ── 品牌色 ──────────────────────────────────────────
const T = {
  bg: '#0d0b14',
  bgGrad: '#1a1428',
  gold: '#c9a96e',
  goldSoft: '#e6c890',
  text: '#f0eadf',
  textFaint: '#a89a82',
};

// ── 画布尺寸 ───────────────────────────────────────
const W = 1080;
const H = 1920;
const MARGIN = 60;          // 左右安全边距
const CX = W / 2;          // 画布水平中心
const CONTENT_W = W - MARGIN * 2; // 960px 内容宽度

// ── 固定布局骨架（绝对不准超）────────────────────────
// Header:  0 – 200
// Content: 200 – 1680（可用 1480px）
// Footer:  1680 – 1850
const HEADER_END = 200;
const FOOTER_START = 1680;
const FOOTER_END = 1850;

// ── 字号规范 ───────────────────────────────────────
// 金句主体  | 38px / 58px 行高（最多 2 行 = 116px）
// 副标题    | 26px / 42px
// 正文      | 28px / 46px
// 标签/辅助  | 20px / 32px
// 牌名      | 20px
// 正逆      | 15px

// ══════════════════════════════════════════════════════
// 工具函数
// ══════════════════════════════════════════════════════

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // 超时保护：3s 内没加载完就放弃
    img.onload || (setTimeout(() => resolve(null), 3000));
    img.src = url;
  });
}

function measureTextWidth(ctx: CanvasRenderingContext2D, text: string): number {
  return ctx.measureText(text).width;
}

/** 自动换行，返回文字块底部 y */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  startY: number,
  maxW: number,
  lineH: number,
  maxLines = 999,
  align: CanvasTextAlign = 'center',
): number {
  if (!text) return startY;
  ctx.textAlign = align;

  // 优先用 ctx.measureText 精确计算
  const chars = [...text];
  const lines: string[] = [];
  let line = '';

  for (const ch of chars) {
    const test = line + ch;
    if (measureTextWidth(ctx, test) > maxW && line) {
      lines.push(line);
      line = ch;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);

  let y = startY;
  for (const l of lines) {
    ctx.fillText(l, cx, y);
    y += lineH;
  }
  return y;
}

/** 水平分隔线（金色 + 中心圆点） */
function divider(ctx: CanvasRenderingContext2D, cx: number, y: number) {
  ctx.strokeStyle = T.gold;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 80, y);
  ctx.lineTo(cx + 80, y);
  ctx.stroke();
  ctx.fillStyle = T.gold;
  ctx.beginPath();
  ctx.arc(cx, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** 背景 + 四角装饰 */
function drawBackground(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, T.bg);
  grad.addColorStop(0.5, T.bgGrad);
  grad.addColorStop(1, T.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 外边框
  ctx.strokeStyle = T.gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  // 四角 L 装饰
  const corners = [
    [58, 58, 1, 1],
    [W - 58, 58, -1, 1],
    [58, H - 58, 1, -1],
    [W - 58, H - 58, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.strokeStyle = T.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(0, 0);
    ctx.lineTo(28, 0);
    ctx.stroke();
    ctx.restore();
  }

  // 散落星点（确定性，用固定 seed）
  const seeds = [7, 13, 19, 23, 29, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101];
  for (let i = 0; i < 25; i++) {
    const seed = seeds[i % seeds.length];
    const x = (seed * (i + 1) * 37) % W;
    const y = (seed * (i + 1) * 53) % H;
    const r = 0.3 + (i % 3) * 0.5;
    ctx.fillStyle = `rgba(201,169,110,${0.08 + (i % 4) * 0.07})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ══════════════════════════════════════════════════════
// 牌阵渲染
// ══════════════════════════════════════════════════════

/** 根据牌数确定布局参数 */
function cardLayout(n: number): { cols: number; cardW: number; cardH: number; gap: number; rowH: number } {
  if (n === 1) return { cols: 1, cardW: 240, cardH: 370, gap: 0, rowH: 430 };
  if (n === 2) return { cols: 2, cardW: 210, cardH: 325, gap: 16, rowH: 375 };
  if (n === 3) return { cols: 3, cardW: 220, cardH: 340, gap: 12, rowH: 392 };
  if (n <= 5)  return { cols: 3, cardW: 200, cardH: 310, gap: 10, rowH: 362 };
  if (n <= 9)  return { cols: 3, cardW: 170, cardH: 265, gap: 8,  rowH: 300 };
  return          { cols: 4, cardW: 150, cardH: 230, gap: 8,  rowH: 270 };
}

/**
 * 渲染一组牌阵
 * @param maxH 最多占多高（超出部分不画）
 * @returns 实际底部 y
 */
async function drawCardGrid(
  ctx: CanvasRenderingContext2D,
  cards: ShareCardCard[],
  startY: number,
  maxH: number,
  maxCards?: number,
): Promise<number> {
  const display = cards.slice(0, maxCards ?? cards.length);
  const n = display.length;
  if (n === 0) return startY;

  const { cols, cardW, cardH, gap, rowH } = cardLayout(n);
  const rows = Math.ceil(n / cols);
  const totalH = rows * rowH;
  const actualH = Math.min(totalH, maxH);
  const actualRows = Math.ceil(actualH / rowH);

  // 预加载牌图（全部加载，不在循环内逐张）
  const loadStart = Date.now();
  const imgs = await Promise.all(
    display.map(c => c.imageUrl ? loadImage(c.imageUrl) : Promise.resolve(null)),
  );
  const loadMs = Date.now() - loadStart;

  const rowsToRender = Math.min(actualRows, rows);
  let y = startY;

  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    if (row >= rowsToRender) break;

    const col = i % cols;
    // 最后一行可能不满列
    const inRow = Math.min(n - row * cols, cols);
    const rowW = inRow * cardW + (inRow - 1) * gap;
    const x0 = CX - rowW / 2;
    const cardX = x0 + col * (cardW + gap);
    const cardY = y;
    const card = display[i];
    const img = imgs[i];

    // 画牌图（每张牌独立 save/restore，不互相影响）
    ctx.save();
    if (img) {
      const dw = cardW, dh = cardH;
      if (card.orientation === 'reversed') {
        ctx.translate(cardX + dw / 2, cardY + dh / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      } else {
        ctx.drawImage(img, cardX, cardY, dw, dh);
      }
    } else {
      // 占位：深色底 + 金边 + ✦
      ctx.fillStyle = T.bgGrad;
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = T.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(cardX, cardY, cardW, cardH);
      ctx.fillStyle = T.goldSoft;
      ctx.font = '400 36px serif';
      ctx.textAlign = 'center';
      ctx.fillText('✦', cardX + cardW / 2, cardY + cardH / 2 + 12);
    }
    ctx.restore();

    // 边框（在 restore 后画，不受旋转影响）
    ctx.strokeStyle = T.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    // 牌名（金色，底部上方）
    ctx.fillStyle = T.gold;
    ctx.font = '500 20px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.name, cardX + cardW / 2, cardY + cardH + 22);

    // 正/逆（浅灰）
    ctx.fillStyle = T.textFaint;
    ctx.font = '400 15px sans-serif';
    ctx.fillText(card.orientation === 'reversed' ? '逆位' : '正位', cardX + cardW / 2, cardY + cardH + 42);
  }

  // 移动到下一行
  y += rowsToRender * rowH;
  return y;
}

// ══════════════════════════════════════════════════════
// 固定 Header / Footer
// ══════════════════════════════════════════════════════

function drawHeader(ctx: CanvasRenderingContext2D, siteName: string, siteUrl: string) {
  ctx.fillStyle = T.gold;
  ctx.font = '700 40px "PingFang SC", "Noto Sans CJK SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(siteName, CX, 110);

  ctx.fillStyle = T.textFaint;
  ctx.font = '400 20px sans-serif';
  ctx.fillText(siteUrl, CX, 148);

  divider(ctx, CX, 188);
}

function drawFooter(ctx: CanvasRenderingContext2D) {
  divider(ctx, CX, FOOTER_START);

  ctx.fillStyle = T.gold;
  ctx.font = '600 32px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('塔罗匣 Arcana Box', CX, FOOTER_START + 42);

  ctx.fillStyle = T.textFaint;
  ctx.font = '400 20px sans-serif';
  ctx.fillText('tarotbox.cn', CX, FOOTER_START + 78);
}

// ══════════════════════════════════════════════════════
// 标签辅助函数
// ══════════════════════════════════════════════════════

function labelTag(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number) {
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 20px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, y);
  return y + 32; // 返回内容起始 y
}

function contentLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  startY: number,
  color: string,
  size: number,
  maxW = CONTENT_W,
  lineH?: number,
) {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px "Noto Serif SC", serif`;
  return wrapText(ctx, text, cx, startY, maxW, lineH ?? size + 10);
}

// ══════════════════════════════════════════════════════
// 模板 1：金句型（70% 用户）
// 布局：问题 → 分隔 → 金句标签 → 金句 → 答案 → 分隔 → 牌阵 → 氛围
// Content Zone 1480px，内容严格不超
// ══════════════════════════════════════════════════════

async function drawQuoteTemplate(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  drawBackground(ctx);
  drawHeader(ctx, '塔罗匣 Arcana Box', d.siteUrl);
  drawFooter(ctx);

  const maxY = FOOTER_START - 20; // 内容底线
  let y = HEADER_END + 16;        // 内容起点（留 16px 呼吸）

  // ── 问题 ────────────────────────────────────────────
  y = labelTag(ctx, '— 你问的 —', CX, y);
  y = contentLine(ctx, `"${d.question}"`, CX, y, T.text, 28, CONTENT_W, 46);
  y += 16;
  divider(ctx, CX, y);
  y += 30;

  // ── 金句（核心，字号克制） ─────────────────────────
  // 金句 38px × 2 行 max = 116px；答案 26px × 2 行 max = 84px
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 20px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦  金  句  ✦', CX, y);
  y += 32;

  const goldText = (d.goldenPhrase || d.summary || '每张牌都是一面镜子').slice(0, 60);
  ctx.fillStyle = T.text;
  ctx.font = '600 38px "Noto Serif SC", serif';
  y = wrapText(ctx, `"${goldText}"`, CX, y, CONTENT_W + 40, 58, 2);
  y += 12;

  const brief = (d.briefAnswer || '').slice(0, 50);
  if (brief) {
    ctx.fillStyle = T.goldSoft;
    ctx.font = 'italic 26px "Noto Serif SC", serif';
    wrapText(ctx, `— ${brief}`, CX, y, CONTENT_W, 42, 2);
    y += 42 + 12;
  }
  y += 10;
  divider(ctx, CX, y);
  y += 30;

  // ── 牌阵（最多 5 张，max 760px） ──────────────────
  const cardsH = maxY - y - 120; // 留 120px 给氛围
  const cardY = await drawCardGrid(ctx, d.cards.slice(0, 5), y, cardsH, 5);
  y = cardY + 20;

  // ── 氛围 ────────────────────────────────────────────
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 20px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('— 整体氛围 —', CX, y);
  y += 30;
  const atmText = d.atmosphere?.slice(0, 80) || '温柔而坚定的能量在场';
  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 26px "Noto Serif SC", serif';
  wrapText(ctx, atmText, CX, y, CONTENT_W, 42, 3);
}

// ══════════════════════════════════════════════════════
// 模板 2：问题型（20% 用户）
// 布局：牌阵 → 问题 → 金句 → 氛围
// Content Zone 1480px，牌阵最多 820px，剩下 640px 给文字
// ══════════════════════════════════════════════════════

async function drawQuestionTemplate(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  drawBackground(ctx);
  drawHeader(ctx, '塔罗匣 Arcana Box', d.siteUrl);
  drawFooter(ctx);

  const maxY = FOOTER_START - 20;
  let y = HEADER_END + 16;

  // ── 牌阵（最多 10 张） ──────────────────────────────
  const cardsH = maxY - y - 260; // 留 260px 给下面文字
  const cardY = await drawCardGrid(ctx, d.cards.slice(0, 10), y, cardsH, 10);
  y = cardY + 16;
  divider(ctx, CX, y);
  y += 30;

  // ── 问题 ────────────────────────────────────────────
  y = labelTag(ctx, '— 你问的 —', CX, y);
  const qText = d.question.slice(0, 55) + (d.question.length > 55 ? '…' : '');
  ctx.fillStyle = T.text;
  ctx.font = '700 36px "Noto Serif SC", serif';
  y = wrapText(ctx, `"${qText}"`, CX, y, CONTENT_W, 54, 3);
  y += 16;

  // ── 金句 ────────────────────────────────────────────
  const goldText = (d.goldenPhrase || d.summary || '').slice(0, 70);
  if (goldText) {
    ctx.fillStyle = T.goldSoft;
    ctx.font = 'italic 24px "Noto Serif SC", serif';
    y = wrapText(ctx, goldText, CX, y, CONTENT_W, 38, 2);
    y += 10;
  }

  // ── 氛围 ────────────────────────────────────────────
  const atmText = (d.atmosphere || '').slice(0, 60);
  if (atmText) {
    ctx.fillStyle = T.textFaint;
    ctx.font = 'italic 20px "Noto Serif SC", serif';
    y = wrapText(ctx, `氛围：${atmText}`, CX, y, CONTENT_W, 32, 2);
  }
}

// ══════════════════════════════════════════════════════
// 模板 3：氛围型（10% 用户）
// 布局：主牌（大）+ 牌名 → 氛围 → 金句 → 问题
// 主牌 240×370 占 450px，剩下 1010px 给文字
// ══════════════════════════════════════════════════════

async function drawMoodTemplate(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  drawBackground(ctx);
  drawHeader(ctx, '塔罗匣 Arcana Box', d.siteUrl);
  drawFooter(ctx);

  const mainCard = d.cards[0];
  const cardW = 240;
  const cardH = 370;
  const cardX = CX - cardW / 2;
  const cardY = HEADER_END + 30;

  // ── 主牌 ────────────────────────────────────────────
  if (mainCard?.imageUrl) {
    const img = await loadImage(mainCard.imageUrl);
    ctx.save();
    if (img) {
      if (mainCard.orientation === 'reversed') {
        ctx.translate(CX, cardY + cardH / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(img, -cardW / 2, -cardH / 2, cardW, cardH);
      } else {
        ctx.drawImage(img, cardX, cardY, cardW, cardH);
      }
    }
    ctx.restore();
    ctx.strokeStyle = T.gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(cardX, cardY, cardW, cardH);
  } else {
    // 占位
    ctx.fillStyle = T.bgGrad;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = T.gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(cardX, cardY, cardW, cardH);
    ctx.fillStyle = T.goldSoft;
    ctx.font = '400 40px serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦', CX, cardY + cardH / 2 + 14);
  }

  let y = cardY + cardH;

  // ── 牌名 ────────────────────────────────────────────
  ctx.fillStyle = T.gold;
  ctx.font = '700 46px "Cormorant Garamond", serif';
  ctx.textAlign = 'center';
  ctx.fillText(mainCard?.name || d.cardName || '愚者', CX, y + 50);

  ctx.fillStyle = T.goldSoft;
  ctx.font = 'italic 22px "Cormorant Garamond", serif';
  ctx.fillText(
    `${d.spreadName} · ${mainCard?.orientation === 'reversed' ? '逆位' : '正位'}`,
    CX, y + 82,
  );
  y += 110;

  divider(ctx, CX, y);
  y += 28;

  // ── 氛围（重点，字号稍大） ─────────────────────────
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 20px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('— 整体氛围 —', CX, y);
  y += 30;
  const atmText = (d.atmosphere || '温柔而坚定的能量在场').slice(0, 90);
  ctx.fillStyle = T.text;
  ctx.font = '500 28px "Noto Serif SC", serif';
  y = wrapText(ctx, atmText, CX, y, CONTENT_W, 44, 3);
  y += 16;

  // ── 金句 ────────────────────────────────────────────
  const goldText = (d.goldenPhrase || d.summary || '').slice(0, 70);
  if (goldText) {
    ctx.fillStyle = T.goldSoft;
    ctx.font = 'italic 24px "Noto Serif SC", serif';
    y = wrapText(ctx, goldText, CX, y, CONTENT_W, 38, 2);
    y += 12;
  }

  // ── 问题 ────────────────────────────────────────────
  ctx.fillStyle = T.textFaint;
  ctx.font = 'italic 20px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.fillText('— 你问的 —', CX, y);
  y += 28;
  const qText = d.question.slice(0, 55) + (d.question.length > 55 ? '…' : '');
  ctx.fillStyle = T.text;
  ctx.font = '400 22px "Noto Serif SC", serif';
  wrapText(ctx, `"${qText}"`, CX, y, CONTENT_W, 36, 2);
}

// ══════════════════════════════════════════════════════
// 主入口
// ══════════════════════════════════════════════════════

export async function generateShareCard(
  data: ShareCardData,
  template: 'quote' | 'question' | 'mood' = 'quote',
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');

  // 等待字体加载（1.5s 超时）
  if ('fonts' in document) {
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise(resolve => setTimeout(resolve, 1500)),
      ]);
    } catch { /* 忽略 */ }
  }

  switch (template) {
    case 'quote':    await drawQuoteTemplate(ctx, data);    break;
    case 'question': await drawQuestionTemplate(ctx, data); break;
    case 'mood':    await drawMoodTemplate(ctx, data);     break;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
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
