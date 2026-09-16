# dsh-interview 开发者架构说明

## 设计目标

dsh-interview 把 AI 当作能够组合领域能力的执行者，而不是把所有用户表达预先枚举成命令。

- 业务层提供练习、题目、作答、评价、讲解和力扣记录的原子操作；
- AI 根据用户意图和数据库事实组合原子操作；
- UI 是内容的展示载体，与业务写入完全分离；
- 会话只保存练习绑定、当前题指针和数据修订号，不保存工作流阶段、允许操作表或待恢复任务；
- 失败就是本次请求失败，用户再次发起请求即可，不持久化 `pendingTask`；
- 当前版本不兼容旧工具协议，也不迁移旧数据库。

## 系统全景

```text
自然语言 ─→ DSH 原子业务工具 ─┐
                              ├─→ InterviewApplication ─→ Domain ─→ SQLite
工作台操作 ─→ HTTP command ───┘             │
                                            ├─→ Markdown Exporter
                                            └─→ 业务 events

需要模型生成的 UI 操作
  ─→ 一次性 Agent followup
  ─→ AI 读取权威数据并组合原子业务工具
  ─→ AI 调用独立展示工具
  ─→ React 根据资源 ID 渲染卡片
```

自然语言和工作台共用应用层。工作台中的搜索、筛选、编辑、删除、导出、绑定和力扣完成标记直接执行本地操作；出题、评价、讲解和普通练习总结才会发起一次性 AI 请求。

## 依赖方向

```text
adapters ─→ application ─→ domain
   │              │
   │              └─→ ports ← infrastructure
   └─→ client（只通过 HTTP DTO 与交互协议通信）
```

```text
src/
├── domain/          练习聚合、会话绑定、模式规则和领域错误
├── application/     原子应用操作、DTO、展示结果和端口
├── infrastructure/  SQLite、Markdown 导出、时钟、ID 与随机源
├── adapters/
│   ├── dsh/         原子业务工具、展示工具、提示策略和一次性事件桥
│   └── http/        工作台查询与命令分发
├── client/          对话卡片、工作台、时间轴和 API Client
└── protocol/        Host 与 Client 共享的工具名和协议常量
```

领域层不知道 DSH、HTTP、React、SQLite 或文件系统。适配层不得绕过应用层直接修改数据库。

## 领域模型

`Practice` 是聚合根：

```text
Practice
├── mode / config / status / summary
└── Question
    ├── Attempt 1 ─→ Evaluation
    ├── Attempt 2 ─→ Evaluation
    ├── Explanation
    └── Materials（力扣题：题意、示例、范围、前置知识、提示阶梯、误区、相似题）+ hintLevel
```

- 重新作答追加 `Attempt`，不会覆盖旧回答及其评价；
- 一道题只有一份当前讲解，明确执行 replace 才能替换；
- 直接看答案只创建 `Explanation`，不会伪造 `Attempt` 或 `Evaluation`；
- 力扣是一题一练习，下一题会完成旧练习并创建新的练习；模拟面试的手撕题复用同一份 Hot 100 题库，但仍保存为 mock 练习题，不改变练习模式；
- 力扣题可以来自热题 100，也可以是用户点名的自定义题目（`leetcode.custom`，按题号与题名建题，难度留空）；题目材料与提示进度只存在于力扣题上；
- 背八股、简历押题和场景题结束时保存总体总结；模拟面试只结束并保留题目和原始回答记录，不生成评价型总结；力扣只保存本题汇总。
- 模式分工明确：模拟面试是无辅导的真实问答，简历押题是基于简历和 JD 的可点评练习。两者共用题目卡，但题目 DTO 的 `capabilities.allowReveal` 由后端根据模式派生，不能由模型或前端自行决定；力扣题额外派生 `capabilities.allowHints` 与 `allowMaterials`。

## 会话绑定与卡片生命周期

`SessionBinding` 只有五个字段：

```json
{
  "sessionId": "session-id",
  "practiceId": "practice-id",
  "currentQuestionId": "question-id",
  "revision": 3,
  "updatedAt": 1234567890
}
```

数据库通过唯一约束保证一个会话最多绑定一个练习、一个练习最多绑定一个会话。后切换的会话接管练习，练习完成或删除后解除绑定。

系统不存储或派生 `phase`、`stage`、`nextAction` 和 `allowedOperations`。会话查询只返回当前绑定和完整业务数据，每个原子操作根据领域不变量独立校验输入。

题目卡和点评卡通过自身类型承载操作：

| 卡片类型 | 承载操作 |
| --- | --- |
| 题目卡 | 回答；背八股、简历押题和场景题支持看答案，力扣题额外支持完成标记、讲解和随机下一题；模拟面试不显示看答案 |
| 点评讲解卡 | 下一题、重新作答、结束练习 |
| 总结卡 | 只读展示 |

每张可操作卡片携带 `practiceId`、`questionId`、`presentationId` 和生成时的 `sessionRevision`。客户端只在卡片引用仍与当前会话一致时开放按钮；任一推进操作都会原子递增会话修订号，使旧卡片立即失效。新的题目卡是否可操作与该题已有多少次作答、是否已有讲解无关，因此重新作答可以保留全部历史并获得一张可用的新题卡。

修订号是一次性卡片的并发校验令牌，不是业务阶段。领域层仍负责必要约束，例如已结束练习不能作答、已评价的作答不能再次评价、力扣题不能由 AI 创建。

## 原子业务工具

AI 只看到按资源分组的八个业务工具：

| 工具 | 原子操作 |
| --- | --- |
| `interview_session` | read、bind |
| `interview_practice` | create、read、list、update、complete、reopen、delete、export、insights |
| `interview_question` | create、read、list、update、delete、focus、draw_hot100（仅模拟面试手撕） |
| `interview_attempt` | create、list |
| `interview_evaluation` | create |
| `interview_explanation` | create、replace |
| `interview_leetcode` | catalog、search、draw、draw_next、set_completion |
| `interview_materials` | create、replace |

`interview_leetcode` 的 `search` 用题号、题名、slug 或题型检索热题 100；`draw` 与 `draw_next` 接受 `slug`、`number`、`title` 指定某一道题，或接受 `category`、`difficulty` 在题单里随机抽一道。指定题号或题名时由 `resolveLeetcodeProblem` 决定命中热题 100 还是创建自定义题目，AI 不得自行编造题目元数据。

`interview_materials` 保存力扣题的题意、示例、数据范围、前置知识、分级提示、常见误区和相似题；提示阶梯是材料的一部分，用户点击「提示」只推进题目上的 `hintLevel`，不会重新生成内容。

提示词由五层组成，而不是为所有模式复用一条泛化指令：

1. 公共规则约束先读后写、数据库事实、业务与展示分离以及无关内容边界；
2. 工具描述只说明原子能力、参数和副作用，不绑定任何模式的回答内容；
3. 当前练习绑定会话时只注入一次当前模式上下文，按出题、看答案、作答后点评和总结分别定义策略；
4. 真实配置和历史始终通过 `interview_session read` 或 `interview_practice read` 获取，不把简历等大段数据复制进提示词；
5. UI 只投递本次操作的一次性指令，并携带数据库返回的权威 `mode`，后续操作只注入任务和阶段，不重复注入模式全文。

模式策略按 `mode + phase` 组织，阶段包括 `question`、`reveal`、`answerReview` 和 `summary`。模拟面试另外包含一份完整业务上下文，覆盖简历与 JD 对齐、项目验证、追问路径、手撕代码、回答判定和真实面试边界；简历押题有独立的押题与辅导上下文。两份上下文只在会话首次激活该模式时注入一次，不放进工具描述，也不在每次操作中重复注入。模拟面试的 reveal、answerReview 和 summary 策略明确禁止辅导操作；简历押题则允许看答案、评分、点评和讲解。自然语言路径复用当前会话已经激活的模式上下文；通过原子 create 或 bind 首次激活练习时，业务结果会携带一次模式上下文，后续原子操作不重复注入。

刷力扣在此之上再按 `config.guidance` 分叉：`guided`（引导模式）先补前置知识、按提示阶梯逐段推导，用户没有明确要求前不给完整解法；`standard`（标准模式）按用户节奏给提示与讲解。注入模式上下文时若已知道引导强度就只注入对应分支，未知时注入两条分支并要求先读取 `config.guidance`。两种强度共用同一份材料规则：出题前必须先保存题目材料，展示时必须把 `materialsFence` 原样输出到正文。

这些工具只读写业务数据，不返回 UI 产物。复杂用户意图由 AI 组合：

```text
“新建练习”
→ interview_show_practice_setup
→ 用户在配置卡提交完整配置
→ HTTP session.start
→ question.generate / leetcode.draw
→ interview_show_question

“这题出过了”
→ interview_question delete
→ interview_question create
→ interview_show_question

“重新做第二题”
→ interview_question focus
→ interview_show_question

“我来回答”
→ interview_attempt create
→ interview_evaluation create
→ interview_explanation create
→ interview_show_review
```

不再存在继续、下一题、重新出题或恢复之类的服务端流程宏命令。它们是 AI 根据数据事实组合出的用户意图。

### 按模式披露工具

工具注册仍由插件统一完成，但每个 DSH Agent 都会根据当前会话绑定的练习获得独立的工具可见目录。插件只对自己的工具应用拒绝掩码，不会覆盖其他插件或 DSH 原生工具。没有绑定练习时只开放练习管理和历史总结展示入口；绑定后按模式收敛：

| 模式 | 额外开放的能力 |
| --- | --- |
| 背八股、简历押题、场景题 | 题目、作答、评价、讲解和总结链路 |
| 模拟面试 | 题目、作答和 Hot 100 手撕抽题，不开放评价、讲解和总结 |
| 刷力扣 | 力扣题库搜索与自由选题、抽题、题目材料与提示阶梯、完成标记，以及题目讲解和练习记录 |

会话绑定、切换、重新打开、结束和删除后，插件会重新读取会话事实并刷新该 Agent 的工具掩码。工具目录负责模型可见性，领域层的能力校验仍负责业务不变量；前者减少模型误用，后者保证直接调用或异常路径也不会写入非法数据。工具掩码不是安全边界，也不替代领域校验。

## 独立展示工具

展示工具不产生业务副作用。内容卡根据资源 ID 读取已保存数据；新建练习配置卡只收集用户输入，提交后通过 HTTP 命令进入业务层：

| 工具 | UI 载体 |
| --- | --- |
| `interview_show_practice_setup` | 新建练习配置卡片 |
| `interview_show_question` | 题目卡片；力扣题额外返回 `materialsFence` |
| `interview_show_review` | 点评讲解卡片 |
| `interview_show_summary` | 练习总结卡片 |
| `interview_show_practice` | 单条练习档案 |
| `interview_show_practice_list` | 练习工作台 |
| `interview_show_insights` | 能力洞察 |
| `interview_show_leetcode_catalog` | 力扣题库（热题 100） |

工具描述明确规定：用户需要查看对应内容时必须调用展示工具，禁止使用普通 Assistant Text 代替。业务操作本身不强制展示；只有当前用户意图需要 UI 时，AI 才在业务操作后调用展示工具。

### 力扣题目材料与 GenUI 围栏

题目材料有两条展示路径，数据同源、职责分离：权威数据是题目上的 `materials`，插件题目卡负责操作（提示、看答案、换题、标记完成），对话里的材料卡负责阅读。

`interview_show_question` 在处理力扣题时调用 `createMaterialsFence(question, { guidance })`，把材料编译成一段完整的 `dsh-ui` 围栏放进工具结果的 `materialsFence` 字段，并在 `assistantInstruction` 里要求模型原样输出。围栏由题型、难度与引导强度徽标、题意、示例表格、数据范围、前置知识、可折叠提示阶梯、常见误区和相似题组成。

选择这条链路的原因：GenUI 只在 Assistant Text 的 markdown 里渲染围栏，工具结果一律按纯文本展示，插件也无法直接写入助手正文；因此材料必须由宿主编译、由模型原样转述。围栏内容只包含可序列化 JSON，不含任何宿主对象。题目还没有材料时，展示工具改为要求模型先调用 `interview_materials create`。

## 题解库：事实层与参考层

本地 SQLite 里另有两张只读表，由 `scripts/import-leetcode-reference.mjs` 导入、做题时只读：

- `leetcode_reference`：每题一条，含官方题面（`statement` / `examples_json` / `constraints_json` / `advanced`）、用户题解笔记（`idea` / `mnemonic` / `diagram` / `steps` / `background` / `code` / `complexity` / `variants_json` / `hardcode_json`）、来源（`source_file` / `source_anchor` / `official_source` / `fetched_at`）；
- `leetcode_topic_notes`：按题型存放专题前置知识与易错点。

两条边界必须守住：

1. **事实层与参考层分开。** 官方题面是事实基线：`interview_materials` 保存时由 `mergeOfficialFacts` 用官方的示例与数据范围覆盖模型版本，模型写错数字会被纠正；题意复述、思路、提示阶梯、前置知识、易错点、相似题属于表达层，由模型撰写，笔记只作参考、可以改写再加工。材料里的 `source` 记录 `official` / `file` / `anchor`，围栏与题目卡据此显示来源。
2. **导入是运行时行为，不打包内容。** 脚本从用户指定的目录读 Markdown 与 CSV，官方题面默认实时抓取 `leetcode.cn`（逐题失败回退 CSV 快照，缓存在题解目录的 `.official-cache.json`），`--verify` 只比对漂移不写库。npm 包里只有解析器，不含任何 LeetCode 题面，避免把第三方内容随插件分发。

解析细节（都有单测锁定）：官方 GraphQL 返回的是 HTML，块级标签转换行、`<li>` 还原成 `- `、`<sup>` 还原成 `^`；兜底剥标签必须要求标签名以字母开头，否则会把官方文本里未转义的裸 `<`（如 `-100 <= matrix[i][j]`）到下一个 `>` 之间整段吃掉。示例标记行可能带前导 `&nbsp;`，标记正则要容忍行首尾空白，否则多个示例会被合并成一个。

`dsh-interview/interaction-v2` 只负责把展示产物交给 Client：

```json
{
  "protocol": "dsh-interview/interaction-v2",
  "action": "presentation.question",
  "artifact": {
    "kind": "question",
    "presentationId": "presentation-id",
    "practiceId": "practice-id",
    "questionId": "question-id",
    "sessionRevision": 3
  },
  "assistantResponse": {
    "mode": "exact",
    "text": "题目已展示，请开始作答。"
  }
}
```

Client 不从工具参数或 Assistant Text 重建内容，而是用 `artifact` 中的资源 ID 查询最新 DTO。

全局练习管理入口注册在 DSH 的 `sidebar.footer.action` 槽位，位于设置入口上方；展开侧边栏时显示“面试训练”和进行中数量，折叠时只保留图标。题目时间轴仍注册在 `conversation.input.dock`，只服务当前会话绑定的练习。两者分别承担全局管理与会话上下文，工作台不再通过对话区悬浮按钮承载。

题目卡和点评卡都是一次性流程载体。用户点击“看答案”“下一题”“重新作答”或“结束练习”中的任一操作时，Client 立即消费并锁定整张卡片，而不是分别管理按钮状态。命令会携带 `presentationId`、练习 ID、题目 ID 和展示时的 `sessionRevision`；应用层只接受与当前会话绑定完全一致的展示版本，并在接受后推进修订号。这样旧卡片自然成为只读历史，新步骤必须通过新的展示工具生成新卡片。

## UI 命令与一次性 AI 请求

HTTP command 不是对 AI 暴露的业务协议，只是工作台内部交互适配。可纯本地完成的命令直接调用应用层；需要 AI 生成内容时投递一次性 followup：

```text
新建普通练习 → practice.create → 一次性 question.generate
下一题       → 一次性 question.generate
看答案       → 一次性 review.generate
结束普通练习 → 一次性 practice.summarize
切换练习     → session.bind → 一次性切换确认
力扣抽题     → leetcode.draw / draw_next → 一次性 leetcode.present
力扣选题     → leetcode.select（可带 problem 与 config）→ 一次性 leetcode.present
力扣提示     → materials.reveal（纯本地，不投递 AI 请求）
力扣补材料   → 一次性 materials.generate
```

`question.hint` 只在本地推进 `hintLevel` 并返回最新题目 DTO，不消费卡片、不唤醒模型；题目还没有材料时它改为投递一次性 `materials.generate`，客户端有限次轮询直到材料出现。`leetcode.select` 在没有进行中的力扣练习时要求同时提交 `language` 与 `guidance` 配置，工作台会先展示配置卡再开始这道题。

一次性请求只存在于当前函数调用中。系统不保存队列、不保存 `pendingTask`、不自动重试。卡片操作一经接受，该卡片就永久进入历史状态；投递或模型生成失败时，已完成的原子业务事实仍保持有效，用户可以通过自然语言重新发起意图，由系统展示新的流程卡片。

## 典型练习流转

### 普通知识练习

```text
practice.create
→ question.create
→ show_question
→ attempt.create
→ evaluation.create
→ explanation.create
→ show_review
├─ question.focus → show_question        重新作答
├─ question.create → show_question       下一题
└─ practice.complete → show_summary      结束练习
```

### 直接看答案

```text
show_question
→ explanation.create
→ show_review
```

### 刷力扣

```text
practice.create（language + guidance）
→ leetcode.search（可选，自由选题）
→ leetcode.draw（可指定题目或按题型/难度抽题）
→ leetcode.present 一次性请求
   → interview_materials create（首次）
   → interview_show_question → materialsFence 输出到正文
├─ question.hint → materials.reveal（本地推进提示阶梯，不消耗卡片）
├─ question.materials → 一次性补材料
├─ leetcode.set_completion
├─ explanation.create → show_review
└─ leetcode.select / question.next（可带 slug 或筛选条件）
   → 完成旧练习 + 创建新练习 + 抽取题目
   → leetcode.present
```

### 用户说“继续”

AI 先调用 `interview_session read`，再依据真实数据选择操作：没有题则创建题目；当前题可回答则展示题目；有未评价作答则补齐评价和讲解；已有讲解则展示点评讲解；力扣题则展示当前题。不存在固定的 continue 后端事件，也不从历史 Assistant Text 猜测状态。

## 主题与暗色模式

客户端样式表只有一份，颜色全部走语义变量，主题差异只体现在变量取值上：

```text
body{--di-surface:#fff;--di-ink:#0f172a;…}                     亮色
body[data-ds-dark-theme]{--di-surface:var(--dsw-alias-bg-layer-1,#232324);…}   暗色
body{--di-weight-text:400;--di-weight-title:600}               与主题无关的字重
```

几条必须遵守的约束：

1. **语义层声明在 `body`，不能声明在 `:root`。** 宿主的 `--dsw-*` 令牌定义在 `body`（`dsh-client-ui-theme` 的样式表），而自定义属性在**声明它的元素**上完成 `var()` 替换。声明在 `:root` 会让替换发生在 `html` 上，读不到宿主的 body 令牌，直接落到兜底色——暗色主题不会生效。
2. **暗色令牌优先、字面量兜底。** 取值写成 `var(--dsw-alias-bg-layer-1,#232324)`：宿主主题或皮肤改了令牌就跟随，令牌缺失（离屏渲染、测试环境）时仍然可读。使用到的宿主令牌：`bg-base`、`bg-layer-1/2`、`label-primary/secondary/tertiary`、`border-l1…l4`、`link`、`state-success-primary/tertiary`、`state-warn-label/tertiary`、`state-error-primary`。
3. **规则体不出现颜色字面量。** 只有实色填充上的文字保留 `#fff`；其余一律引用语义变量，因此新增规则也必须用变量。
4. **实色填充上的文字单独取色。** `--di-on-accent` 用于强调色/危险色按钮，`--di-on-success` 用于亮绿填充上的对勾（暗色下亮绿底要配深色字形），`--di-accent` 只用于文字与描边，`--di-accent-strong` 才是填充色。
5. **对比度按 WCAG AA 校验。** 暗色下正文、次要文字、标签、徽标、按钮实测均 ≥ 4.5:1；`.di-star` 的空白轨道使用 `--di-line-3`，在两种模式下都可见。

客户端契约测试会断言：亮暗两套变量名完全一致、规则体不再硬编码颜色、所有 `var(--di-*)` 都有声明（组件内联写入的 `--di-star-fill` 除外）。

## 持久化

SQLite 表包括：

- `practices`
- `questions`（含 `leetcode_json`、`materials_json`、`hint_level`）
- `attempts`
- `session_bindings`
- `leetcode_progress`

Repository 开启外键、WAL 和事务。练习聚合和会话绑定在同一应用操作中提交。当前开发版本不会创建、读取或迁移旧的 `session_cursors` 表；打开旧数据库时只就地补齐 `questions` 缺失的 `materials_json` 与 `hint_level` 列，不重建表、不丢历史数据。

## 错误边界

- JSON Schema 拒绝工具参数形状错误；
- Domain 使用稳定错误码保护业务不变量；
- HTTP 将领域错误映射为 400，将未知错误隐藏为统一 500；
- 展示工具拒绝不存在或尚未保存的资源；
- AI 生成失败不写恢复任务，不在后续会话自动执行旧请求。

## 扩展方式

新增资源能力时：

1. 在领域层添加不变量与纯函数；
2. 在应用层添加单一原子操作；
3. 在对应资源工具的 operation 中暴露；
4. 只有确实需要新 UI 载体时才新增展示工具和卡片；
5. 为领域、应用、适配器和端到端链路补充测试。

不要新增描述用户话术的动作枚举，不要把 UI 产物塞进业务写操作，也不要用持久化待办弥补一次 AI 请求失败。

## 验证

```bash
npm run verify
```

该命令构建 Client、运行全部测试，并检查 Host、适配器与构建产物的 JavaScript 语法。
