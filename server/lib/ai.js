// ============================================================
// lib/ai.js · MiniMax API 调用封装
// 沿用 v2.0 base_url + model
// 三层深度 prompt（意图分类）— Phase 3 充实
// 创建：2026-09-01
// ============================================================

import { config } from './config.js';

/**
 * 调用 MiniMax API 生成解读
 * @param {Object} opts
 * @param {string} opts.systemPrompt - 系统 prompt（角色 + 边界）
 * @param {string} opts.userPrompt - 用户 prompt（牌阵 + 问题 + 历史）
 * @param {number} [opts.maxTokens=2000]
 * @returns {Promise<{content: string, tokensUsed: number, duration: number}>}
 */
export async function callAI({ systemPrompt, userPrompt, maxTokens = 2000 }) {
  // Mock 模式：不调真 AI，返回占位文本
  if (config.MOCK_MODE === '1') {
    return mockAIResponse(userPrompt);
  }

  // 真实模式：调 MiniMax 原生 API（OpenAI 兼容格式）
  // 关键：anthropic 兼容层 /anthropic/v1/messages 不认新 key，必须用 native /v1/text/chatcompletion_v2
  const start = Date.now();
  const url = `${config.MINIMAX_BASE_URL}/v1/text/chatcompletion_v2`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: config.MINIMAX_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const duration = Date.now() - start;

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[ai] MiniMax API ${res.status}: ${errText.slice(0, 200)}`);
    throw new Error(`AI 调用失败: ${res.status}`);
  }

  const data = await res.json();
  // OpenAI 兼容响应：choices[0].message.content
  const content = data.choices?.[0]?.message?.content || '';
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const tokensUsed = data.usage?.total_tokens || (inputTokens + outputTokens);

  console.log(`[ai] ${tokensUsed} tokens (in=${inputTokens} out=${outputTokens}), ${duration}ms`);

  // 计算成本（人民币）：输入 ¥0.0001/1k tokens + 输出 ¥0.0002/1k tokens（MiniMax 报价）
  const cost = (inputTokens / 1000) * 0.0001 + (outputTokens / 1000) * 0.0002;

  return { content, tokensUsed, cost, duration };
}

/**
 * Mock AI 响应（开发模式用）
 */
function mockAIResponse(userPrompt) {
  const placeholder = `【Mock 解读】\n\n这是占位解读文本。\n用户问题摘要：${userPrompt.slice(0, 100)}...\n\n完整 AI prompt 与解读内容将在 Phase 1 由塔罗专家编写。`;

  return {
    content: placeholder,
    tokensUsed: 100,
    cost: 0.001,
    duration: 50,
  };
}

/**
 * 意图分类（追问场景用）
 * Phase 3 实现：A 释义 / B 关联 / C 行动 / D 情感 / E 越界
 * Phase 0 暂返回 null
 *
 * @param {string} question
 * @returns {Promise<'A'|'B'|'C'|'D'|'E'|null>}
 */
export async function classifyIntent(question) {
  // TODO Phase 3: 调用轻量 LLM 分类
  return null;
}

export default { callAI, classifyIntent };
