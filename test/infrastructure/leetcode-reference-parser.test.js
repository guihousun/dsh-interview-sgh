import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCsvRows, parseHardcodeMarkdown, parseLeetcodeCsv, parseNotesMarkdown, parseStatementBlocks,
  normalizeSuperscripts,
} from '../../src/infrastructure/leetcode-reference-parser.js'

test('题面解析支持带冒号与设计题两种写法', () => {
  const official = parseStatementBlocks([
    '给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出和为目标值的那两个整数，并返回它们的数组下标。',
    '',
    '示例 1：',
    '',
    '输入：nums = [2,7,11,15], target = 9',
    '输出：[0,1]',
    '解释：因为 nums[0] + nums[1] == 9 ，返回 [0, 1] 。',
    '',
    '示例 2：',
    '',
    '输入：nums = [3,2,4], target = 6',
    '输出：[1,2]',
    '',
    '提示：',
    '',
    '- 2 <= nums.length <= 104',
    '- 只会存在一个有效答案',
    '',
    '进阶：你可以想出一个时间复杂度小于 O(n2) 的算法吗？',
  ].join('\n'))
  assert.match(official.statement, /^给定一个整数数组 nums/)
  assert.equal(official.examples.length, 2)
  assert.deepEqual(official.examples[0], {
    input: 'nums = [2,7,11,15], target = 9',
    output: '[0,1]',
    note: '因为 nums[0] + nums[1] == 9 ，返回 [0, 1] 。',
  })
  assert.deepEqual(official.constraints, ['2 <= nums.length <= 10^4', '只会存在一个有效答案'])
  assert.equal(official.advanced, '你可以想出一个时间复杂度小于 O(n^2) 的算法吗？')

  // 设计题：`示例：` 无编号，输入输出无冒号且是多行 JSON。
  const design = parseStatementBlocks([
    '实现 LRUCache 类：',
    '',
    '示例：',
    '',
    '输入',
    '["LRUCache", "put", "get"]',
    '[[2], [1, 1], [1]]',
    '输出',
    '[null, null, 1]',
    '',
    '解释',
    'LRUCache lRUCache = new LRUCache(2);',
    'lRUCache.put(1, 1);',
  ].join('\n'))
  assert.equal(design.examples.length, 1)
  assert.equal(design.examples[0].input, '["LRUCache", "put", "get"]\n[[2], [1, 1], [1]]')
  assert.equal(design.examples[0].output, '[null, null, 1]')
  assert.equal(design.examples[0].note, 'LRUCache lRUCache = new LRUCache(2);\nlRUCache.put(1, 1);')
  assert.equal(design.constraints.length, 0)

  assert.deepEqual(parseStatementBlocks(''), { statement: '', examples: [], constraints: [], advanced: '' })
})

test('上标修正只动明确的幂次写法', () => {
  assert.equal(normalizeSuperscripts('0 <= m <= 106'), '0 <= m <= 10^6')
  assert.equal(normalizeSuperscripts('-109 <= nums[i]'), '-10^9 <= nums[i]')
  assert.equal(normalizeSuperscripts('相差 10-5 以内'), '相差 10^-5 以内')
  assert.equal(normalizeSuperscripts('O(n2) 的算法'), 'O(n^2) 的算法')
  // 不能误伤普通数字
  assert.equal(normalizeSuperscripts('数组长度 1048576'), '数组长度 1048576')
  assert.equal(normalizeSuperscripts('第 104 号用例'), '第 104 号用例')
  assert.equal(normalizeSuperscripts('10^4 已经是幂写法'), '10^4 已经是幂写法')
})

test('CSV 解析处理引号、逗号与字段内换行', () => {
  const rows = parseCsvRows('a,b,c\n1,"含,逗号","第一行\n第二行"\n2,"带""引号",\n')
  assert.deepEqual(rows[0], ['a', 'b', 'c'])
  assert.deepEqual(rows[1], ['1', '含,逗号', '第一行\n第二行'])
  assert.deepEqual(rows[2], ['2', '带"引号', ''])
  assert.equal(parseCsvRows('').length, 0)

  const records = parseLeetcodeCsv([
    'order,group,frontend_id,title_cn,title_slug,difficulty,url,tags_cn,content_cn',
    '1,哈希,1,两数之和,two-sum,Easy,https://leetcode.cn/problems/two-sum/,"数组、哈希表","题意第一段\n\n示例 1：\n\n输入：nums = [2,7], target = 9\n输出：[0,1]\n\n提示：\n\n- 2 <= nums.length <= 104"',
    ',,242,有效的字母异位词,valid-anagram,Easy,https://leetcode.cn/problems/valid-anagram/,"哈希表","只有题意没有示例"',
  ].join('\n'))
  assert.equal(records.length, 2)
  assert.equal(records[0].slug, 'two-sum')
  assert.equal(records[0].category, '哈希')
  assert.equal(records[0].difficulty, 'easy')
  assert.deepEqual(records[0].tags, ['数组', '哈希表'])
  assert.equal(records[0].examples[0].output, '[0,1]')
  assert.deepEqual(records[0].constraints, ['2 <= nums.length <= 10^4'])
  assert.equal(records[1].category, '')
  assert.equal(records[1].examples.length, 0)
})

const NOTES_FIXTURE = [
  '# Hot100 栈题解',
  '',
  '核心：`栈就是后进先出的盒子。`',
  '',
  '## 栈预备课',
  '',
  '### 1. 什么是栈',
  '',
  '后进先出。',
  '',
  '### 2. 什么是单调栈',
  '',
  '栈里保持单调。',
  '',
  '## 一、专题题目',
  '',
  '- 20. 有效的括号',
  '',
  '---',
  '',
  '## 20. 有效的括号',
  '',
  '### 题目',
  '',
  '原题：[20. 有效的括号](https://leetcode.cn/problems/valid-parentheses/)',
  '',
  '给定一个只包括括号的字符串 s，判断字符串是否有效。',
  '',
  '示例 1：',
  '',
  '输入：s = "()"',
  '输出：true',
  '',
  '提示：',
  '',
  '- 1 <= s.length <= 104',
  '',
  '### 背景知识',
  '',
  '括号匹配天然适合栈。',
  '',
  '### 思路',
  '',
  '遇到左括号入栈，遇到右括号看栈顶是否配对。',
  '',
  '### 口诀',
  '',
  '`左括号进，右括号配`',
  '',
  '### 图解',
  '',
  '```text',
  '( -> 入栈',
  ') -> 栈顶是 ( -> 出栈',
  '```',
  '',
  '### Python',
  '',
  '```python',
  'class Solution:',
  '    def isValid(self, s):',
  '        return True',
  '```',
  '',
  '### 复杂度',
  '',
  '- 时间复杂度：`O(n)`',
  '- 空间复杂度：`O(n)`',
  '',
  '### 更优版思路',
  '',
  '用哈希表存配对关系，代码更短。',
  '',
  '### 更优版 Python',
  '',
  '```python',
  'def solve(s):',
  '    return True',
  '```',
  '',
  '### 常见出错点',
  '',
  '奇数长度可以直接返回 false。',
  '',
  '---',
  '',
  '## 21. 缺失链接的题',
  '',
  '### 思路',
  '',
  '这题没有原题链接，解析器应该忽略它。',
].join('\n')

test('分册题解解析出专题前置知识、题目字段与变体', () => {
  const parsed = parseNotesMarkdown(NOTES_FIXTURE, { file: 'Hot100_栈题解.md' })
  assert.equal(parsed.core, '`栈就是后进先出的盒子。`')
  assert.deepEqual(parsed.topics.map((topic) => topic.title), ['1. 什么是栈', '2. 什么是单调栈'])
  assert.match(parsed.topics[1].detail, /单调/)

  // 没有原题链接的段落解析不出 slug，导入时会被丢弃
  assert.deepEqual(parsed.problems.map((problem) => problem.slug), ['valid-parentheses', ''])
  const problem = parsed.problems[0]
  assert.equal(problem.number, '20')
  assert.equal(problem.title, '有效的括号')
  assert.equal(problem.sourceAnchor, '## 20. 有效的括号')
  const main = problem.variants.default
  assert.equal(main.statement, '给定一个只包括括号的字符串 s，判断字符串是否有效。')
  assert.equal(main.examples[0].input, 's = "()"')
  assert.deepEqual(main.constraints, ['1 <= s.length <= 10^4'])
  assert.match(main.idea, /左括号入栈/)
  assert.equal(main.mnemonic, '`左括号进，右括号配`')
  assert.equal(main.diagram, '( -> 入栈\n) -> 栈顶是 ( -> 出栈')
  assert.match(main.code, /def isValid/)
  assert.match(main.complexity, /O\(n\)/)
  assert.match(main.background, /天然适合栈/)
  assert.deepEqual(main.notes.map((item) => item.title), ['常见出错点'])
  assert.match(problem.variants.better.idea, /哈希表存配对关系/)
  assert.match(problem.variants.better.code, /def solve/)
})

test('硬背版解析出题目、口诀、伪代码与代码', () => {
  const parsed = parseHardcodeMarkdown([
    '# Hot100 官方 Easy 硬背版',
    '',
    '## 1. 哈希：1. 两数之和',
    '',
    '题目：给定数组 nums 和目标值 target，返回两个数的下标。',
    '',
    '口诀：边遍历边找另一半。',
    '',
    '思路伪代码：',
    '',
    '```text',
    '创建字典 pos',
    '遍历 nums',
    '```',
    '',
    '```python',
    'def solve(nums, target):',
    '    pos = {}',
    '    return []',
    '```',
  ].join('\n'), { file: 'Hot100_简单题硬背版.md' })
  assert.equal(parsed.problems.length, 1)
  const problem = parsed.problems[0]
  assert.equal(problem.number, '1')
  assert.equal(problem.title, '两数之和')
  assert.equal(problem.topic, '哈希')
  assert.equal(problem.mnemonic, '边遍历边找另一半。')
  assert.equal(problem.pseudocode, '创建字典 pos\n遍历 nums')
  assert.match(problem.code, /def solve/)
  assert.match(problem.statement, /给定数组 nums/)
})
