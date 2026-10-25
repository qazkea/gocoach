# FinRobot V2：聊天、方法与财务计算怎样接起来

固定默认分支 **master** 的完整提交：`63e1884a42ea7b729551a5424b4bd6a65af636e0`。对象仅为 `finrobot_desktop/`：有桌面前后端的产品代码，不是旧 AutoGen 教学，也不是单纯框架；“生产可用”“56 个 playbook”不作为验证结论。以下是静态调用链研究，不是运行验收或安全审计。

## 1. 先分清三个入口

`cli.run` 是单次通用问答：`agent.run_sync(question, deps=deps)`，没有历史参数；**`cli.ask` 专指财报 RAG**，不是持续聊天。桌面 `POST /chat` 才接连续消息。报告则是固定步骤的 pipeline：聊天模型可以选择调用它，CLI 的 `dcf` 也能绕开主模型直接启动。[1][2]

领域知识不是一份“大知识库”：
- `instructions.md`：分析师角色、数字必须来自工具、快问/报告分流规则。
- `skills/**/SKILL.md`：任务方法；Python 中另有精简版方法清单。
- 计算算子与规则：DCF 公式、适用性判断、参数回退。
- 数据工具：结构化行情、财务数据；财报 RAG：公司业务、风险、管理层讨论等原文证据。
- 对话：独立 JSONL transcript；不能把 SQLite 数据/报告存储叫作模型记忆。[2–7]

## 2. 第一次和下一次请求究竟带什么

`create_lead_agent` 把角色 instructions 加上 `registry.list_summary()`，并注册数据、财报问答、报告查找/比较、Skill 激活、流水线等工具及网页搜索。工具定义交给 PydanticAI，不是把所有工具结果预塞给模型。首次历史为空，新用户问题来自请求的 `messages`；每轮还叠加语言、当前页面/股票/报告 ID、自选股缓存快照等 runtime instructions。[2][3]

简化后的实际接线如下（不是可直接运行的完整程序）：

```python
instructions = role_text + registry.list_summary()
agent = Agent(model, instructions=instructions, ...)
adapter = await VercelAIAdapter.from_request(request, agent=agent)
adapter.run_stream_native(deps=deps, instructions=runtime_instructions)
# 非流式回退明确传历史：
await agent.run(message_history=list(adapter.messages), ...)
```

续聊有真实恢复路径：`useChatSessions.fetchTranscript` 读 API → `reconstructMessages` 重建 user/assistant 与 tool call/result → `useChatStream` 的 `setMessages(seedMessages)` → `useChat/DefaultChatTransport` 发送 → 后端 adapter 转换。不是只保存 session ID。[3][4]

边界：正常发送完整消息及流式映射委托 AI SDK/PydanticAI，本次没有追其依赖源码或抓模型请求；仓库调用点和非流式 `message_history` 已确认。恢复也不是无损：对象型工具结果缺 summary 时只留约 400 字符 JSON，context 事件不重放；页面上下文会按当前轮重建。长聊天仍可能溢出上下文。[4]

## 3. Skill 是按需取，但 DCF 正文被替换

`load_skill` 拆 YAML 元数据和 Markdown 正文；registry 启动时读入全部文件，**内存已加载不等于模型已看到**。主模型先看到摘要目录；调用 `activate_skill(id)` 后，方法作为工具返回值进入后续模型上下文。[2][5]

重要反例：`render_pipeline_methodology` 对已知 `dcf-model` 返回 Python 硬编码的“收入、利润率、再投资、WACC、终值、敏感性”叙述检查表，**不是磁盘上长篇 Excel 操作教程**；未知 Skill 才返回原正文。因此这是“按需方法工具 + 已知方法蒸馏”，不是通用 Skill 执行器。[6]

报告中又不同：`PipelineStep.skill_section="dcf-model"` 是代码预选，不由模型自由挑选；runner 的 `_resolve_step_methodology/_build_step_prompt` 把方法和前步骤结构化 JSON 拼到该步骤的 user prompt。`DefaultAgentExecutor` 调 `agent.run(prompt, deps=deps)`，没有把聊天历史自动传给报告子代理。角色 prompt、按需 Skill、硬编码工作流不可混称。[7]

## 4. 一条 DCF 任务链：计算权不交给语言模型

`create_dcf_pipeline` 固定为历史数据 → DCF 计算 → 报告解释。[8]

```python
# _execute_dcf_calc，删去异常及展示代码
assert isinstance(financial_data, FinancialData)
inputs = seed_dcf_inputs(financial_data, historical,
                         forward_growth=forward_growth, cyclical=cyclical)
result = calculate_dcf(inputs)
grid = calculate_sensitivity(inputs, wacc_range, tg_range)
return StepOutput(text=summary, structured=result)
```

数据工具对 ticker、DataType 校验；price/financials 走 `fetch_canonical` 并把规范化 JSON 返回模型。DCF 步骤核验 `FinancialData` 类型，统一币种，排除不适合 FCF-DCF 的银行/保险，再计算。底层供应商与规范化校验全链未审计，不能把“canonical”标签视为真实性证明。[2][8]

**该提交的 DCF 已不让 LLM 填假设。** `seed_dcf_inputs` 使用历史比率、行业/市场回退、分析师增长预期，记录 `assumption_provenance`；它仍包含预测假设、裁剪与模型选择。算子旧 docstring 还写“LLM selects assumptions”，但实际 pipeline 已换成确定性 seed，应以调用体为准。[8][9]

`calculate_dcf` 明确折现现金流、计算终值，再做“企业价值−净债务→股权价值÷股数”；拒绝终值增长不低于 WACC、过小利差、非正终值现金流等情况。计算结果作为结构化上下文供最后的 LLM 解释；纯 Python 可复算，**不代表增长预测正确**。[9]

## 5. RAG 不承担记忆，也不替代行情工具

`ask_filings → run_qa` 获取 `RAG_10K.rag_chunks`，重建 BM25，按当前问题取片段；带来源标签及“不可信材料”包装，拼入独立 QA agent 的 user prompt。其 instructions 要求仅据摘录回答、逐项引用、不足就说明。QA 答案再作为主聊天工具结果返回；不是把整份财报塞给聊天，也不检索旧对话。BM25 与 SEC 解析器内部未展开审查。[10]

**示意问答，不是实测输出或投资建议：**

> 用户：比较 A 与 B 的估值，对 A 做 DCF。
>
> 助手：调用数据工具取得比较依据，启动 A 的 DCF，解释计算结果及假设来源。
>
> 用户：如果 A 的 WACC 高一个百分点呢？
>
> 助手：从旧消息知道“A”和原任务；若先前敏感性表已有该点，可解释它；否则应请求重新计算。

最后一步不能夸大：主聊天生成的 pipeline 工具仅接 `ticker`，没有任意 WACC override；计算函数虽有该参数，不等于 chatbot 已接通。恢复后的摘要也可能丢掉表格。不能声称这段对话必然自动完成精确情景重算。[2][4][9]

## 6. 许可、测试与边界

已核验 V2 LICENSE 原文：Apache-2.0，含再分发保留许可/通知、修改标记及无担保条款；Skill ATTRIBUTION 声称源自 Anthropic、MIT，但本次未独立核验其上游许可版本，复用须另查。[11]

只读查看两项测试文件：方法测试断言 DCF 被缩成检查表、未知 Skill 回退、已加载方法不含交互暂停语句；DCF 属性测试覆盖 WACC/终值增长单调性、非法终值条件及有限数值等。**没有执行测试**；没有克隆、安装、启动服务、调用模型或数据供应商。测试存在不证明端到端运行可靠。[12]

## 能借鉴什么 / 不能由此保证什么

可借鉴：聊天历史显式传递；领域方法按需注入；专业计算返回带来源的结构化结果；RAG 只补外部证据；报告子流程与聊天区分。Go Coach 可类比“棋局会话 + 教学方法 + KataGo 证据”，但这里不能保证围棋解释正确、恢复无损、任意追问可执行，也不替主代理选型。

## 固定源码索引

[1] [finrobot/cli.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/cli.py)：run、ask、dcf。

[2] [finrobot/engine/orchestrator.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/orchestrator.py)：create_lead_agent、activate_skill、_make_pipeline_tool；[finrobot/engine/instructions.md](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/instructions.md)。

[3] [finrobot/server.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/server.py)：_chat_impl、非流式回退。

[4] [desktop/src/hooks/useChatSessions.ts](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/desktop/src/hooks/useChatSessions.ts)；[desktop/src/layout/RightChatPanel/chat/useChatStream.ts](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/desktop/src/layout/RightChatPanel/chat/useChatStream.ts)；[desktop/src/lib/transcriptReplay.ts](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/desktop/src/lib/transcriptReplay.ts)。

[5] [finrobot/engine/skills/loader.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/skills/loader.py)；[finrobot/engine/skills/registry.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/skills/registry.py)。

[6] [finrobot/engine/skills/pipeline_methodology.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/skills/pipeline_methodology.py)；[skills/financial-analysis/dcf-model/SKILL.md](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/skills/financial-analysis/dcf-model/SKILL.md)。

[7] [finrobot/engine/pipelines/runner.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/pipelines/runner.py)；[finrobot/engine/pipelines/protocols.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/pipelines/protocols.py)。

[8] [finrobot/engine/pipelines/dcf.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/pipelines/dcf.py)：create_dcf_pipeline、_execute_dcf_calc。

[9] [finrobot/engine/compute/operators/dcf.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/compute/operators/dcf.py)；[finrobot/engine/compute/operators/dcf_seed.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/compute/operators/dcf_seed.py)。

[10] [finrobot/engine/analysis/qa.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/analysis/qa.py)：run_qa。

[11] [LICENSE](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/LICENSE)；[skills/ATTRIBUTION.md](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/skills/ATTRIBUTION.md)。

[12] [tests/unit/test_pipeline_methodology.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/tests/unit/test_pipeline_methodology.py)；[tests/unit/test_property_dcf.py](https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/tests/unit/test_property_dcf.py)。
