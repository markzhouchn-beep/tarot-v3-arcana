// ============================================================
// lib/safety.js · AI 安全过滤（三层防御）
// Phase 1 充实：敏感词表 + AI 输出检查 + 自杀响应
// 创建：2026-09-01
// ============================================================

// 敏感词类别（Phase 1 由 Mark + 塔罗专家评审）
const DANGER_PATTERNS = [
  // 自杀/自伤（最高优先级）
  { pattern: /自杀|想死|轻生|自残|撑不下去|不想活|跳楼|割腕/, action: 'urgent_referral' },
  // 医疗/疾病
  { pattern: /癌症|肿瘤|艾滋病|抑郁|精神病|药物|处方|剂量/, action: 'block' },
  // 投资/理财（具体标的）
  { pattern: /股票代码|基金代码|比特币|BTC|ETH|外汇|期货/, action: 'block' },
  // 政治
  { pattern: /习近平|特朗普|拜登|领导人|总统|政策/, action: 'block' },
  // 代码/技术
  { pattern: /写代码|python|javascript|API|debug/, action: 'block' },
];

/**
 * 检测输入文本
 * @param {string} text
 * @returns {{safe: boolean, action: string|null, matchedKeywords: string[]}}
 */
export function checkInput(text) {
  if (!text || typeof text !== 'string') {
    return { safe: true, action: null, matchedKeywords: [] };
  }

  const matched = [];
  let topAction = null;

  for (const rule of DANGER_PATTERNS) {
    const match = text.match(rule.pattern);
    if (match) {
      matched.push(match[0]);
      // 优先级：urgent_referral > block > warn
      if (rule.action === 'urgent_referral') topAction = 'urgent_referral';
      else if (rule.action === 'block' && topAction !== 'urgent_referral') topAction = 'block';
      else if (rule.action === 'warn' && !topAction) topAction = 'warn';
    }
  }

  return {
    safe: topAction !== 'urgent_referral' && topAction !== 'block',
    action: topAction,
    matchedKeywords: [...new Set(matched)],
  };
}

/**
 * 检测 AI 输出文本（防止 LLM 输出越界内容）
 * Phase 1 充实
 */
export function checkOutput(text) {
  // TODO Phase 1: 实现 LLM 输出检查
  return { safe: true, action: null };
}

/**
 * 自杀/自伤安全响应文案
 */
export const CRISIS_RESPONSE = `我听到你现在的状态。请先联系专业人士，他们能给你真正的帮助：

· 全国心理援助热线（24小时）：400-161-9995
· 北京心理危机研究与干预中心：010-82951332
· 希望 24 热线：400-161-9995

你的生命很重要。请现在拨打上面的电话。`;

export default { checkInput, checkOutput, CRISIS_RESPONSE };
