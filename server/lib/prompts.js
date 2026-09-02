// ============================================================
// lib/prompts.js · Oracle 三层 prompt 系统
// 创建：2026-09-02 02:00 · Phase 3
//
// 设计：
//   Layer 1 = 系统（角色 + 边界 + 塔罗专家人格）
//   Layer 2 = 上下文（牌阵 + 用户问题历史 + 当前状态）
//   Layer 3 = 深度层（1 浅 → 2 中 → 3 深，对话越深越具体）
// ============================================================

/**
 * Layer 1: 系统 prompt（角色 + 安全边界）
 * 这是整个对话的身份，所有追问都共用这一层
 */
export const SYSTEM_PROMPT = `你是「星语」，一位资深塔罗解读师，拥有 15 年从业经验。

# 你的角色
- 温暖但不软弱，直白但不冷血
- 像一位经验丰富的心理咨询师 + 塔罗专家
- 回答长度：150-350 字（追问场景），不要冗长
- 不重复牌阵报告已经说过的话，专注于「这一个追问」

# 塔罗解读原则
1. **基于事实**：始终引用具体牌名 + 含义 + 位置
2. **连接当下**：把牌意翻译成用户当下的生活场景
3. **引导行动**：每个回答都包含一个微小的下一步建议
4. **避免绝对**：用「倾向于」「可能」「建议」等措辞

# 安全边界（绝不越界）
- ❌ 股票 / 基金 / 加密货币投资建议（"请咨询理财顾问"）
- ❌ 医疗诊断 / 用药建议（"请咨询医生"）
- ❌ 政治立场 / 选举建议
- ❌ 代码 / 技术方案（"我无法提供技术细节"）
- ❌ 自杀 / 自残暗示 → 立即回应："我感受到你现在的痛苦。自杀热线 400-161-9995，请拨打寻求帮助。"
- ✅ 感情 / 工作 / 学业 / 自我成长 → 可以谈

# 拒答模板
当用户问题命中安全边界时，回复：
"抱歉，这个问题超出了我能给予建议的范围。[具体原因]。如果你想探索[相关但合规的话题]，我可以帮你。"

# 风格
- 用「你」不用「您」（亲切感）
- 不堆砌塔罗术语（用户听不懂就失去意义）
- 偶尔一个比喻或意象，让回答有画面感
- 结尾给一句温暖但不做作的话`;

/**
 * Layer 2: 上下文 prompt（牌阵 + 历史对话 + 当前问题）
 * 每次追问时构建
 *
 * @param {Object} ctx
 * @param {Object} ctx.spread - 原始牌阵报告
 * @param {Array} ctx.history - 历史对话 [{role, content}]
 * @param {Object} ctx.currentMessage - 当前用户问题 {content, depth_layer, preset_category}
 * @returns {string} userPrompt
 */
export function buildContextPrompt({ spread, history, currentMessage }) {
  const lines = [];

  // 1. 牌阵上下文
  if (spread) {
    lines.push('## 原始牌阵报告');
    lines.push('');
    lines.push(`**问题**：${spread.question || '未提供'}`);
    lines.push(`**牌阵类型**：${spread.spread_type || 'single'}`);
    if (spread.cards?.length) {
      lines.push(`**抽出牌**：`);
      spread.cards.forEach((c, i) => {
        const orientation = c.orientation === 'reversed' ? '（逆位）' : '';
        lines.push(`  ${i + 1}. ${c.name_cn || c.name}${orientation} — ${c.position_label || ''}`);
      });
    }
    if (spread.summary) {
      lines.push(`**核心摘要**：${spread.summary}`);
    }
    if (spread.sections?.length) {
      lines.push('');
      lines.push('**牌阵完整解读**：');
      spread.sections.forEach((s) => {
        lines.push(`### ${s.title}`);
        lines.push(s.body || '');
        lines.push('');
      });
    }
  } else {
    lines.push('## 原始牌阵');
    lines.push('（这是独立 Oracle 追问，没有关联牌阵）');
  }

  // 2. 对话历史
  if (history?.length) {
    lines.push('');
    lines.push('---');
    lines.push('## 之前的对话');
    lines.push('');
    history.forEach((msg, i) => {
      const role = msg.role === 'user' ? '用户' : '你';
      lines.push(`**${role}**：${msg.content}`);
      lines.push('');
    });
  }

  // 3. 当前用户问题
  lines.push('---');
  lines.push('## 当前问题');
  lines.push('');
  if (currentMessage.preset_category) {
    lines.push(`（用户从预设问题「${currentMessage.preset_category}」中选择）`);
  }
  lines.push(currentMessage.content);
  lines.push('');

  // 4. 深度层提示
  const depthHint = {
    1: '这是浅层追问。回答要简洁、直白、一针见血（150-200 字）。',
    2: '这是中层追问。可以适度展开，结合牌阵 + 用户处境（200-300 字）。',
    3: '这是深层追问。可以谈潜意识、原型、深层模式，但保持可操作性（300-400 字）。',
  };
  lines.push('## 解读深度指引');
  lines.push(depthHint[currentMessage.depth_layer] || depthHint[1]);
  lines.push('');
  lines.push('请直接给出你的解读，不需要重复牌阵信息。');

  return lines.join('\n');
}

/**
 * Layer 3: 深度层决策
 * 决定当前追问的深度层：
 *   - 第 1 轮：depth=1（浅）
 *   - 第 2-3 轮：depth=2（中）
 *   - 第 4+ 轮：depth=3（深）
 */
export function decideDepthLayer(messageCount) {
  if (messageCount <= 0) return 1; // 首条
  if (messageCount <= 2) return 1; // 第 1-2 轮
  if (messageCount <= 4) return 2; // 第 3-4 轮
  return 3; // 第 5+ 轮
}

/**
 * 牌阵报告 prompt 构建器（Phase 1.5 原始牌阵解读用）
 */
export function buildReadingPrompt({ spreadType, theme, cards, question }) {
  const lines = [];
  lines.push(`# 塔罗解读任务`);
  lines.push('');
  lines.push(`## 用户提问`);
  lines.push(question || '（未提供具体问题）');
  lines.push('');
  lines.push(`## 牌阵类型`);
  lines.push(spreadType || 'single');
  if (theme) {
    lines.push(`## 主题`);
    lines.push(theme);
    lines.push('');
  }
  lines.push(`## 抽出牌`);
  cards.forEach((c, i) => {
    const orientation = c.orientation === 'reversed' ? '（逆位）' : '';
    const position = c.position_label || c.position || `位置 ${i + 1}`;
    lines.push(`${i + 1}. ${position}：${c.name_cn || c.name}${orientation}`);
  });
  lines.push('');
  lines.push(`## 输出格式要求`);
  lines.push(`请按以下结构输出解读（Markdown）：`);
  lines.push('');
  lines.push(`## 牌阵总览`);
  lines.push(`（1-2 句总述牌阵整体能量）`);
  lines.push('');
  lines.push(`## 现状分析`);
  lines.push(`（2-3 段，结合具体牌与用户问题）`);
  lines.push('');
  lines.push(`## 挑战与机遇`);
  lines.push(`（2-3 段，挑战 + 机会并存）`);
  lines.push('');
  lines.push(`## 行动建议`);
  lines.push(`（2-3 段，具体可执行的建议）`);
  lines.push('');
  lines.push(`## 综合洞察`);
  lines.push(`（1 句总结）`);
  lines.push('');
  lines.push(`## 总结`);
  lines.push(`（1-2 句，金句型收尾）`);
  return lines.join('\n');
}

/**
 * 牌阵报告的系统 prompt（Phase 1.5 用）
 */
export const READING_SYSTEM_PROMPT = `你是 ARCANA ai，一位资深塔罗解读师。

# 风格
- 温暖但不软弱，直白但不冷血
- 1500-2000 字之间
- 用「你」不用「您」

# 安全边界（同 Oracle）
- ❌ 股票 / 医疗 / 政治 / 代码 / 自杀
- 命中即礼貌拒绝并给替代话题

# 输出
- Markdown 格式
- 严格按用户提供的章节标题输出
- 不要遗漏任何章节`;

export default {
  SYSTEM_PROMPT,
  buildContextPrompt,
  decideDepthLayer,
  buildReadingPrompt,
  READING_SYSTEM_PROMPT,
};