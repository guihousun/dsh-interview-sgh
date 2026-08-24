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
    └── Explanation
```

- 重新作答追加 `Attempt`，不会覆盖旧回答及其评价；
- 一道题只有一份当前讲解，明确执行 replace 才能替换；
- 直接看答案只创建 `Explanation`，不会伪造 `Attempt` 或 `Evaluation`；
- 力扣是一题一练习，下一题会完成旧练习并创建新的练习；
- 非力扣练习结束时保存总体总结，力扣只保存本题汇总。

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
| 题目卡 | 回答、看答案；力扣题额外支持完成标记、讲解和随机下一题 |
| 点评讲解卡 | 下一题、重新作答、结束练习 |
| 总结卡 | 只读展示 |

每张可操作卡片携带 `practiceId`、`questionId`、`presentationId` 和生成时的 `sessionRevision`。客户端只在卡片引用仍与当前会话一致时开放按钮；任一推进操作都会原子递增会话修订号，使旧卡片立即失效。新的题目卡是否可操作与该题已有多少次作答、是否已有讲解无关，因此重新作答可以保留全部历史并获得一张可用的新题卡。

修订号是一次性卡片的并发校验令牌，不是业务阶段。领域层仍负责必要约束，例如已结束练习不能作答、已评价的作答不能再次评价、力扣题不能由 AI 创建。

## 原子业务工具

AI 只看到按资源分组的七个业务工具：

| 工具 | 原子操作 |
| --- | --- |
| `interview_session` | read、bind |
| `interview_practice` | create、read、list、update、complete、reopen、delete、export、insights |
| `interview_question` | create、read、list、update、delete、focus |
| `interview_attempt` | create、list |
| `interview_evaluation` | create |
| `interview_explanation` | create、replace |
| `interview_leetcode` | catalog、draw、draw_next、set_completion |

提示词由五层组成，而不是为所有模式复用一条泛化指令：

1. 公共规则约束先读后写、数据库事实、业务与展示分离以及无关内容边界；
2. 工具描述只说明原子能力、参数和副作用，不绑定任何模式的回答内容；
3. 当前练习绑定会话时只注入一次当前模式上下文，按出题、看答案、作答后点评和总结分别定义策略；
4. 真实配置和历史始终通过 `interview_session read` 或 `interview_practice read` 获取，不把简历等大段数据复制进提示词；
5. UI 只投递本次操作的一次性指令，并携带数据库返回的权威 `mode`，后续操作只注入任务和阶段，不重复注入模式全文。

模式策略按 `mode + phase` 组织，阶段包括 `question`、`reveal`、`answerReview` 和 `summary`。看答案与作答后点评使用不同策略：前者不创建作答、不生成评分，后者基于真实回答生成评分、点评和讲解。自然语言路径复用当前会话已经激活的模式上下文；通过原子 create 或 bind 首次激活练习时，业务结果会携带一次模式上下文，后续原子操作不重复注入。

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

## 独立展示工具

展示工具不产生业务副作用。内容卡根据资源 ID 读取已保存数据；新建练习配置卡只收集用户输入，提交后通过 HTTP 命令进入业务层：

| 工具 | UI 载体 |
| --- | --- |
| `interview_show_practice_setup` | 新建练习配置卡片 |
| `interview_show_question` | 题目卡片 |
| `interview_show_review` | 点评讲解卡片 |
| `interview_show_summary` | 练习总结卡片 |
| `interview_show_practice` | 单条练习档案 |
| `interview_show_practice_list` | 练习工作台 |
| `interview_show_insights` | 能力洞察 |
| `interview_show_leetcode_catalog` | 热题 100 |

工具描述明确规定：用户需要查看对应内容时必须调用展示工具，禁止使用普通 Assistant Text 代替。业务操作本身不强制展示；只有当前用户意图需要 UI 时，AI 才在业务操作后调用展示工具。

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
力扣下一题   → leetcode.draw_next → 一次性 question.show
```

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
practice.create
→ leetcode.draw
→ show_question
├─ leetcode.set_completion
├─ explanation.create → show_review
└─ leetcode.draw_next
   → 完成旧练习 + 创建新练习 + 抽取题目
   → show_question
```

### 用户说“继续”

AI 先调用 `interview_session read`，再依据真实数据选择操作：没有题则创建题目；当前题可回答则展示题目；有未评价作答则补齐评价和讲解；已有讲解则展示点评讲解；力扣题则展示当前题。不存在固定的 continue 后端事件，也不从历史 Assistant Text 猜测状态。

## 持久化

SQLite 表包括：

- `practices`
- `questions`
- `attempts`
- `session_bindings`
- `leetcode_progress`

Repository 开启外键、WAL 和事务。练习聚合和会话绑定在同一应用操作中提交。当前开发版本不会创建、读取或迁移旧的 `session_cursors` 表。

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
