import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { INTERVIEW_TOOL_NAMES } from '../../src/protocol/interview-tool-names.js'
import { INTERACTION_PROTOCOL } from '../../src/protocol/interaction-protocol.js'

function loadPlugin() {
  const source = readFileSync(new URL('../../client/client.js', import.meta.url), 'utf8')
  let plugin = null
  const appended = []
  const fakeReact = {
    Fragment: Symbol('Fragment'),
    createElement: (...args) => ({ args }),
    useState: () => [null, () => {}],
    useEffect: () => {},
    useCallback: (callback) => callback,
  }
  vm.runInNewContext(source, {
    console,
    URLSearchParams,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setTimeout,
    clearTimeout,
    document: {
      getElementById: () => null,
      createElement: () => ({}),
      head: { appendChild: (node) => appended.push(node) },
    },
    window: { __ModuleLoader__: { load(definition) { plugin = definition.factory((name) => name === 'react' ? fakeReact : {}) } } },
  })
  return { plugin, appended }
}

function settled(interaction, extra = {}) {
  return {
    kind: 'tool-result',
    content: [{ type: 'text', text: JSON.stringify({ protocol: INTERACTION_PROTOCOL, ...interaction }) }],
    ...extra,
  }
}

test('构建后的 Client 注册全部原子工具视图和时间轴槽位', () => {
  const { plugin, appended } = loadPlugin()
  const registrations = []
  const slots = {
    inject(_name, callback) { callback() },
    register(config) { registrations.push(config); return () => {} },
  }
  plugin.apply({ get: () => slots })

  assert.equal(appended.length, 1)
  assert.deepEqual(
    registrations.filter((item) => item.name === 'tool.call.toolview').map((item) => item.key),
    INTERVIEW_TOOL_NAMES,
  )
  const dockIds = registrations.filter((item) => item.name === 'conversation.input.dock').map((item) => item.id)
  assert.deepEqual(dockIds, ['interview-workspace', 'interview-timeline'])
})

test('Client 只使用 DSH 当前会话身份且不共享练习游标', () => {
  const source = readFileSync(new URL('../../src/client/index.js', import.meta.url), 'utf8')
  const leetcode = readFileSync(new URL('../../src/client/features/leetcode.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /sessionId\s*\|\|\s*['"]global['"]/)
  assert.doesNotMatch(leetcode, /sessionId\s*=\s*['"]global['"]/)
  assert.match(source, /sessionId: props\.sessionId/)
})

test('工具视图只按结构化 artifact 渲染用户可见卡片', () => {
  const { plugin } = loadPlugin()
  assert.equal(plugin.resolveToolView('interview_practice', { argsRaw: '{}' }).kind, 'hidden')
  assert.equal(plugin.resolveToolView('interview_practice', settled({ revision: 1, artifact: null })).kind, 'hidden')

  const setup = plugin.resolveToolView('interview_show_practice_setup', settled({
    revision: 0,
    artifact: { kind: 'practice-setup', presentationId: 'setup-1' },
  }))
  assert.deepEqual(JSON.parse(JSON.stringify(setup)), {
    kind: 'practice-setup', presentationId: 'setup-1', revision: 0, toolName: 'interview_show_practice_setup',
  })

  const question = plugin.resolveToolView('interview_show_question', settled({
    revision: 2,
    artifact: { kind: 'question', practiceId: 'p1', questionId: 'q1' },
  }))
  assert.deepEqual(JSON.parse(JSON.stringify(question)), {
    kind: 'question', practiceId: 'p1', questionId: 'q1', revision: 2, toolName: 'interview_show_question',
  })

  const review = plugin.resolveToolView('interview_show_review', settled({
    revision: 5,
    artifact: { kind: 'review', practiceId: 'p1', questionId: 'q1', attemptId: 'a1' },
  }))
  assert.deepEqual(JSON.parse(JSON.stringify(review)), {
    kind: 'review', practiceId: 'p1', questionId: 'q1', attemptId: 'a1', revision: 5, toolName: 'interview_show_review',
  })

  const recoverable = plugin.resolveToolView('interview_show_question', settled({
    revision: 0,
    artifact: null,
    error: { audience: 'agent', recoverable: true },
  }))
  assert.equal(recoverable.kind, 'hidden')

  const failed = plugin.resolveToolView('interview_show_question', {
    kind: 'tool-result', isError: true, content: [{ type: 'text', text: 'schema validation failed' }],
  })
  assert.equal(failed.kind, 'error')

  const invalidArguments = plugin.resolveToolView('interview_question', {
    kind: 'tool-result',
    isError: true,
    error: { code: 'INVALID_ARGS' },
    content: [{ type: 'text', text: 'Error: invalid arguments: prompt is required' }],
  })
  assert.equal(invalidArguments.kind, 'hidden')
})

test('Client 与服务端共享交互协议版本并拒绝过期结果', () => {
  const { plugin } = loadPlugin()
  const artifact = { kind: 'question', practiceId: 'p1', questionId: 'q1' }

  assert.equal(
    plugin.resolveToolView('interview_show_question', settled({ revision: 1, artifact })).kind,
    'question',
  )
  assert.equal(
    plugin.resolveToolView('interview_show_question', {
      kind: 'tool-result',
      content: [{ type: 'text', text: JSON.stringify({ protocol: 'dsh-interview/interaction-v1', revision: 1, artifact }) }],
    }).kind,
    'hidden',
  )
})

test('界面只对主标题使用粗体且不渲染装饰性副标题', () => {
  const featureFiles = [
    '../../src/client/features/leetcode.js',
    '../../src/client/features/live-interview.js',
    '../../src/client/features/practice-config.js',
    '../../src/client/features/practice-library.js',
    '../../src/client/features/timeline.js',
    '../../src/client/features/workspace-dock.js',
    '../../src/client/shared/ui.js',
  ]
  const components = featureFiles
    .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
    .join('\n')
  const styles = readFileSync(new URL('../../src/client/shared/styles.js', import.meta.url), 'utf8')

  assert.doesNotMatch(components, /di-(?:eyebrow|subtitle)/)
  assert.doesNotMatch(components, /h\('strong'/)
  assert.doesNotMatch(styles, /font-weight:\s*[5-9]\d{2}/)
  assert.match(styles, /--di-weight-text:400/)
  assert.match(styles, /--di-weight-title:600/)
})

test('工作台按进行中与已结束状态分离练习', () => {
  const workspace = readFileSync(new URL('../../src/client/features/workspace-dock.js', import.meta.url), 'utf8')
  const library = readFileSync(new URL('../../src/client/features/practice-library.js', import.meta.url), 'utf8')
  const entry = readFileSync(new URL('../../src/client/index.js', import.meta.url), 'utf8')
  const interactionArtifact = readFileSync(new URL('../../src/application/interaction-artifact.js', import.meta.url), 'utf8')

  assert.match(workspace, /id: 'active', label: '进行中'/)
  assert.match(workspace, /statusScope: 'active'/)
  assert.match(workspace, /statusScope: 'completed'/)
  assert.doesNotMatch(workspace, /label: '当前练习'/)
  assert.doesNotMatch(workspace, /LiveInterviewCard/)
  assert.doesNotMatch(entry, /LiveInterviewCard|live-session/)
  assert.doesNotMatch(interactionArtifact, /LIVE_SESSION|live-session/)
  assert.match(library, /statusScope = 'completed'/)
  assert.match(library, /statusScope === 'active' \? 'active' : 'completed'/)
  assert.doesNotMatch(library, /全部状态/)
})

test('工作台可变查询每次直接读取后端数据', () => {
  const library = readFileSync(new URL('../../src/client/features/practice-library.js', import.meta.url), 'utf8')

  assert.match(library, /interviewApi\.practices\(filters\)[\s\S]{0,160}\{ cache: false \}/)
  assert.match(library, /interviewApi\.practice\(visibleSelectedId\)[\s\S]{0,180}\{ cache: false \}/)
  assert.match(library, /interviewApi\.insights\(\), \[\], \{ cache: false \}/)
})

test('力扣题目卡使用讲解入口且不重复展示题目列表入口', () => {
  const leetcode = readFileSync(new URL('../../src/client/features/leetcode.js', import.meta.url), 'utf8')
  const liveInterview = readFileSync(new URL('../../src/client/features/live-interview.js', import.meta.url), 'utf8')
  assert.doesNotMatch(leetcode, /查看题目列表|收起题目列表/)
  assert.match(leetcode, /run\('question\.reveal'/)
  assert.match(leetcode, /}, '讲解'\)/)
  assert.match(leetcode, /'解题要点'/)
  assert.match(liveInterview, /isLeetcode \? '解题要点' : '直接背'/)
  assert.match(liveInterview, /!isLeetcode \? h\(Button/)
})

test('力扣练习表单必须显式选择编程语言', () => {
  const config = readFileSync(new URL('../../src/client/features/practice-config.js', import.meta.url), 'utf8')
  assert.match(config, /initial\?\.config\?\.language \|\| ''/)
  assert.match(config, /mode === 'leetcode' \? Boolean\(language\)/)
  assert.match(config, /h\('span', null, '编程语言'\)/)
  assert.match(config, /config: \{ language \}/)
})

test('力扣结束卡和档案只展示本次刷题汇总', () => {
  const liveInterview = readFileSync(new URL('../../src/client/features/live-interview.js', import.meta.url), 'utf8')
  const library = readFileSync(new URL('../../src/client/features/practice-library.js', import.meta.url), 'utf8')
  assert.match(liveInterview, /summary\?\.kind === 'leetcode'/)
  assert.match(liveInterview, /本次共记录/)
  assert.match(library, /刷题汇总/)
})

test('力扣切题不使用本地临时卡片槽位', () => {
  const leetcode = readFileSync(new URL('../../src/client/features/leetcode.js', import.meta.url), 'utf8')
  const api = readFileSync(new URL('../../src/client/shared/api.js', import.meta.url), 'utf8')
  const index = readFileSync(new URL('../../src/client/index.js', import.meta.url), 'utf8')

  assert.match(leetcode, /transition\.run\('question\.next'\)/)
  assert.match(leetcode, /const current = initialQuestion/)
  assert.match(leetcode, /const active = artifactActive/)
  assert.doesNotMatch(index, /interview-latest-question/)
  assert.doesNotMatch(api, /subscribeLocalQuestions/)
})

test('会话中的下一题不会改变先前力扣消息卡片', () => {
  const leetcode = readFileSync(new URL('../../src/client/features/leetcode.js', import.meta.url), 'utf8')
  const liveInterview = readFileSync(new URL('../../src/client/features/live-interview.js', import.meta.url), 'utf8')

  assert.match(leetcode, /const current = initialQuestion/)
  assert.match(leetcode, /session\.revision === artifact\.sessionRevision/)
  assert.match(leetcode, /const transition = useCardTransition\(command\.run, artifact, !artifactActive\)/)
  assert.doesNotMatch(leetcode, /live = false|sessionQuestion/)
  assert.match(liveInterview, /LeetcodeProblemCard, \{ sessionId, initialQuestion: question, artifact, language: practice\.config\?\.language/)
})

test('重新作答只切换题目状态且不主动打开练习工作台', () => {
  const liveInterview = readFileSync(new URL('../../src/client/features/live-interview.js', import.meta.url), 'utf8')
  const library = readFileSync(new URL('../../src/client/features/practice-library.js', import.meta.url), 'utf8')

  assert.doesNotMatch(liveInterview, /navigateWorkspace\('active'\)/)
  assert.doesNotMatch(library, /question\.retry[\s\S]{0,160}navigateWorkspace/)
})

test('力扣随机下一题点击后立即锁定为已出下一题', () => {
  const leetcodeSource = readFileSync(new URL('../../src/client/features/leetcode.js', import.meta.url), 'utf8')
  assert.match(leetcodeSource, /transition\.consumedBy === 'question\.next'/)
  assert.match(leetcodeSource, /disabled: transition\.locked/)
  assert.doesNotMatch(leetcodeSource, /nextRequestedRef|nextRequested/)
})

test('任一流程操作都会消费并锁定整张卡片', () => {
  const liveInterview = readFileSync(new URL('../../src/client/features/live-interview.js', import.meta.url), 'utf8')
  const transition = readFileSync(new URL('../../src/client/shared/card-transition.js', import.meta.url), 'utf8')
  assert.match(transition, /consumedRef\.current = true/)
  assert.match(transition, /setConsumedBy\(action\)/)
  assert.match(transition, /const locked = disabled \|\| Boolean\(consumedBy\)/)
  assert.doesNotMatch(transition, /catch|setConsumedBy\(''\)/)
  assert.match(liveInterview, /transition\.run\('question\.reveal'\)/)
  assert.match(liveInterview, /transition\.run\('question\.next'\)/)
  assert.match(liveInterview, /transition\.run\('question\.retry'\)/)
  assert.match(liveInterview, /transition\.run\('session\.finish'\)/)
  assert.doesNotMatch(liveInterview, /revealRequestedRef|nextRequestedRef|nextRequested/)
})

test('新建练习配置卡复用工作台表单且提交后消费整张卡片', () => {
  const config = readFileSync(new URL('../../src/client/features/practice-config.js', import.meta.url), 'utf8')
  const entry = readFileSync(new URL('../../src/client/index.js', import.meta.url), 'utf8')
  assert.match(config, /export function PracticeConfigForm/)
  assert.match(config, /export function PracticeSetupCard/)
  assert.match(config, /lifecycle\.enter\('session\.start'/)
  assert.match(config, /disabled: lifecycle\.locked/)
  assert.match(config, /submitLabel: lifecycle\.consumedBy \? '已提交' : '开始练习'/)
  assert.match(entry, /case 'practice-setup': return h\(PracticeSetupCard/)
})

test('练习配置先选择模式再填写配置且下拉层不被卡片裁切', () => {
  const config = readFileSync(new URL('../../src/client/features/practice-config.js', import.meta.url), 'utf8')
  const styles = readFileSync(new URL('../../src/client/shared/styles.js', import.meta.url), 'utf8')
  assert.match(config, /useState\(initial \? 'config' : 'mode'\)/)
  assert.match(config, /setStep\('config'\)/)
  assert.match(config, /'选择模式'/)
  assert.match(config, /'填写配置'/)
  assert.match(config, /className: 'di-mode-options'/)
  assert.match(config, /step === 'config' \? h\(Button, \{ disabled, onClick: \(\) => setStep\('mode'\) \}, '上一步'\)/)
  assert.doesNotMatch(config, /value: mode, options: PRACTICE_MODE_OPTIONS/)
  assert.match(styles, /\.di-setup-card\{overflow:visible\}/)
})

test('每次展示卡片都绕过资源缓存并使用独立展示标识', () => {
  const liveInterview = readFileSync(new URL('../../src/client/features/live-interview.js', import.meta.url), 'utf8')
  const entry = readFileSync(new URL('../../src/client/index.js', import.meta.url), 'utf8')
  assert.match(liveInterview, /artifact\?\.presentationId/)
  assert.match(liveInterview, /\{ version: revision, cache: false \}/)
  assert.match(entry, /key: view\.presentationId/)
})

test('练习工作台使用模态布局、图标导航和居中删除确认', () => {
  const workspace = readFileSync(new URL('../../src/client/features/workspace-dock.js', import.meta.url), 'utf8')
  const library = readFileSync(new URL('../../src/client/features/practice-library.js', import.meta.url), 'utf8')
  const styles = readFileSync(new URL('../../src/client/shared/styles.js', import.meta.url), 'utf8')
  assert.match(workspace, /di-workspace-backdrop/)
  assert.match(workspace, /role: 'dialog'/)
  assert.match(workspace, /name: item\.icon/)
  assert.match(library, /di-confirm-modal/)
  assert.match(styles, /width:min\(1024px,calc\(100vw - 64px\)\)/)
  assert.match(styles, /grid-template-columns:208px minmax\(0,1fr\)/)
  assert.match(styles, /di-mode-badge/)
})

test('工作台配置与筛选统一使用自定义下拉组件', () => {
  const library = readFileSync(new URL('../../src/client/features/practice-library.js', import.meta.url), 'utf8')
  const ui = readFileSync(new URL('../../src/client/shared/ui.js', import.meta.url), 'utf8')
  assert.doesNotMatch(library, /h\('select'/)
  assert.match(library, /h\(Select/)
  assert.match(ui, /role: 'combobox'/)
  assert.match(ui, /role: 'listbox'/)
  assert.match(ui, /document\.addEventListener\('pointerdown'/)
  assert.match(ui, /event\.key === 'ArrowDown'/)
})

test('长时间轴使用独立滚动区且详情浮层位于滚动区之外', () => {
  const timeline = readFileSync(new URL('../../src/client/features/timeline.js', import.meta.url), 'utf8')
  const styles = readFileSync(new URL('../../src/client/shared/styles.js', import.meta.url), 'utf8')

  assert.match(timeline, /className: 'di-time-list'/)
  assert.match(timeline, /selectedQuestion && selectedView \? h\('section', \{ className: 'di-time-flyout'/)
  assert.match(styles, /\.di-time-list\{[^}]*max-height:calc\(100vh - 144px\)[^}]*overflow-y:auto/)
  assert.match(styles, /\.di-time-list\{[^}]*scrollbar-width:none[^}]*-ms-overflow-style:none/)
  assert.match(styles, /\.di-time-list::\-webkit-scrollbar\{display:none\}/)
  assert.doesNotMatch(styles, /\.di-timeline\{[^}]*max-height:/)
})

test('练习工作台入口支持拖动、边界约束和位置持久化', () => {
  const workspace = readFileSync(new URL('../../src/client/features/workspace-dock.js', import.meta.url), 'utf8')
  const styles = readFileSync(new URL('../../src/client/shared/styles.js', import.meta.url), 'utf8')

  assert.match(workspace, /onPointerDown: startLauncherDrag/)
  assert.match(workspace, /onPointerMove: moveLauncher/)
  assert.match(workspace, /onPointerUp: finishLauncherDrag/)
  assert.match(workspace, /clampLauncherPosition/)
  assert.match(workspace, /localStorage\?\.setItem\(LAUNCHER_POSITION_KEY/)
  assert.match(workspace, /suppressLauncherClickRef/)
  assert.match(styles, /\.di-workspace-launcher\{[^}]*cursor:grab[^}]*touch-action:none/)
})
