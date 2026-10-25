# 垂域 Agent：专业知识怎样为连续聊天服务

状态：三条限定源码研究已完成；主代理已读三份报告并独立复核关键接线。只读公开源码，未克隆、安装、运行项目、启动服务或调用真实模型。不是全面代码审计、产品验收或 Go Coach 选型批准。

## 结论先说

这次看到的可借鉴方向是：**聊天承接任务和追问，方法说明教模型怎样做，检索提供资料，计算工具产生结果。** 这几件事不是三选一，也不应全交给 RAG。

“专业知识”至少包含三种不同内容：

- 术语、定义、教材和原文证据：告诉模型哪些资料可参考。
- 任务方法：告诉模型先查什么、怎样比较、什么情况下不能下结论。
- 写在程序里的规则和计算：真正执行统计、估值、合法性判断或引擎搜索。

把一本教材接入检索，不能自动补齐后两项；把方法写成 Skill，也不等于模型已经具备相应执行工具。

## 三个项目的实际分工

| 项目 | 方法与资料怎样进入模型 | 计算与证据 | 连续对话证据 |
| --- | --- | --- | --- |
| FinRobot V2 | 主模型先见角色规则和 Skill 摘要目录；通用任务可调用 `activate_skill` 取得方法。固定报告步骤另由代码选择方法并注入步骤提示 | 结构化数据工具；DCF 由程序生成假设并计算，模型写解释；财报另走 BM25 检索和独立 QA | 有 transcript 重建、聊天消息发送和后端适配路径；非流式回退显式传 `message_history`。正常流式转换委托 SDK，恢复工具结果可能有损 |
| Deep Life Sci | 常驻研究纪律；真实 PubMed、ClinicalTrials `SKILL.md` 经 `/skills/` 接入 deepagents，提示要求使用对应来源前阅读 | 来源工具取得摘要、正文、试验记录；专门阅读子任务返回带来源的结果，通用程序做计数等计算 | 前端沿 thread 提交增量；旧历史合并依赖 LangGraph/deepagents。未追到底层 checkpoint 与模型请求，不能宣称端到端持久记忆已验证 |
| Vanna 2 | 默认 enhancer 检索业务文本并附入 system；注册案例搜索工具后，模型可获取既有 SQL/工具参数案例。所查链没有真正 Skill 文件加载 | 模型生成 SQL，runner 执行，工具返回结果预览和文件名；不是模型口算数据库 | 从 ConversationStore 读取已有 user/assistant/tool 消息，追加当前问题，转成 LLM messages；默认内存存储不跨重启 |

详细限定和固定提交证据见：[FinRobot](vertical-agent-finrobot-research.md)、[Deep Life Sci](vertical-agent-deep-life-sci-research.md)、[Vanna](vertical-agent-vanna-research.md)。主代理核验的对应源码为 [F-chat]、[F-agent]、[F-method]、[F-dcf]、[F-rag]、[L-agent]、[L-skill]、[V-agent]、[V-enhance]、[V-sql]。

## 用两句聊天说明“AI 实际看见什么”

下面是按 Vanna 组件组织的**虚构业务示意**，不是本次运行结果。前提是使用方已经配置记忆、工具与数据库，并存入业务定义，且本次检索确实命中；仓库不会自动拥有这家公司的口径。

用户第一问：“三月各门店净销售额多少？”

```text
模型第一次收到：
  系统规则：怎样使用数据分析工具、怎样回答
  命中的业务说明：净销售额怎样扣退款，哪些订单不计入
  用户消息：三月各门店净销售额多少？
  可调用工具定义：查询数据库等

模型请求查询：
  run_sql(SQL 参数)

模型下一次收到：
  前面的消息
  + 自己发出的工具调用
  + 数据库工具返回的结果预览

模型据此给出回答。
```

用户第二问：“只看上海的门店呢？”

```text
模型收到：
  本轮系统规则与本轮命中的业务说明
  + 第一问
  + 先前工具调用和返回内容
  + 先前回答
  + 第二问
```

所以模型有机会从真正收到的历史理解：仍然在问三月、仍然使用净销售额口径，只是增加地域条件；它不是必须先从聊天向量库碰巧找回第一问。新 SQL 仍可能写错，实际业务字段和口径必须核验。[V-agent]

这里也有一个重要缺口：Vanna 默认用**当前短问题**重新检索业务文本。上一轮加进 system 的资料不自动成为永久历史，第二轮可能检索不到原口径。**聊天连续性与专业资料跨轮保留，是两个需要分别设计的问题。**[V-enhance]

SQL 工具给模型的 CSV 预览最多 1000 字符，完整数据另存文件；UI 展示更多数据不等于模型已读完。必须区分“已保存”“已显示”和“本次进入模型上下文”。[V-sql]

## Skill 究竟做了什么

### Deep Life Sci：真正的领域操作手册

PubMed Skill 具体说明字段查询语法、MeSH 与关键词各自的漏检风险、怎样检查检索警告、撤稿如何提示，以及何时从摘要升级到章节或图表。它不是简单写一句“你是科研专家”，也不是用论文内容替代检索方法。[L-skill]

装配代码把真实目录映射为 `/skills/`，配置禁止写入，并传给 `create_deep_agent`。精确的目录摘要注入和读文件消息封装由依赖框架负责，本次未验证“每次模型一定先读”。资料读取之后，还必须有真正的来源工具把本次研究证据返回。[L-agent]

### FinRobot：按需方法与固定流程共存

普通聊天可以通过 `activate_skill` 取方法，但专门报告的步骤和方法由代码预选。不要把所有报告都描述成“模型先自由选择 Skill，再自由规划”。[F-agent]

已知 `dcf-model` 返回的是 Python 中精简的方法检查表，而非磁盘上的长篇 Excel 操作教程。DCF 的真实链是数据 → `seed_dcf_inputs` → `calculate_dcf`/敏感性计算 → 模型解释。计算程序包含假设与回退规则，公式可复算不代表预测正确。[F-method][F-dcf]

财报问题则检索摘录，交独立 QA 模型回答，再把答案当工具结果返回主聊天。它与行情查询、计算、历史记忆各有职责；这个子问答还意味着额外模型请求，不能照搬进我们的费用政策。[F-agent][F-rag]

### Vanna：没有 Skill 文件也能组织领域材料

业务定义解决“这个词是什么意思”，查询案例帮助“怎样调用工具”，SQL 执行得到“这次实际算出什么”。它是可配置框架，不是预装完业务知识和权限的成品。[V-enhance][V-sql]

它把检索文本拼入 system 是所查版本的实现事实，不是我们应照抄的安全建议。Go Coach 的外来教材和旧对话应保持资料身份，不能因为被检索到就获得系统指令权或扩大工具权限。

## 哪些不能直接照搬

- **程序约束和提示要求不同。** Deep Life Sci 的 Skill 说返回全部匹配，但工具默认 50 条；提示写“始终引用”也不证明引用支持全部结论。精确差异及源码见专项报告。
- **方法说明不等于工具能力。** FinRobot 的 DCF 方法包括敏感性分析，但聊天流水线工具没有任意 WACC 参数入口；不能由 Skill 出现某个概念就宣称任意追问都可执行。
- **存储不等于本轮可见。** FinRobot 恢复工具结果可能缩短；Vanna 当前检索可能漏掉上一轮口径；Deep Life Sci 的沙箱还在不证明消息被恢复。
- **框架不自动替使用方做好权限。** Vanna 示例漏传必填 `agent_memory`，默认 SQLite 非天然只读，DemoAgentMemory 未按用户过滤；不能照 README 直接宣布可运行、已隔离。
- **研究型多代理配置不等于低成本。** Deep Life Sci 有根模型、阅读子模型、搜索和沙箱，不能移植其大规模并发与限额到 Go Coach 的月预算。
- **不需要先预选向量库。** 本次具体链路已有来源 API 检索、BM25 和简单文本匹配；这不证明向量检索无用，只说明领域方法、工具、历史可以先明确，再评估检索方式。

## 对 Go Coach 的候选映射，不是实施决定

| 职责 | 围棋中对应什么 |
| --- | --- |
| 连续聊天 | 这盘棋之前讨论了什么、用户想弄懂什么；消息关联手数和分支 |
| 当前工作对象 | 本轮明确的棋盘前缀、行棋方、实战或试下身份；不靠旧聊天猜当前局面 |
| 任务方法 | 解释当前手、同一起点比较两种下法、核验试下等操作步骤与缺证据规则 |
| 计算工具 | 棋规合法性、受限 KataGo 分析与有效证据检查 |
| 参考资料 | 教材、术语、审核过的例题；不能替代当前局面的计算证据 |
| 老师回答 | 在原会话中解释事实、引擎估计与参考概念，保留不确定性和追问空间 |

示意：用户先问“为什么这手不好”，再问“如果先补一手呢”，聊天应保留前一个目标，当前棋盘/试下则独立绑定；按需要加载比较方法、补查受限变化、解释新证据。不是再开一个无历史的知识问答，也不能复用旧局面的分数冒充新变化分析。

具体 Skill 内容、知识来源/许可、检索方式、工具参数与硬限、超长历史策略、恢复机制仍待确认。连续聊天定位不授权现在全量外发历史、读取真实 Key、运行引擎、远程 embedding 或收费摘要。新增付费模型请求仍逐次确认；未改应用业务代码、未提交。

## 主代理复核范围与固定源码

主代理独立复核：FinRobot 的角色/目录装配、方法工具返回、已知 DCF 方法替换、seed/计算/叙述分工、财报摘录包装与独立 QA 请求，以及聊天 adapter/回退历史参数；Deep Life Sci 的真实 Skill 正文、目录挂载和 agent 配置；Vanna 的默认文本增强、会话加载与消息转换、SQL 工具给模型的结果。没有以此宣称所有依赖实现、权限隔离、前端恢复和真实请求均被端到端核验。

Vanna 的 GitHub contents API 曾返回 403，随后固定提交 raw 源码成功取得；本报告中的核心结论并非仅依据子代理转述。各专项报告保留其额外阅读范围和未验证项。

[F-chat]: https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/server.py
[F-agent]: https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/orchestrator.py
[F-method]: https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/skills/pipeline_methodology.py
[F-dcf]: https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/pipelines/dcf.py
[F-rag]: https://github.com/AI4Finance-Foundation/FinRobot/blob/63e1884a42ea7b729551a5424b4bd6a65af636e0/finrobot_desktop/finrobot/engine/analysis/qa.py
[L-agent]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/deep_life_sci/agent.py
[L-skill]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/deep_life_sci/skills/pubmed/SKILL.md
[V-agent]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/core/agent/agent.py
[V-enhance]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/core/enhancer/default.py
[V-sql]: https://github.com/vanna-ai/vanna/blob/365d0617c1a4567ffee1b19b40c27feb4206bfcf/src/vanna/tools/run_sql.py
