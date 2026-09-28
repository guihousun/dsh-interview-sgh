import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationFixture } from '../support/application-fixture.js'
import { InterviewApplication } from '../../src/application/interview-application.js'

async function setup(slug = 'two-sum') {
  const f = applicationFixture()
  await f.application.createAtomicPractice('s1', { mode: 'leetcode', config: { language: 'python', guidance: 'guided' } })
  const ids = (await f.application.drawAtomicLeetcode('s1', { selection: { slug } })).references
  return { ...f, ...ids, slug }
}
const progress = async (f) => (await f.repository.listLeetcodeProgress()).find((item) => item.slug === f.slug)
const answer = async (f) => (await f.application.createAtomicAttempt('s1', { questionId: f.questionId, answer: '我的解法' })).resource.data.id
const evaluate = (f, attemptId, score = 8) => f.application.createAtomicEvaluation('s1', { questionId: f.questionId, attemptId, score, feedback: '已分析本次作答的边界与修改建议' })
function restart(f) {
  const app = f.application
  f.application = new InterviewApplication({ repository: f.repository, clock: app.clock, ids: app.ids, random: app.random, events: app.events, exporter: app.exporter })
}

test('题目收到 AI 点评后自动打勾，不设分数门槛，重复练习保留首次完成时间', async () => {
  const f = await setup()
  const attempt = await answer(f)
  assert.equal(await progress(f), undefined)
  await evaluate(f, attempt, 4)
  const first = await progress(f)
  assert.equal(first.completed, true)
  assert.equal((await f.application.getLeetcodeCatalog()).resource.data.completedCount, 1)
  const second = await answer(f)
  await evaluate(f, second, 9)
  assert.deepEqual(await progress(f), first)
  assert.equal((await f.application.getLeetcodeCatalog()).resource.data.completedCount, 1)
})

test('读题、看答案、结束和跳过没有作答的题目均不自动标记', async () => {
  const f = await setup()
  await f.application.getQuestionLearning(f.practiceId, f.questionId)
  await f.application.getQuestionSolution(f.practiceId, f.questionId)
  const next = await f.application.drawNextAtomicLeetcode('s1', { selection: { slug: 'group-anagrams' } })
  await f.application.completeAtomicPractice('s1')
  assert.equal(next.resource.data.leetcode.slug, 'group-anagrams')
  assert.deepEqual(await f.repository.listLeetcodeProgress(), [])
})

test('用户结束或切换已作答的练习时同步完成标记，不需要额外调用 AI', async () => {
  for (const action of ['end', 'next', 'workspace-next']) {
    const f = await setup()
    await answer(f)
    if (action === 'end') await f.application.completeAtomicPractice('s1')
    else if (action === 'next') await f.application.drawNextAtomicLeetcode('s1', { selection: { slug: 'group-anagrams' } })
    else await f.application.advanceLeetcodePractice('s1', f.practiceId, { selection: { slug: 'group-anagrams' } })
    assert.equal((await progress(f)).completed, true)
    assert.equal((await f.repository.getPractice(f.practiceId)).questions[0].attempts.length, 1)
  }
})

test('手动取消会保持取消，刷新与重启不重勾；新作答点评后可再次完成', async () => {
  const f = await setup()
  await evaluate(f, await answer(f))
  await f.application.setLeetcodeProblemCompletion(f.slug, false)
  const cancelled = await progress(f)
  restart(f)
  await f.application.getLeetcodeCatalog()
  await f.application.getLeetcodeCatalog()
  assert.deepEqual(await progress(f), cancelled)
  await evaluate(f, await answer(f))
  assert.equal((await progress(f)).completed, true)
})

test('手动取消后到达的旧作答点评或结束操作不重新打勾，新作答可以', async () => {
  const f = await setup()
  const pendingAttempt = await answer(f)
  await f.application.setLeetcodeProblemCompletion(f.slug, false)
  await evaluate(f, pendingAttempt)
  assert.equal((await progress(f)).completed, false)
  await f.application.completeAtomicPractice('s1')
  assert.equal((await progress(f)).completed, false)
  await f.application.reopenAtomicPractice('s1', f.practiceId)
  await evaluate(f, await answer(f))
  assert.equal((await progress(f)).completed, true)
})

test('升级同步历史已点评或已作答结束的题目，只补齐缺失记录，不改变手动标记', async () => {
  const f = await setup()
  const attempt = await answer(f)
  const practice = await f.repository.getPractice(f.practiceId)
  practice.questions[0].attempts[0].evaluation = { score: 8, feedback: '旧点评', dimensions: {}, evaluatedAt: 100 }
  await f.repository.commit({ practice })
  const before = await f.repository.getPractice(f.practiceId)
  restart(f)
  assert.equal((await f.application.getLeetcodeCatalog()).resource.data.completedCount, 1)
  assert.equal((await progress(f)).completedAt, 100)
  assert.deepEqual(await f.repository.getPractice(f.practiceId), before)
  assert.equal((await f.repository.getPractice(f.practiceId)).questions[0].attempts[0].id, attempt)
  await f.application.setLeetcodeProblemCompletion(f.slug, false)
  restart(f)
  assert.equal((await f.application.getLeetcodeCatalog()).resource.data.completedCount, 0)
  const g = await setup('group-anagrams')
  await answer(g)
  const ended = await g.repository.getPractice(g.practiceId)
  ended.status = 'completed'; ended.completedAt = 105
  await g.repository.commit({ practice: ended })
  restart(g)
  assert.equal((await g.application.getLeetcodeCatalog()).resource.data.completedCount, 1)
})

test('评价校验失败不标记完成，模拟面试和自定义题不污染热题进度', async () => {
  const f = await setup()
  await assert.rejects(evaluate(f, 'missing-attempt'), /找不到作答/)
  assert.deepEqual(await f.repository.listLeetcodeProgress(), [])
  const custom = await setup('my-custom-problem')
  await evaluate(custom, await answer(custom))
  await custom.application.completeAtomicPractice('s1')
  assert.deepEqual(await custom.repository.listLeetcodeProgress(), [])
  const mock = applicationFixture()
  await mock.application.createAtomicPractice('s1', { mode: 'mock', config: { targetRole: '开发', resume: '学习经历', jobDescriptionProvided: false,
    difficulty: 'intermediate', interviewerStyle: '专业追问', coding: true } })
  const q = (await mock.application.drawAtomicMockCodingQuestion('s1')).references
  await mock.application.createAtomicAttempt('s1', { questionId: q.questionId, answer: '面试代码' })
  await mock.application.completeAtomicPractice('s1')
  assert.deepEqual(await mock.repository.listLeetcodeProgress(), [])
})
