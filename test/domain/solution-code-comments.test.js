import test from 'node:test'
import assert from 'node:assert/strict'
import { assertSolutionCodeComments, solutionCommentNotes } from '../../src/domain/solution-code-comments.js'

const fence = (language, body) => `\x60\x60\x60${language}\n${body}\n\x60\x60\x60`

test('代码外的说明和字符串里的注释符号不能代替真正代码注释', () => {
  assert.throws(() => assertSolutionCodeComments('这里说明了变量用途。\n'+fence('python', 'x = "# 看起来像注释的字符串"\nreturn x'), 'python'), { code: 'LEETCODE_SOLUTION_COMMENTS_REQUIRED' })
  assert.equal(solutionCommentNotes('url = "https://example.com";', 'java').length, 0)
  assert.equal(solutionCommentNotes('s = """# 只是字符串内容"""', 'python').length, 0)
  assert.equal(solutionCommentNotes('# coding: utf-8\nx = 1 # type: ignore', 'python').length, 0)
})

test('Python 行内注释及 C/C++、Java、Go 的合法注释可以通过', () => {
  assert.doesNotThrow(() => assertSolutionCodeComments(fence('python','answer = 0 # 保存当前最长连续段\nreturn answer'),'python'))
  for (const language of ['cpp','c++','java','c','go','golang']) {
    const id = language === 'c++' ? 'cpp' : language === 'golang' ? 'go' : language
    assert.doesNotThrow(() => assertSolutionCodeComments(fence(language,'/* 保存当前最佳答案 */\nint answer = 0;'), id))
  }
})

test('每份答案实现都需要注释，较长实现不能只用一条笼统说明', () => {
  const first = fence('python','# 返回本次计算结果\nreturn 1')
  assert.throws(() => assertSolutionCodeComments(first+'\n\n'+fence('python','return 2'),'python'), { code: 'LEETCODE_SOLUTION_COMMENTS_REQUIRED' })
  const long = '# 这里保存计算结果\n'+Array.from({ length: 40 }, (_,i)=>`value_${i} = ${i}`).join('\n')
  assert.throws(() => assertSolutionCodeComments(fence('python',long),'python'), { code: 'LEETCODE_SOLUTION_COMMENTS_REQUIRED' })
})
