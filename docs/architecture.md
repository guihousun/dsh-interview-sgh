# dsh-interview 开发者架构说明

## 设计原则

dsh-interview 是后端编排的 AI 面试练习插件。系统遵守以下边界：

- 后端状态机决定业务流程、数据写入和唯一下一动作；
- Agent 只负责出题、评价、讲解和总结等需要模型能力的内容生成；
- UI 是业务产物的交互载体，不从文本猜测状态，也不自行推进流程；
- Agent 工具与可视化 UI 复用同一应用用例和领域模型；
- SQLite 是练习、题目、作答和会话游标的权威数据源。

当前版本不提供旧协议兼容或旧数据库迁移。

## 运行时全景

```text
自然语言
  → DSH 原子工具 ───────────────┐
                                │
可视化操作                      ▼
  → HTTP command ───────→ InterviewCoordinator
                                │
                                ▼
                       InterviewApplication
                                │
                       Domain + Repository
                                │
             ┌──────────────────┼──────────────────┐
             ▼                  ▼                  ▼
        业务 events        Agent tasks      InteractionResult
                                │                  │
                                ▼                  ▼
                       AgentEventBridge     Tool result / HTTP
                                │                  │
                                ▼                  ▼
                         DSH followup       React artifact card
```

两种入口的区别只在适配层：

- Agent 工具调用后，模型根据 `nextAction` 继续必要的内容生成工具链；
- UI 命令完成本地业务动作后，由协调器投递 `agentTasks`，在需要模型参与或需要把正式卡片追加到对话末尾时唤醒 Agent。

## 依赖方向

```text
adapters ─→ application ─→ domain
   │              │
   │              └─→ ports ← infrastructure
   └─→ client（仅通过 HTTP DTO 和交互协议通信）
```

依赖只能向内。领域层不认识 DSH、React、HTTP、SQLite 或文件系统。

```text
src/
├── domain/          练习聚合、值对象、模式规则、状态机和领域错误
├── application/     应用用例、协调器、交互结果、Agent 任务、DTO 和端口
├── infrastructure/  SQLite Repository、Markdown 导出、时钟、UUID 和随机源
├── adapters/
│   ├── dsh/         原子工具、提示词策略和 Agent 事件桥接
│   └── http/        UI 查询接口与命令分发
├── client/          React 卡片、工作台、时间轴、API Client 和共享组件
└── protocol/        Host 与 Client 共享的工具名和交互协议版本
```

## 领域数据与会话游标

`Practice` 是聚合根，内部保存模式配置、题目、历次作答、评价、讲解和总结。核心层级如下：

```text
Practice
└── Question
    ├── Attempt 1 ─→ Evaluation
    ├── Attempt 2 ─→ Evaluation
    └── Explanation
```

重新作答会新增 `Attempt`，不会覆盖旧回答及其评分。直接看答案只保存 `Explanation`，不会伪造作答或评价。

`SessionCursor` 保存某个 DSH 会话正在处理的练习、题目、作答、阶段和修订号。数据库同时约束：

- 一个会话最多绑定一个练习；
- 一个练习最多绑定一个会话；
- 后切换的会话接管练习并释放旧会话；
- 结束练习后解除会话绑定；
- 删除练习通过外键级联删除题目、作答和游标。

SQLite 表包括 `practices`、`questions`、`attempts`、`session_cursors` 和 `leetcode_progress`。Repository 开启外键、WAL 和事务，应用层的一次业务操作负责同时保存聚合与游标。

## 统一动作入口

所有业务入口先映射为 `INTERVIEW_ACTIONS`，再由 `InterviewCoordinator` 统一执行：

```text
输入
→ 校验原子工具 Schema 或 UI command
→ Coordinator 标记来源 agent / ui
→ Application 加载聚合与游标
→ Domain 校验阶段并执行行为
→ Repository 持久化
→ 生成 events、agentTasks 和资源引用
→ InteractionResult 映射状态、下一动作与 UI 产物
```

查询通过 Repository 生成只读 DTO，不得依赖查询副作用修改当前练习、焦点题目或流程阶段。

## 三类输出必须分离

一次应用操作可能产生三种不同输出，它们不能互相替代。

### 业务事件 `events`

描述已经发生的领域事实，用于应用内部观察，不负责唤醒模型，也不决定 UI 卡片。

### Agent 任务 `agentTasks`

描述接下来必须由模型完成的工作。目前包括：

- `question.generate`：生成一道题；
- `answer.evaluate`：评价一次正式作答；
- `review.generate`：生成知识点讲解和“直接背”；
- `leetcode.explain`：按配置语言生成算法讲解和代码；
- `practice.summarize`：根据完整历史生成练习总结；
- `artifact.deliver`：不修改业务，只把权威 UI 产物投递到对话最新位置。

### 交互产物 `artifact`

描述当前工具调用必须承载的 UI。它只包含产物类型和权威资源 ID，不携带由模型临时拼接的展示正文。

```text
question           题目卡片
review             点评讲解卡片
finished           结束总结卡片
library            练习档案
insights           能力复盘
leetcode-catalog   力扣热题目录
deleted/exported   操作结果
```

题目、点评讲解和结束总结分别只能出现在与其匹配的工作流阶段。应用层会强制校验动作、状态、引用和产物类型的一致性。

## 交互协议

Host 与 Client 共享协议常量：

```text
dsh-interview/interaction-v2
```

结构化结果的核心字段如下：

```json
{
  "protocol": "dsh-interview/interaction-v2",
  "action": "question.present",
  "revision": 3,
  "state": "awaiting_answer",
  "nextAction": "wait_for_user",
  "artifact": {
    "kind": "question",
    "practiceId": "practice-id",
    "questionId": "question-id"
  },
  "assistantResponse": {
    "mode": "exact",
    "text": "已出题，请开始作答。",
    "mustNotRepeatArtifact": true
  }
}
```

- `state`：后端权威工作流状态；
- `nextAction`：Agent 唯一允许执行的下一动作；
- `artifact`：Client 要渲染的产物类型和资源引用；
- `revision`：资源刷新与请求合并使用的单调修订号；
- `assistantResponse`：普通 Assistant Text 的输出策略；
- `context`：仅在模型继续生成时提供的必要上下文；
- `error.audience`：区分 Agent 可恢复错误与用户、系统错误。

前后端从 `src/protocol/interaction-protocol.js` 引用同一个版本常量。Client 只接受当前版本，不进行版本协商或旧协议转换；协议不匹配的历史工具结果不会进入卡片渲染。

只要存在 `artifact`，`assistantResponse.mode` 必须为 `exact`。模型只能输出后端规定的简短状态文本，不得复述题目、点评、讲解或总结。

## Agent 内容生成链路

### 新建非力扣练习并出题

```text
interview_start_practice
→ nextAction = generate_question
→ interview_read_practice_context
→ Agent 根据模式专属配置生成一道简洁题目
→ interview_present_question
→ 保存 Question
→ artifact.kind = question
```

### 用户正式作答

```text
interview_submit_answer
→ 保存新的 Attempt
→ interview_read_practice_context
→ interview_save_evaluation
→ 保存 Evaluation
→ interview_complete_review
→ 保存 Explanation
→ artifact.kind = review
```

如果该题已有参考讲解，重新作答后只生成新的评价，并复用已有讲解生成点评讲解卡片。

### 用户直接看答案

```text
interview_reveal_answer
→ interview_read_practice_context
→ interview_complete_review
→ artifact.kind = review（无 attemptId）
```

### 继续练习

用户表达“继续”时只调用 `interview_continue_practice`。后端根据游标决定：

- 恢复当前题目；
- 恢复尚未完成的评价或讲解；
- 生成下一题；
- 恢复总结；
- 要求选择练习或确认重新打开。

模型不得根据聊天文本自行猜测当前题目或阶段。

### UI 操作后的正式卡片投递

```text
UI command
→ 后端完成业务动作并确定当前产物
→ agentTasks: artifact.deliver
→ Agent 只调用 interview_render_current_artifact
→ 卡片出现在当前对话最新位置
```

`interview_render_current_artifact` 是只读投递动作，不允许代替继续、下一题、重答、看答案等业务动作。

## 力扣流程

刷力扣是一题一练习。题目从内置热题 100 快照随机抽取，不由模型生成：

```text
新建力扣练习
→ 后端随机抽题并保存规范元数据
→ question 卡片
→ 用户前往力扣作答或请求讲解
→ leetcode.explain
→ 按练习配置语言保存一份完整讲解和代码
```

抽取下一题会归档上一条力扣练习并创建一条新练习。力扣结束不调用模型分析，只保存本次题目汇总。

## Client 渲染

工具卡片的解析顺序固定为：

```text
tool-result
→ 检查调用状态和错误受众
→ 校验 interaction protocol
→ 读取 artifact
→ 根据 kind 选择 React 卡片
→ 使用资源 ID 通过只读 HTTP API 获取最新 DTO
```

Client 不解析 Agent 提示词，不从工具参数重建题目，也不把 Assistant Text 当业务数据。工作台是独立的本地管理界面；题目、点评讲解和总结必须由对应的对话卡片承载。

资源请求使用稳定键、`revision` 和合并缓存，避免同一批刷新重复查询。命令通过统一 `useCommand` 防止执行期间重复点击。

## 错误与恢复

- Agent 参数或阶段错误：返回 `audience=agent` 的可恢复协议错误，不渲染错误卡片；Agent 调用 `interview_continue_practice` 从权威状态恢复。
- 用户操作错误：由 HTTP 或工具返回稳定领域错误码，可展示给用户。
- 系统错误：隐藏内部异常细节，统一返回 `INTERNAL_ERROR`。

恢复流程始终重新读取 SQLite 中的聚合和游标，不从历史 Assistant Text 推断状态。

## 扩展规则

新增模式或流程动作时应按顺序修改：

1. 在领域层定义配置、状态转换和不变量；
2. 在应用层添加用例及返回的资源引用、事件和 Agent 任务；
3. 在协调器中映射原子动作；
4. 在交互结果中定义状态、下一动作、产物和固定辅助文本；
5. 为 Agent 工具和 UI command 分别增加薄适配；
6. 为新产物增加 Client 卡片和只读 DTO；
7. 覆盖领域、应用、协议、Client 和端到端测试。

不要在 UI 中复制状态机，不要用提示词代替领域校验，也不要让展示工具产生业务副作用。

## 验证

```bash
npm run verify
```

该命令依次构建 Client、运行全部自动化测试，并检查 Host、适配器和构建产物的 JavaScript 语法。
