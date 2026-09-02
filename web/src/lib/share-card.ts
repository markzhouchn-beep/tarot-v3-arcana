// ============================================================
// lib/share-card.ts · 海报生成（纯 Canvas API，无 html2canvas）
// v3.0.1：3 模板（金句型 / 问题型 / 氛围型）
// 创建：2026-09-02 · 00:42
// ============================================================

export interface ShareCardData {
  question: string;
  spreadName: string;
  cardName?: string;          // 主牌（氛围型用）
  summary?: string;            // 金句（首段首句）
  sectionTitle?: string;       // 解读首段标题
  theme?: 'love' | 'career' | 'money' | 'self';
}

// 主题色（暗底金调，符合塔罗品牌）
const THEME = {
  bg: '#0d0b14',
  bgGradient: '#1a1428',
  gold: '#c9a96e',
  goldSoft: '#e6c890',
  text: '#f0eadf',
  textFaint: '#a89a82',
  accent: '#d4af37',
};

const W = 1080;
const H = 1920; // 9:16 竖屏

/**
 * 模板 1：金句型（70% 用户用）
 * 大字居中：解读首段金句 + 牌阵名 + 品牌落款
 */
function drawQuoteTemplate(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  drawBaseBackground(ctx);

  // 顶部装饰：星阵
  drawConstellation(ctx, 120, 180);

  // 顶部小标签
  ctx.fillStyle = THEME['textFaint'];
  ctx.font = '500 28px "PingFang SC", "Noto Sans CJK SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦ ARCANA ai 塔罗解读 ✦', W / 2, 240);

  // 牌阵名
  ctx.fillStyle = THEME['goldSoft'];
  ctx.font = 'italic 42px "Cormorant Garamond", serif';
  ctx.fillText(d.spreadName, W / 2, 340);

  // 分隔线
  drawDivider(ctx, 540, 380, 2);

  // 金句主体（首段前 80 字 + "……"）
  const quote = (d.summary || d.sectionTitle || d.question).slice(0, 80);
  ctx.fillStyle = THEME['text'];
  ctx.font = '600 64px "Noto Serif SC", serif';

  // 自动换行
  drawWrappedText(ctx, quote, W / 2, 480, 880, 100);

  // 底部：问题
  ctx.fillStyle = THEME['textFaint'];
  ctx.font = 'italic 36px "Noto Serif SC", serif';
  drawWrappedText(ctx, `"${d.question.slice(0, 40)}${d.question.length > 40 ? '...' : ''}"`, W / 2, 1380, 880, 56);

  // 底部品牌
  ctx.fillStyle = THEME['gold'];
  ctx.font = '600 38px "PingFang SC", sans-serif';
  ctx.fillText('🌙 ARCANA ai', W / 2, 1740);
  ctx.fillStyle = THEME['textFaint'];
  ctx.font = '400 24px sans-serif';
  ctx.fillText('扫码 · 解锁你的牌阵', W / 2, 1800);
}

/**
 * 模板 2：问题型（20% 用户用）
 * 大字居中显示问题 + 牌阵 + 暗示性"邀请扫码"
 */
function drawQuestionTemplate(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  drawBaseBackground(ctx);

  // 顶部小标签
  ctx.fillStyle = THEME['textFaint'];
  ctx.font = '500 32px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('— 我的塔罗问题 —', W / 2, 240);

  // 问题主体（最多 80 字）
  const question = d.question.length > 80 ? d.question.slice(0, 80) + '…' : d.question;
  ctx.fillStyle = THEME['goldSoft'];
  ctx.font = '700 72px "Noto Serif SC", serif';
  drawWrappedText(ctx, `"${question}"`, W / 2, 360, 940, 110);

  // 分隔线
  drawDivider(ctx, 540, 940, 3);

  // 牌阵
  ctx.fillStyle = THEME['text'];
  ctx.font = '500 48px "Cormorant Garamond", serif';
  ctx.fillText(d.spreadName, W / 2, 1080);

  // 暗示文案
  ctx.fillStyle = THEME['goldSoft'];
  ctx.font = 'italic 44px "Noto Serif SC", serif';
  ctx.fillText('你抽到了什么？', W / 2, 1240);

  ctx.fillStyle = THEME['textFaint'];
  ctx.font = '400 32px sans-serif';
  ctx.fillText('扫码 · 解锁完整解读', W / 2, 1320);

  // 底部品牌
  ctx.fillStyle = THEME['gold'];
  ctx.font = '600 38px "PingFang SC", sans-serif';
  ctx.fillText('🌙 ARCANA ai', W / 2, 1740);
}

/**
 * 模板 3：氛围型（10% 用户用）
 * 主牌名大字 + 关键词 + 神秘装饰
 */
function drawMoodTemplate(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  drawBaseBackground(ctx);

  // 中央神秘符号（占位 - 实际可以加载卡图）
  drawMysticalSymbol(ctx, W / 2, 720, 320);

  // 主牌名
  ctx.fillStyle = THEME['gold'];
  ctx.font = '700 88px "Cormorant Garamond", serif';
  ctx.textAlign = 'center';
  ctx.fillText(d.cardName || '愚者', W / 2, 1180);

  // 副标题（牌阵名）
  ctx.fillStyle = THEME['goldSoft'];
  ctx.font = 'italic 42px "Cormorant Garamond", serif';
  ctx.fillText(d.spreadName, W / 2, 1280);

  // 分隔线
  drawDivider(ctx, 540, 1340, 2);

  // 底部金句
  ctx.fillStyle = THEME['text'];
  ctx.font = 'italic 38px "Noto Serif SC", serif';
  const quote = (d.summary || '每张牌都是一面镜子').slice(0, 60);
  drawWrappedText(ctx, `"${quote}"`, W / 2, 1440, 880, 56);

  // 底部品牌
  ctx.fillStyle = THEME['gold'];
  ctx.font = '600 38px "PingFang SC", sans-serif';
  ctx.fillText('🌙 ARCANA ai', W / 2, 1740);
  ctx.fillStyle = THEME['textFaint'];
  ctx.font = '400 24px sans-serif';
  ctx.fillText('扫码 · 解锁你的牌阵', W / 2, 1800);
}

// === 通用绘制函数 ===

function drawBaseBackground(ctx: CanvasRenderingContext2D) {
  // 暗底渐变
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, THEME['bg']);
  grad.addColorStop(0.5, THEME['bgGradient']);
  grad.addColorStop(1, THEME['bg']);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 顶部 + 底部金色装饰边框
  ctx.strokeStyle = THEME['gold'];
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  // 角落装饰
  drawCornerDecor(ctx, 60, 60);
  drawCornerDecor(ctx, W - 60, 60, true);
  drawCornerDecor(ctx, 60, H - 60, false, true);
  drawCornerDecor(ctx, W - 60, H - 60, true, true);
}

function drawCornerDecor(ctx: CanvasRenderingContext2D, x: number, y: number, flipX = false, flipY = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.strokeStyle = THEME['gold'];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.lineTo(0, 0);
  ctx.lineTo(30, 0);
  ctx.stroke();
  // 装饰星
  ctx.fillStyle = THEME['gold'];
  ctx.beginPath();
  ctx.arc(8, 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawConstellation(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.strokeStyle = THEME['gold'];
  ctx.fillStyle = THEME['goldSoft'];
  ctx.lineWidth = 1.5;

  // 星座点 + 连线
  const points = [
    [cx - 30, cy], [cx - 10, cy + 20], [cx + 10, cy - 10],
    [cx + 30, cy + 15], [cx + 40, cy - 20],
  ];
  // 连线
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.stroke();

  // 点
  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDivider(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number) {
  ctx.strokeStyle = THEME['gold'];
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(cx - 100, cy);
  ctx.lineTo(cx + 100, cy);
  ctx.stroke();
  // 中间装饰
  ctx.fillStyle = THEME['gold'];
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawMysticalSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  // 外圈
  ctx.strokeStyle = THEME['gold'];
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // 内圈
  ctx.strokeStyle = THEME['goldSoft'];
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  // 五角星
  ctx.strokeStyle = THEME['gold'];
  ctx.lineWidth = 2;
  drawStar(ctx, cx, cy, 5, r * 0.5, r * 0.25);
  ctx.restore();
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

/**
 * 自动换行绘制
 */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
) {
  // 中文按字符拆，英文按词拆（简化：按字符）
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

// === 主入口 ===

export async function generateShareCard(data: ShareCardData, template: 'quote' | 'question' | 'mood' = 'quote'): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 等待字体加载（关键！否则中文 fallback 到默认字体）
  if ('fonts' in document) {
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise(resolve => setTimeout(resolve, 1500)), // 最多等 1.5s
      ]);
    } catch { /* 忽略 */ }
  }

  switch (template) {
    case 'quote': drawQuoteTemplate(ctx, data); break;
    case 'question': drawQuestionTemplate(ctx, data); break;
    case 'mood': drawMoodTemplate(ctx, data); break;
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
  // 释放内存（延迟）
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}