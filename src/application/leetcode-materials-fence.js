import { leetcodeDifficultyLabel } from '../domain/leetcode-top-100.js'
import { effectiveLeetcodeGuidance, isGuidedLeetcode, leetcodeGuidanceLabel } from '../domain/leetcode-guidance.js'

const DIFFICULTY_TONES = Object.freeze({ easy: 'success', medium: 'warn', hard: 'danger' })

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function inlineCode(value) {
  const normalized = text(value)
  return normalized ? `\`${normalized.replace(/`/g, '\u2019')}\`` : ''
}

function problemTitle(problem) {
  const id = text(problem.id)
  const title = text(problem.title)
  return [id, title].filter(Boolean).join('. ')
}

function badgeItems(problem, guidance) {
  const items = []
  if (problem.category) items.push({ type: 'badge', label: problem.category, tone: 'accent' })
  if (problem.difficulty) {
    items.push({
      type: 'badge',
      label: leetcodeDifficultyLabel(problem.difficulty),
      tone: DIFFICULTY_TONES[problem.difficulty] || 'accent',
    })
  } else if (problem.custom) {
    items.push({ type: 'badge', label: '自定义题目', tone: 'accent' })
  }
  items.push({ type: 'badge', label: leetcodeGuidanceLabel(guidance), tone: isGuidedLeetcode(guidance) ? 'success' : 'accent' })
  return items
}

function exampleTable(examples) {
  const hasNote = examples.some((example) => text(example.note))
  return {
    type: 'table',
    columns: hasNote ? ['输入', '输出', '说明'] : ['输入', '输出'],
    rows: examples.map((example) => (hasNote
      ? [inlineCode(example.input), inlineCode(example.output), text(example.note)]
      : [inlineCode(example.input), inlineCode(example.output)])),
  }
}

// 由题目材料构建一个 dsh-ui 组件树。渲染发生在浏览器里，这里只产出可序列化的规格。
export function createMaterialsSpec(question, { guidance } = {}) {
  const materials = question?.materials
  if (!materials) return null
  const problem = question.leetcode || {}
  const level = effectiveLeetcodeGuidance({ guidance })
  const items = [{ type: 'row', items: badgeItems(problem, level) }]

  if (text(materials.statement)) {
    items.push({ type: 'text', size: 'body', content: `**题意**：${text(materials.statement)}` })
  }
  if (materials.examples?.length) items.push(exampleTable(materials.examples))
  if (materials.constraints?.length) {
    items.push({
      type: 'list',
      items: materials.constraints.map((constraint) => inlineCode(constraint)),
    })
  }
  if (materials.knowledge?.length) {
    items.push({
      type: 'callout',
      tone: 'info',
      title: isGuidedLeetcode(level) ? '前置知识（先看这里再动手）' : '前置知识',
      content: materials.knowledge.map((item) => `**${text(item.title)}**：${text(item.detail)}`).join('\n\n'),
    })
  }
  if (materials.hints?.length) {
    items.push({
      type: 'accordion',
      items: materials.hints.map((hint, index) => ({
        title: `提示 ${index + 1}（卡住了再点开）`,
        items: [{ type: 'text', size: 'body', content: text(hint) }],
      })),
    })
  }
  if (materials.pitfalls?.length) {
    items.push({
      type: 'callout',
      tone: 'warning',
      title: '常见误区',
      content: materials.pitfalls.map((pitfall) => `- ${text(pitfall)}`).join('\n'),
    })
  }
  if (materials.related?.length) {
    items.push({
      type: 'keyvalue',
      pairs: materials.related.map((item) => {
        const slug = text(item.slug)
        const url = text(item.url) || (slug ? `https://leetcode.cn/problems/${slug}/` : '')
        return {
          key: [text(item.id), text(item.title)].filter(Boolean).join('. '),
          value: url ? `[打开题目](${url})` : '—',
        }
      }),
    })
  }
  const revealed = Math.min(Number(question.hintLevel) || 0, materials.hints?.length || 0)
  items.push({
    type: 'text',
    size: 'caption',
    content: revealed > 0
      ? `提示 ${revealed}/${materials.hints.length} 已解锁，题目卡上可以继续要下一级提示。`
      : '题目卡的「提示」按钮可以逐级解锁提示；「看答案」会给出完整解法与代码。',
  })
  const sourceLine = materialsSourceLine(materials.source)
  if (sourceLine) items.push({ type: 'text', size: 'caption', content: sourceLine })

  return {
    title: problemTitle(problem),
    gap: 12,
    items,
  }
}

// 材料来源说明：示例与数据范围来自官方题面，思路参考了用户自己的题解笔记。
export function materialsSourceLine(source) {
  if (!source || typeof source !== 'object') return ''
  const anchor = typeof source.anchor === 'string' ? source.anchor.replace(/^#+\s*/, '') : ''
  const parts = []
  parts.push(source.official ? '示例与数据范围取自官方题面' : '题目材料由 AI 撰写')
  if (source.file) parts.push(`参考了你的《${source.file}${anchor ? ` · ${anchor}` : ''}》，已按需重写`)
  return parts.join('；')
}
export function createMaterialsFence(question, options = {}) {  const spec = createMaterialsSpec(question, options)
  if (!spec) return ''
  return ['```dsh-ui', JSON.stringify(spec), '```'].join('\n')
}

export function materialsFenceInstruction(fence) {
  if (!fence) return ''
  return [
    '题目材料必须通过下面这个 dsh-ui 围栏直接展示在对话里。',
    '把围栏原文（含开头的 ```dsh-ui 和结尾的 ```）原样写进你的回复正文，不要改写 JSON、不要省略任何组件、不要再包一层代码块、不要用其他方式复述材料。',
    '围栏内容：\n',
    fence,
  ].join('')
}
