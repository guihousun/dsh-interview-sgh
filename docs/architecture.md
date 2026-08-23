# dsh-interview 开发者架构说明

## 设计目标

dsh-interview 把 AI 当作能够组合领域能力的执行者，而不是把所有用户表达预先枚举成命令。

- 业务层提供练习、题目、作答、评价、讲解和力扣记录的原子操作；
- AI 根据用户意图和数据库事实组合原子操作；
- UI 是内容的展示载体，与业务写入完全分离；
- 会话只保存练习绑定和当前题指针，不保存工作流阶段或待恢复任务；
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

## 会话绑定与派生状态

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

系统不存储 `phase`。读会话时根据练习事实派生 `stage`：

| 派生阶段 | 数据事实 |
| --- | --- |
| `ready_for_question` | 进行中且没有当前题 |
| `answerable` | 普通题存在，尚无待处理作答和讲解 |
| `needs_evaluation` | 最新作答没有评价 |
| `needs_explanation` | 最新作答已评价但题目没有讲解 |
| `reviewed` | 普通题已有讲解 |
| `solving` | 当前力扣题未标记完成 |
| `ready_for_next` | 当前力扣题已标记完成 |
| `completed` | 练习已结束 |

`stage` 是只读投影，不是流程锁。领域操作根据自身不变量校验数据，例如已结束练习不能作答、已评价的作答不能再次评价、力扣题不能由 AI 创建。

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

这些工具只读写业务数据，不返回 UI 产物。复杂用户意图由 AI 组合：

```text
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

展示工具只根据资源 ID 读取已保存数据，不产生业务副作用：

| 工具 | UI 载体 |
| --- | --- |
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
    "practiceId": "practice-id",
    "questionId": "question-id"
  },
  "assistantResponse": {
    "mode": "exact",
    "text": "题目已展示，请开始作答。"
  }
}
```

Client 不从工具参数或 Assistant Text 重建内容，而是用 `artifact` 中的资源 ID 查询最新 DTO。

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

一次性请求只存在于当前函数调用中。系统不保存队列、不保存 `pendingTask`、不自动重试。投递或模型生成失败时，已完成的原子业务事实仍保持有效；用户再次点击或发送消息即可重新发起。

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
