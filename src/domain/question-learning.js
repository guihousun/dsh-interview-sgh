import { effectiveLeetcodeGuidance, leetcodeHintBudget } from './leetcode-guidance.js'

const MERGE_INTERVALS = {
  knowledge: [
    { title: '先理解闭区间', detail: '区间 [start, end] 包含两个端点。先看题目示例中首尾相接的区间如何处理，再定义你的“重叠”判断。' },
    { title: '把输入顺序与覆盖范围分开', detail: '输出需要保留的是区间覆盖的范围。先确认输入是否有序、输出是否允许重新排列，以及一个区间完全包含另一个时应该怎样处理。' },
  ],
  hints: [
    '先手推两个示例：[1,3] 与 [2,6] 为什么合并？[1,4] 与 [4,5] 是否也合并？用左右端点关系描述“重叠”，暂时不写代码。',
    '当输入区间顺序很乱时，能否先按某个端点排列，让每次只需要与一个已处理区间比较？试着手工重排示例，再观察比较顺序。',
    '考虑“目前已经合并的最后一个区间”和“当前输入区间”。遇到不重叠、部分重叠、完全包含这三种情况，哪些端点保持不变，哪些需要更新？',
    '先写首个区间如何进入结果，再逐个处理后续区间。为两种分支分别写出判断与更新，并检查相接、包含、单个区间这三个边界；由你完成代码。',
  ],
}

const GENERAL_HINTS = [
  '先画出第一个示例的输入与输出，用自己的话描述任务。用最小的合法输入手推一次，明确需要返回什么，而不是先套算法模板。',
  '先提出一个保证正确的直观办法，再数一数它重复做了什么。结合输入规模，判断这样的时间复杂度是否可接受。',
  '把“已处理部分”与“未处理部分”分开：需要保存什么状态，才能避免重复计算？比较可能的数据结构，说明你选择它的理由。',
  '把思路拆成初始化、每一步更新、终止条件与返回结果。先核对最小输入和边界，再自己写代码，并手工推演示例。',
]

export function learningHints(practice, question) {
  const saved = question.materials?.hints
  if (saved?.length) return saved
  const prepared = (question.leetcode || question.hot100)?.slug === 'merge-intervals' ? MERGE_INTERVALS.hints : GENERAL_HINTS
  return prepared.slice(0, leetcodeHintBudget(effectiveLeetcodeGuidance(practice.config)))
}

export function questionLearningView(practice, question, reference = null) {
  const materials = question.materials || {}
  const problem = question.leetcode || question.hot100 || null
  const guided = practice.mode === 'leetcode' && effectiveLeetcodeGuidance(practice.config) === 'guided'
  const hints = problem && practice.mode === 'leetcode' ? learningHints(practice, question) : []
  const hintLevel = Math.min(Number(question.hintLevel) || 0, hints.length)
  const knowledge = materials.knowledge?.length ? materials.knowledge
    : problem?.slug === 'merge-intervals' ? MERGE_INTERVALS.knowledge : []
  // 学习视图只返回题面与已解锁提示，不返回题解笔记、答案代码或未来提示。
  return {
    questionId: question.id,
    problem: {
      title: problem?.title || question.prompt,
      statement: reference?.statement || materials.statement || (problem ? '' : question.prompt),
      examples: reference?.examples?.length ? reference.examples : materials.examples || [],
      constraints: reference?.constraints?.length ? reference.constraints : materials.constraints || [],
      advanced: reference?.advanced || '',
      url: reference?.url || problem?.url || '',
      source: reference?.statement ? (reference.officialSource === 'csv' ? 'LeetCode 题面 · 本地快照' : 'LeetCode 题面') : materials.statement ? '已保存的题目材料' : '',
    },
    guidance: {
      enabled: guided,
      introduction: '先读懂输入、输出和约束，用示例手推一遍；想清楚每一步需要保留的信息，再开始编码。卡住时逐级解锁引导，正确答案不会自动展开。',
      knowledge: guided ? knowledge : [],
      revealedHints: hints.slice(0, hintLevel),
      hintLevel, hintTotal: hints.length,
      canReveal: practice.mode === 'leetcode' && practice.status === 'active' && hints.length > hintLevel,
    },
  }
}

export function learningMaterials(practice, question, reference) {
  const view = questionLearningView(practice, question, reference)
  if (!view.problem.statement) return null
  return {
    ...(question.materials || {}),
    statement: view.problem.statement,
    examples: view.problem.examples, constraints: view.problem.constraints,
    hints: learningHints(practice, question), knowledge: view.guidance.knowledge,
    pitfalls: question.materials?.pitfalls || [], related: question.materials?.related || [],
    source: { kind: 'model', official: Boolean(reference?.statement), url: view.problem.url },
  }
}

export function questionSolutionView(practice, question, reference = null) {
  if (practice.mode === 'mock') return { available: false, allowed: false, reason: '模拟面试不主动展示参考答案。' }
  if (question.explanation) return { available: true, allowed: true, source: 'AI 讲解', ...question.explanation }
  const language = practice.config?.language || 'python'
  if (reference?.code && language === 'python') {
    const fence = '`'.repeat((reference.code.match(/`+/g) || []).reduce((max, run) => Math.max(max, run.length), 2) + 1)
    return {
      available: true, allowed: true, source: '本地题解库 · Python 参考题解',
      detail: [reference.idea, reference.steps, `${fence}python\n${reference.code}\n${fence}`, reference.complexity].filter(Boolean).join('\n\n'),
      memorizationPoints: reference.mnemonic || '',
    }
  }
  return { available: false, allowed: true, reason: reference?.code ? '题解库没有当前语言的参考答案，可以让 AI 生成。' : '这道题还没有保存参考答案，可以让 AI 生成。' }
}
