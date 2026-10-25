# Vanna 2.x：对话主体，SQL 计算与知识记忆辅助

## 范围与结论

核验默认分支 `main`，固定提交 **365d0617c1a4567ffee1b19b40c27feb4206bfcf**（版本提交 2.0.2）。这是带聊天服务/UI 接口的数据分析 Agent 框架，不是已替用户配置好业务知识、权限的销售报表成品；也不是旧版 `VannaBase.train(question, sql)` 流程。以下为公开源码静态研究，聚焦聊天、记忆、SQL 链路，不是全仓安全审计。

选官方 [Claude/SQLite 示例][example]：它注册 SQL、可选可视化工具，连续使用同一 conversation_id。但该提交的示例及 README 配置**漏传 Agent 必填的 agent_memory**，不能称为开箱可运行。下面解释其真实组件链，并明确标出需补充的配置。

## 1. 领域知识在哪里

有三层，不能混称“记忆”：

- **数据库**保存事实、表结构；SqliteRunner 不自动把 schema 放进 prompt。模型可尝试经 SQL 查询元数据，但此示例没有专门 schema 检索器。
- **AgentMemory**保存两类资料：`save_text_memory(content, context)` 存字段关系、业务术语、计算口径；`save_tool_usage(question, tool_name, args, ...)` 存问题与成功工具参数，例如 SQL 案例。不是自动把全库“训练”进去。[memory][tools]
- **ConversationStore**保存本盘式连续问答，包括工具调用、工具返回和助手回答；它与跨会话知识库分离。[store]

销售场景可组织为：“orders 的 paid_at 是收款时间”“净销售额扣退款、不含测试单”两条文本知识，再保存“各月净销售额→run_sql 参数”的案例。这是建议的业务材料，不是仓库已有销售数据。字段定义解决“去哪里找”，口径解决“怎么算”，案例解决“怎样调用工具”；三者都不应靠角色提示“你是财务专家”代替。固定口径也可通过 `DefaultSystemPromptBuilder(base_prompt=...)` 直接注入，但这会替换默认基础提示，使用方需要自行保留必要操作规则。[prompt]

本地 `DemoAgentMemory` 是 RAM 列表，默认上限 10,000，FIFO 淘汰；检索取 Jaccard 分词重合率与 difflib 字符串相似度的较大值，默认阈值 0.7。**无 embedding、无向量服务依赖**，不代表语义检索质量好，尤其中文短追问容易漏召回。其他向量后端本次未追实现，不保证其依赖、隔离或效果。[memory]

## 2. 首次请求实际送什么

[Agent._send_message / _build_llm_request][agent] 的普通 LLM 路径是：

```python
# 按源码压缩的逻辑，不是完整可运行脚本
user = await user_resolver.resolve_user(request_context)
conversation = await store.get_conversation(conversation_id, user)
# 未找到则建空会话，再追加本次 user 消息
system = await builder.build_system_prompt(user, tool_schemas)
system = await enhancer.enhance_system_prompt(system, message, user)
request = LlmRequest(
    system_prompt=system,
    messages=[LlmMessage(role=m.role, content=m.content,
                         tool_calls=m.tool_calls,
                         tool_call_id=m.tool_call_id)
              for m in conversation.messages],
    tools=tool_schemas, user=user,
)
```

首次 history 为空，messages 是当前问题。默认 system 是“Vanna 数据分析助手”、当前日期、工具使用/最终总结规则和可用工具名；不是一整本数据库说明书。[prompt] tools 来自 `registry.get_schemas(user)`；身份还进入 ToolContext。身份对象存在不等于模型自动理解用户全部权限。

进一步追到 [AnthropicLlmService._build_payload][llm]：system 放 API 顶层 `system`，历史放 `messages`，工具名/描述/参数结构放 `tools`，工具选择为 auto；内部 `user` 对象没有直接序列化成供应商请求字段。

## 3. 知识何时进入上下文，是否是 Skill

`agent_memory` 由使用方提供；未指定 enhancer 时，Agent **自动安装** `DefaultLlmContextEnhancer(agent_memory)`。每次用户消息开始时，它用**本次原始问题**检索最多 5 条文本记忆，追加到 system 的 “Relevant Context from Memory”；失败则退回原 prompt。默认不改 user messages。[enhancer]

SQL 案例走另一条路：需显式注册 `SearchSavedCorrectToolUsesTool`。默认 prompt 看到该工具才要求模型“先搜索再执行”；搜索返回问题、工具名、参数，经 `result_for_llm` 成为内部 role=tool 消息，再次送模型。[tools][prompt] 这条“必须先搜”是提示词约束，**不是强制状态机**。

`context_enrichers=[]` 默认空；其 `enrich_context` 修改工具执行上下文，不会自动把资料转成 LLM 消息。不要把它与上述 enhancer 混为一谈。普通角色 prompt、工具循环/工作流钩子都存在，但所查链路**没有按任务加载 SKILL.md 或方法包的真正 Skill 机制**。[agent]

## 4. 真实执行链与易懂问答

官方示例补上 memory 后，已有链是：
`send_message → _build_llm_request → Anthropic → tool_calls → registry.execute → RunSqlTool.execute → SqliteRunner.run_sql → tool 消息 → 再问模型`。[agent][sql][runner]

若还想“先找结构/案例”，必须自行填知识并注册记忆工具，概念配置如下（增补示意，未执行）：

```python
memory = DemoAgentMemory()
tools.register(SearchSavedCorrectToolUsesTool())
tools.register(SaveTextMemoryTool())
tools.register(SaveQuestionToolArgsTool())
agent = Agent(llm_service=llm, tool_registry=tools,
              user_resolver=user_resolver, agent_memory=memory)
# 配置阶段用带 user 的 ToolContext 保存业务定义及审核过的 SQL 案例。
```

案例中的参数可以长这样（虚构表名、字段与日期，展示形状）：

```python
args = {"sql": """
SELECT SUM(amount - refund_amount) AS total_net
FROM orders
WHERE paid_at >= '2025-03-01' AND paid_at < '2025-04-01'
  AND is_test = 0
"""}
```

这不是让模型背诵答案，而是提供可检查的查询模板；退款空值、币种、时区等真实业务问题仍需补齐定义。默认保存工具接受模型提交的参数，并不等于人工已经审核了“成功案例”。

假设已装入上述材料且检索命中：

> 用户：今年三月净销售额多少？
>
> 系统：检索口径进入 system；模型调用案例搜索，得到月度聚合 SQL。
>
> 模型：按三月日期边界生成 SQL，调用 run_sql。
>
> 数据库：返回 total_net=120000（演示数字）。
>
> 助手：三月净销售额 12 万，按扣退款、排除测试单的口径计算。
>
> 用户：那上个月呢？
>
> 助手：可结合历史理解为二月，再计算；若“上个月”可能指当前日期的上月，应澄清。

算数/筛选由数据库执行，LLM 负责选择查询、解释结果；但 SQL 和口径仍可能生成错。RunSqlTool 给 UI 完整表格，给模型 CSV 预览，超过 **1000 字符截断**并附文件名；不应声称模型读完所有行。SqliteRunner 实际执行 `cursor.execute(args.sql)`，非 SELECT 路径会 commit，非天然只读。[sql][runner]

## 5. “那上个月呢”如何真的记住

[ChatHandler.handle_stream][chat] 把客户端 conversation_id 和 request_context 传入 Agent，并在响应 chunk 带回 ID。下次需复用 ID、解析出同一 user，且存储仍保留会话。

默认 `MemoryConversationStore.get_conversation` 检查会话所有者 id；Agent 追加新问题后，把已有 user、assistant、tool 全部转成 LlmMessage，而非仅存档。Anthropic 适配器再把 tool 消息转换为 user 下的 tool_result block，保留调用关联。[store][agent][llm] 因而有真实历史输入证据，但默认内存重启即失；默认没有历史压缩。文本记忆检索仍只看“那上个月呢”，不是基于完整历史改写检索词，因此新一轮未必找回上轮 system 中的知识。

## 6. 限制、测试与许可

README 的自动行级安全不能直接套在这个配置上：SQLite runner 未使用 context.user 改写/限制 SQL；DemoAgentMemory 检索也未按 user 过滤。UI 隐藏 SQL 更不是执行权限。认证、只读连接、行级策略与可信知识写入需要另行设计，未做完整 SQL 安全审计。

[enhancer 测试][test]用 mock 记录 LLM 请求并断言 system/user 增强确实进入请求；但 mock 检索直接回存储材料，不证明相关性或多轮指代正确。`test_no_enhancer_means_no_enhancement` 的注释也不能推翻构造器默认安装 enhancer 的代码。[memory sanity 测试][sanity]主要查接口/导入/实例化，并非真实向量检索验证。**本次未运行任何测试、模型、数据库或服务**，也未安装、克隆、读取密钥。

[LICENSE 原文][license]为 MIT，Copyright (c) 2024 Vanna.AI：允许使用、修改、分发和商业使用，但须保留版权及许可声明，按原样提供、无担保；不能据此推断模型服务、数据库或其他依赖的许可。

## 能借鉴什么 / 不能由此保证什么

能借鉴：让聊天历史维持同一任务；领域定义与成功案例分库组织；工具返回计算证据、模型负责解释。数据库之于销售报表，可类比 KataGo 之于棋局分析，而非让知识检索取代计算或对话。

不能保证：正确业务口径、可靠指代、权限隔离、长会话稳定性、真正 Skill 加载，或示例即生产就绪；更不能据此决定 Go Coach 引入 Python。

[agent]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/core/agent/agent.py
[example]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/examples/claude_sqlite_example.py
[store]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/integrations/local/storage.py
[memory]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/integrations/local/agent_memory/in_memory.py
[tools]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/tools/agent_memory.py
[prompt]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/core/system_prompt/default.py
[enhancer]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/core/enhancer/default.py
[chat]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/servers/base/chat_handler.py
[sql]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/tools/run_sql.py
[runner]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/integrations/sqlite/sql_runner.py
[llm]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/integrations/anthropic/llm.py
[test]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/tests/test_llm_context_enhancer.py
[sanity]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/tests/test_agent_memory_sanity.py
[license]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/LICENSE
