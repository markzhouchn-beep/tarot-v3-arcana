// ============================================================
// lib/geo.js · IP 地理位置检测
// 使用 ip-api.com（免费，无需 API key，45 req/min）
// ============================================================

// 内存缓存：IP → country，避免重复请求
const _cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 分钟

// 固定汇率（以 CNY 为基准）
export const EXCHANGE_RATES = {
  CNY: 1,
  TWD: 5,    // 台币 ≈ 5 倍 CNY（PayPal 不支持，收 HKD）
  HKD: 1.1,  // 港币 ≈ 1.1 倍 CNY
  USD: 7.1,  // 美元 ≈ 7.1 倍 CNY
  JPY: 50,   // 日元 ≈ 50 倍 CNY
  KRW: 500,  // 韩元 ≈ 500 倍 CNY
};

// 货币符号
export const CURRENCY_SYMBOL = {
  CNY: '¥',
  TWD: 'NT$',
  HKD: 'HK$',
  USD: '$',
  JPY: '¥',
  KRW: '₩',
};

// 根据国家代码确定收款货币（PayPal 不支持 TWD，台灣用 HKD）
export function currencyForCountry(countryCode) {
  switch (countryCode) {
    case 'CN': return 'CNY'; // 中国大陆
    case 'TW': return 'HKD'; // 台湾（PayPal 不支持 TWD，收港币）
    case 'HK': return 'HKD'; // 香港
    case 'MO': return 'HKD'; // 澳门
    case 'JP': return 'JPY'; // 日本
    case 'KR': return 'KRW'; // 韩国
    default:  return 'USD';  // 其他地区默认美元
  }
}

// CNY 基准价格
const PRICE_CNY = { single: 1, three: 1.9, ten: 9.9 };

// 根据货币类型返回显示价格
export function formatPrice(tier, currency) {
  const rate = EXCHANGE_RATES[currency] || EXCHANGE_RATES.USD;
  const symbol = CURRENCY_SYMBOL[currency] || '$';
  const cnyPrice = PRICE_CNY[tier] || 1;
  const converted = +(cnyPrice * rate).toFixed(2);
  return `${symbol}${converted}`;
}

// 检测 IP 对应的国家
async function detectCountry(ip) {
  // 本地 / 内网 IP 返回 CN
  if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return 'CN';
  }

  // 查缓存
  const cached = _cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.country;
  }

  try {
    // ip-api.com 免费接口（无 key，45 req/min）
    const url = `http://ip-api.com/json/${ip}?fields=countryCode`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`ip-api status: ${res.status}`);
    const data = await res.json();
    const country = data.countryCode || 'US';

    _cache.set(ip, { country, ts: Date.now() });
    return country;
  } catch (err) {
    console.warn('[geo] IP lookup failed:', err.message, '→ default US');
    return 'US';
  }
}

// 从 Express 请求中提取真实 IP（支持 nginx 代理）
export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1'
  );
}

// 主函数：检测请求来源国并返回货币信息
export async function detectGeo(req) {
  const ip = getClientIp(req);
  const country = await detectCountry(ip);
  const currency = currencyForCountry(country);
  return { country, currency, ip };
}
