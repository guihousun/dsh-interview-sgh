import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationFixture } from '../support/application-fixture.js'
import { normalizeLeetcodeDifficulties, listLeetcodeProblems } from '../../src/domain/leetcode-problems.js'
import { createPractice } from '../../src/domain/practice.js'
import { dispatchCommand } from '../../src/adapters/http/command-dispatcher.js'
import { createAtomicToolDefinitions } from '../../src/adapters/dsh/atomic-tool-definitions.js'

const config = { language: 'python', guidance: 'guided', category: '哈希', difficulties: ['easy', 'medium'],
  referenceMaterials: [{ id: 'notes', name: 'notes.md', type: 'md', size: 20, text: '手推示例，关注边界。' }] }

async function setup(settings = config) {
  const fixture = applicationFixture()
  await fixture.application.createAtomicPractice('s1', { mode: 'leetcode', config: settings })
  const drawn = await fixture.application.drawAtomicLeetcode('s1', { selectionMode: 'ordered' })
  return { ...fixture, practiceId: drawn.references.practiceId, questionId: drawn.references.questionId }
}

test('训练标签接受多选并规范化，空标签兼容原来的全部难度配置', () => {
  assert.deepEqual(normalizeLeetcodeDifficulties(['Hard', '简单', 'medium', 'easy']), ['easy', 'medium', 'hard'])
  assert.throws(() => normalizeLeetcodeDifficulties(['expert']), { code: 'INVALID_LEETCODE_DIFFICULTIES' })
  assert.throws(() => normalizeLeetcodeDifficulties('easy'), { code: 'INVALID_LEETCODE_DIFFICULTIES' })
  const selected = listLeetcodeProblems({ category: '哈希', difficulties: ['medium'], limit: 100 })
  assert.deepEqual(selected.map((problem) => problem.slug), ['group-anagrams', 'longest-consecutive-sequence'])
  const old = createPractice({ id: 'p1', mode: 'leetcode', config: { language: 'python', guidance: 'standard', difficulties: [] }, now: 1 })
  assert.deepEqual(old.config, { language: 'python', guidance: 'standard' })
})

test('按专题顺序依次出题并循环，换题后保留难度范围与参考资料', async () => {
  const { application } = await setup()
  assert.equal((await application.readAtomicSession('s1')).resource.data.currentQuestion.leetcode.slug, 'two-sum')
  await application.setLeetcodeProblemCompletion('group-anagrams', true)
  for (const slug of ['group-anagrams', 'longest-consecutive-sequence', 'two-sum']) {
    const next = await application.drawNextAtomicLeetcode('s1', { selectionMode: 'ordered' })
    assert.equal(next.resource.data.leetcode.slug, slug)
    const current = (await application.readAtomicSession('s1')).resource.data.practice
    assert.deepEqual(current.config, config)
  }
})

test('改变专题从新范围第一道开始；显式选择全部会清除旧筛选', async () => {
  const { application } = await setup()
  const next = await application.drawNextAtomicLeetcode('s1', { selectionMode: 'ordered', filters: { category: '动态规划', difficulties: ['easy'] } })
  assert.equal(next.resource.data.leetcode.slug, 'climbing-stairs')
  assert.equal((await application.drawNextAtomicLeetcode('s1', { selectionMode: 'ordered' })).resource.data.leetcode.slug, 'pascals-triangle')
  await application.drawNextAtomicLeetcode('s1', { selectionMode: 'random', filters: { category: '', difficulties: [] } })
  const saved = (await application.readAtomicSession('s1')).resource.data.practice.config
  assert.equal(saved.category, undefined)
  assert.equal(saved.difficulties, undefined)
  assert.deepEqual(saved.referenceMaterials, config.referenceMaterials)
})

test('随机模式始终限制在选定专题和多选难度内，题目完成后也不会放宽范围', async () => {
  const { application } = await setup({ ...config, difficulties: ['medium'] })
  await application.setLeetcodeProblemCompletion('group-anagrams', true)
  await application.setLeetcodeProblemCompletion('longest-consecutive-sequence', true)
  for (let index = 0; index < 8; index += 1) {
    const next = await application.drawNextAtomicLeetcode('s1', { selectionMode: 'random' })
    assert.equal(next.resource.data.leetcode.category, '哈希')
    assert.equal(next.resource.data.leetcode.difficulty, 'medium')
  }
})

test('空题单或无效出题方式不会结束原练习、改变绑定或创建空练习', async () => {
  const { application, repository, practiceId } = await setup()
  const before = await repository.getPractice(practiceId)
  const binding = await repository.getSessionBinding('s1')
  await assert.rejects(application.advanceLeetcodePractice('s1', practiceId, { filters: { category: '哈希', difficulties: ['hard'] }, selectionMode: 'ordered' }), { code: 'LEETCODE_PROBLEM_NOT_FOUND' })
  await assert.rejects(application.advanceLeetcodePractice('s1', practiceId, { selectionMode: 'alphabetical' }), { code: 'INVALID_LEETCODE_SELECTION_MODE' })
  assert.deepEqual(await repository.getPractice(practiceId), before)
  assert.deepEqual(await repository.getSessionBinding('s1'), binding)
  assert.equal(repository.practices.size, 1)
})

test('重复点击工作台下一道只产生一份后续练习', async () => {
  const { application, repository, practiceId } = await setup()
  const results = await Promise.allSettled([application.advanceLeetcodePractice('s1', practiceId, { selectionMode: 'ordered' }), application.advanceLeetcodePractice('s1', practiceId, { selectionMode: 'ordered' })])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'PRACTICE_NOT_ACTIVE')
  assert.equal(repository.practices.size, 2)
})

test('从工作台推进选中的练习，释放其旧会话，并保留另一条原练习', async () => {
  const { application, repository, practiceId } = await setup()
  const other = await application.createAtomicPractice('editor', { mode: 'bagu', config: { topic: '另一条练习' } })
  const result = await application.advanceLeetcodePractice('editor', practiceId, { selectionMode: 'ordered' })
  assert.equal(result.resource.data.currentQuestion.leetcode.slug, 'group-anagrams')
  assert.equal(await repository.getSessionBinding('s1'), null)
  assert.equal((await repository.getPractice(other.resource.data.id)).status, 'active')
})

test('工作台顺序与随机按钮直接返回真实下一题，不自动请求 AI 出题', async () => {
  const { application, practiceId } = await setup()
  let requests = 0
  const runtime = { application, eventBridge: { dispatch() { requests += 1 } } }
  const ordered = await dispatchCommand(runtime, 's1', 'leetcode.practice-next', { practiceId, category: '哈希', difficulties: ['easy', 'medium'], selectionMode: 'ordered' })
  assert.equal(ordered.resource.data.currentQuestion.leetcode.slug, 'group-anagrams')
  const random = await dispatchCommand(runtime, 's1', 'leetcode.practice-next', { practiceId: ordered.resource.data.practice.id, selectionMode: 'random' })
  assert.equal(random.resource.data.currentQuestion.leetcode.category, '哈希')
  assert.equal(requests, 0)
})

test('从题库开始空题单前先校验，已有其他模式练习保持原样', async () => {
  const { application, repository } = applicationFixture()
  await application.createAtomicPractice('s1', { mode: 'bagu', config: { topic: '原练习' } })
  const binding = await repository.getSessionBinding('s1')
  const runtime = { application }
  for (const command of ['leetcode.train', 'session.start']) {
    await assert.rejects(dispatchCommand(runtime, 's1', command, { mode: 'leetcode', config: { ...config, difficulties: ['hard'] }, selectionMode: 'ordered' }), { code: 'LEETCODE_PROBLEM_NOT_FOUND' })
  }
  assert.deepEqual(await repository.getSessionBinding('s1'), binding)
  assert.equal(repository.practices.size, 1)
})

test('AI 原子工具与目录支持多选难度、专题和顺序模式', async () => {
  const { application } = applicationFixture()
  const tools = Object.fromEntries(createAtomicToolDefinitions(application).map((tool) => [tool.name, tool]))
  const exec = { agent: { session: { header: { id: 's1' } } } }
  await tools.interview_practice.execute({ operation: 'create', mode: 'leetcode', language: 'python', guidance: 'guided', category: '哈希', difficulties: ['medium'] }, exec)
  const first = await tools.interview_leetcode.execute({ operation: 'draw', selection_mode: 'ordered' }, exec)
  assert.equal(first.resource.data.leetcode.slug, 'group-anagrams')
  const next = await tools.interview_leetcode.execute({ operation: 'draw_next', selection_mode: 'ordered' }, exec)
  assert.equal(next.resource.data.leetcode.slug, 'longest-consecutive-sequence')
  const found = await tools.interview_leetcode.execute({ operation: 'search', category: '哈希', difficulties: ['easy'] }, exec)
  assert.deepEqual(found.resource.data.problems.map((problem) => problem.slug), ['two-sum'])
  const catalog = (await application.getLeetcodeCatalog()).resource.data
  assert.equal(catalog.difficultyTags, true)
  assert.equal(catalog.difficulties.reduce((sum, item) => sum + item.count, 0), 100)
})
