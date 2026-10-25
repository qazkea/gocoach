# 围棋专用开源 Agent：公开代码研究

> 本文保留初筛时的覆盖与未知项。用户随后要求深挖三个重点项目，最新结论见[架构比较](open-source-architecture-comparison.md)及其三份固定提交报告：GoAgent历史链已追完（存档不回灌）、试下hash接线与provider权限需区别看；kgteach新增教学局面错位等发现；Kifu-Sensei新增解释材料分级和任务/费用边界。下文的“尚未追完”不代表深入研究仍未完成，也不构成采用批准。

核查窗口：2026-10-23；仅公开 GitHub 文本。已读 `PRODUCT.md` 与 `coach-context-research.md`。未克隆/执行仓库、安装依赖、启动引擎/MCP/服务、调用付费推理、读取 Key 或私人棋谱；未启动子代理。本文不选择框架、不授权实施，不重复 DeepSeek 参数或通用 RAG 研究。

## 结论与范围

**事实**：找到五个相关实现，不必把普通引擎 GUI 冒充 Agent。其中 GoAgent 有实际模型工具循环，kgteach 是明确自我限定的教学工具层，Kifu-Sensei 是分析转讲解流水线，AIGoTeacher 是 GUI＋讲解，katagollum 是带工具调用的对弈闲聊演示。

**推论**：最值得继续审阅的是 GoAgent 的领域工具与分支身份、kgteach 的证据协议、Kifu-Sensei 的前后局面讲解组装；没有一个已被本次研究证明能可靠教授棋理，亦不能直接替换本项目已有合法性与分析能力。

搜索六组角度：`KataGo LLM coach chat Go baduk`、`weiqi LLM agent MCP katago`、`Go commentary large language model katago teaching`、`baduk RAG`、`围棋 Agent KataGo`、`katago MCP coach commentary`，限定棋类 Go/Baduk/Weiqi，排除 Go 编程语言。后续还出现 [Sabaki-llm](https://github.com/qcgm1978/Sabaki-llm)，但在五个候选已有不同类型证据后停止扩展，未将未读源码的搜索摘要列为核验结论。不是穷尽调查，也未证明不存在更成熟项目。

| 候选／作者原仓库 | 分类 | 对 Go Coach 的参考价值 | 主要缺口 |
|---|---|---|---|
| [GoAgent](https://github.com/wimi321/GoAgent) | 桌面围棋工具 Agent | 真实取证循环、试下身份、会话保存 | 工具权限过宽；保存聊天不等于模型收到历史 |
| [kgteach](https://github.com/KaiQin04/kgteach) | CLI/MCP 教学证据适配器 | 比较、变化校验、未知标记 | 无聊天宿主；棋规边界需补验 |
| [Kifu-Sensei](https://github.com/YianXie/Kifu-Sensei) | KataGo→Claude 讲解流水线 | 前后局面、PV/ownership 结构化提示 | 非连续聊天 Agent |
| [AIGoTeacher](https://github.com/EthanPan-code/AIGoTeacher) | Tkinter GUI＋LLM 讲解 | 区分失误方替代手与对方应手 | 盘面序列化风险；未核实教学会话闭环 |
| [katagollum](https://github.com/dakling/katagollum) | 对弈闲聊＋MCP 演示 | 最小模型→工具→回复链 | 单引擎全局状态，非赛后只读复盘 |

## 1. GoAgent：最接近目标，但不是可直接照搬的模板

[README](https://github.com/wimi321/GoAgent/blob/main/README.md)承诺本地知识库、学生画像、多模态老师与工具调用，列出 v0.4.22。

**代码事实**：[teacherAgent.ts](https://github.com/wimi321/GoAgent/blob/main/src/main/services/teacherAgent.ts) 的 `runTeacherAgentSession`、`executeAgentToolCall` 确实组织 assistant `tool_calls`、tool 结果与下一轮请求，`MAX_AGENT_TURNS=12`。工具包括 `katago.analyzePosition`、`katago.compareMoves`、`knowledge.searchLocal`、棋盘截图等；不是只有工具名称的 README。`initialAgentUserMessage` 包含 gameId、moveNumber、mainline/trial、trialBranch、问题、预取分析摘要及图证据；后续工具补充候选/PV/知识和画像。

[katago.ts](https://github.com/wimi321/GoAgent/blob/main/src/main/services/katago.ts) 有本地进程调用、带颜色的 `moveHistory`、`initialStones`/`initialPlayer`；`analyzeTrialPositionWithProgress` 把实战前缀与试下序列拼接并生成 branchHash，体现“试下不是实战”。但 `buildKataGoPayload` 写死 Chinese；试下转换设 `pass:false`；未逐项核验 SGF PL、让子、全部循环与分支合法性，不能宣布全规则正确。

[teacherSession.ts](https://github.com/wimi321/GoAgent/blob/main/src/main/services/teacherSession.ts) 实际用 electron-store 保存 messages 和棋局关联，支持删除/归档、最多保留80会话。**关键未知**：所读 runtime 每次从 system＋当前任务新建 messages，未见直接加载旧 session 消息；renderer 是否把历史编入 prompt 未追完。会话也不是强制一盘唯一会话，不能据 UI 宣称满足本项目连续上下文。

权限反例：同一工具表还有 `filesystem.read`、`shell.exec`、配置写入、联网搜索。只读源码，未打开这些能力；其授权链未全面审计。12轮是该项目实现，不应成为我们的预算决定，更不能替代新增付费请求逐次确认。

[运行时测试](https://github.com/wimi321/GoAgent/blob/main/tests/teacher-agent-runtime-contract.test.mjs)含大量源码正则断言；[评估说明](https://github.com/wimi321/GoAgent/blob/main/docs/TEACHER_PERSONA_SESSIONS_REAL_EVAL.md)明确 engine silver 当前是 schema/silver-oracle gate，不是高 visits 实测。存在测试与质量门不等于棋手盲审或学习收益证据。

## 2. kgteach：最清晰的工具协议借鉴

[README](https://github.com/KaiQin04/kgteach/blob/main/README.md)明确声明不是 GUI、不是自然语言老师，而是给外部 Agent 返回稳定 JSON 的 alpha 工具层。无内置 LLM 聊天记忆/自主循环；缓存的是分析，不是会话。

**代码事实**：[katago.py](https://github.com/KaiQin04/kgteach/blob/main/src/kgteach/katago.py) 的 `build_analysis_query` 接收带颜色 moves、初始石、规则/贴目和分析回合；`KataGoEngineClient` 按 id/turnNumber 收集最终结果。[engine_runtime.py](https://github.com/KaiQin04/kgteach/blob/main/src/kgteach/engine_runtime.py) 的 `spawn_client` 真正调用子进程，`AnalysisRuntime` 管理复用及缓存，并非伪分析数据。

[teach_service.py](https://github.com/KaiQin04/kgteach/blob/main/src/kgteach/teach_service.py) 的 `teach_compare` 对未分析候选保留空值/`analysis_required`，`teach_line` 返回每一步颜色、提子、劫点并明确仍需引擎估值。LLM 若由宿主接入，看到这些 JSON、position_fingerprint、知识 hooks；hooks 不是已验证知识检索，更不是棋理证明。

[go_rules.py](https://github.com/KaiQin04/kgteach/blob/main/src/kgteach/go_rules.py) 重放主线前缀，检查提子、自杀、简单劫并交替颜色。**静态风险**：`_board_after_turn` 只返回 board，`validate_variation` 随即把 ko_point 重置为 None，分支起点刚形成的劫禁点没有传入；未运行反例，不能将“variation legal”无条件采信。未见 superko；查询构造不显式传 initialPlayer，特殊初盘先手仍需核验。

[服务测试](https://github.com/KaiQin04/kgteach/blob/main/tests/test_teach_service.py)实际断言缺分析标记、实战手不在候选等；目录另有协议、MCP、真实引擎可选 smoke。未运行，未发现真人教学质量评估。最可借鉴的是“未知仍结构化”，不是照搬棋规实现。

## 3. Kifu-Sensei：证据驱动讲解流水线，不是聊天 Agent

[README](https://github.com/YianXie/Kifu-Sensei/blob/main/README.md)宣称逐手自然语言评论、完全基于棋盘数据，实际默认筛关键手；“first”“完全 grounded”属于作者宣称，不作为研究结论。

[核心 katago.py](https://github.com/YianXie/Kifu-Sensei/blob/main/backend/app/services/katago.py) 的 `sgf_to_winrate_request` 解析 SGF 主线、有色完整 moves 与开局摆子，经 HTTP 分析服务先50 visits扫描、再500 visits精查，第二遍含 ownership、policy、PV。这里调用 KataGo 服务，不是应用直接启动本地 KataGo；服务部署及其配置未核验。只取主线；中途 AB/AW/AE 会警告并跳过，没有完整任意变化编辑支持，也没有显式 initialPlayer。

`_generate_user_prompt` 组装盘面、实战/推荐点、前后胜率目差、PV和 ownership；`currentPlayer` 表示下一方，代码用其反色标识刚落子者，不应误判该反色函数为 bug。`generate_commentary_with_claude` 每个局面单独发送 user prompt，无历史聊天或自主补查；历史功能是保存过去评论。

[流水线测试](https://github.com/YianXie/Kifu-Sensei/blob/main/backend/tests/test_katago_pipeline.py)用 respx 与假 Anthropic 客户端核对前后局面配对、筛选、返回结构；目录还有概念/棋形测试，未逐项审阅。没有由这些测试推出自然语言棋理正确率的依据。代码对绘图重放失败会跳过棋子而不是统一拒绝，说明“完全基于正确棋盘”仍须独立验证。适合借鉴数据包与测试题型，不是完整教学 Agent。

## 4. AIGoTeacher：可参考语义区分，不能仅凭界面判断懂棋

[README](https://github.com/EthanPan-code/AIGoTeacher/blob/main/README.md)列 v1.3.0、KataGo stdin/stdout、SGF 分支和多供应商讲解。[main_v3.py](https://github.com/EthanPan-code/AIGoTeacher/blob/main/ui/main_v3.py)检索片段可见带颜色历史、rules/komi、analyzeTurns 与查询 id/session_id 路由；这是实际分析请求代码，但该单文件约43万字符，本次只核对相关片段，未完整审计启动/SGF/分支链及特殊先手。

[llm_game_context.py](https://github.com/EthanPan-code/AIGoTeacher/blob/main/services/llm_game_context.py)输出选中主线、ASCII盘、失误前后快照、前三候选及黑方估值；[providers/base.py](https://github.com/EthanPan-code/AIGoTeacher/blob/main/providers/base.py)明确区分“失误前本方可选”与“失误后对方应手”，要求未知不编造。未见此数据包传PV。

**风险/未知**：`serialize_board`仅把输入棋子画上去，不执行提子；`serialize_game_context`默认同一 current_stones 同时用于主线和盘面。若传完整历史会残留被提子，若传当前存活棋子又不是完整历史；调用方是否始终提供正确快照未核实。provider 有带 conversation 的聊天 sandbox 接口，但不能据此认定围棋讲解具有持久聊天/自动补查。仓库树未发现 test 命名文件；没有核实到棋理质量评估。

## 5. katagollum：实际工具链，但定位是陪玩吐槽

[README](https://github.com/dakling/katagollum/blob/main/README.md)定位有性格的 KataGo 对手。[go_game.py](https://github.com/dakling/katagollum/blob/main/src/go_game.py) 的 `process_turn_with_llm`先请求模型、调用 MCP、再请求回复；并非无限规划循环。[server.py](https://github.com/dakling/katagollum/blob/main/src/katago_mcp/server.py)把 `process_user_move` 接到 GTP play、分析与 genmove，处理用户颜色/让子后白先，但会修改对局，不是只读变化补查。

[views.py](https://github.com/dakling/katagollum/blob/main/web_backend/game/views.py)按 game 保存聊天，每问取最近10条。引擎却是单全局实例，源码直接承认一次只能一盘；未见完整 SGF 历史恢复和隔离变化树。模型主要看到角色、盘大小、贴目、近聊，以及工具压缩后的“好/坏棋＋AI落点”，不是足够支撑原因的完整 PV/盘面证据。

工具回传使用 `tool_name`，未附标准 tool_call_id/对应 assistant 调用消息，跨供应商兼容性未验证；格式校验也拒绝 pass。存在 [board测试](https://github.com/dakling/katagollum/blob/main/tests/test_board.py)，没有核实到教学质量评估。可看最小链路，不能作为可信赛后教练依据。

## 维护、许可与复用边界

下表日期是 GitHub 仓库 API 的 `pushed_at`（UTC），不是已验证稳定发布或测试通过。API：各原仓库对应 `https://api.github.com/repos/作者/仓库`。初筛源码读取main，表中保留当时API标识前缀。**后续更正：前三项经commit API确认实际为commit SHA，此前称为根tree SHA不准确；后二项标识类型未重新核验。** 初筛本身没有固定所有源码链接，后续三份深入报告已改用完整commit链接。

| 项目 | pushed_at日期／当时API标识前缀 | LICENSE原件与条件 |
|---|---|---|
| GoAgent | 2026-10-22／edc6efa15a9a | [MIT](https://github.com/wimi321/GoAgent/blob/main/LICENSE)：保留版权/许可声明 |
| kgteach | 2026-10-19／8653eaff9bf6 | [MIT](https://github.com/KaiQin04/kgteach/blob/main/LICENSE)：同上 |
| Kifu-Sensei | 2026-08-30／8e4c66264ce1 | [MIT](https://github.com/YianXie/Kifu-Sensei/blob/main/LICENSE)：同上 |
| AIGoTeacher | 2026-10-23／1018d1ff3b7f | [MIT及第三方例外](https://github.com/EthanPan-code/AIGoTeacher/blob/main/LICENSE)：图标、Canva素材等另有条款，不能整包按MIT处理 |
| katagollum | 2026-02-02／2fa350e8fb4b | [AGPLv3原文](https://github.com/dakling/katagollum/blob/main/LICENSE)，与README所写MIT冲突，勿按MIT复制 |

AGPL潜在涉及分发、修改及网络交互的对应源码义务，应先澄清许可冲突；MIT也不自动覆盖模型、棋谱、知识卡、图像和依赖。本次不是法律保证或全面安全审计；未读取所有许可附属文件，也未核验全部供应链。

## 对本项目的推论与仍未知

值得保留三种设计问题，而不是选框架：①局面/分支身份怎样跟随每条工具证据；②实战候选没被搜索到时怎样明示缺证据；③聊天存档怎样变成下一次请求的上下文。五个项目没有共同证明“一盘一会话、自然跨手指代、少量只读补查、每次新增付费确认”已经可靠兼容。

本项目已有本地扫描、合法变化与事实包，不应为引入候选重复造引擎 GUI。知识检索命中、ownership、掉目、流畅中文都不是“懂棋”证明。仍需后续经授权的合成局面/反事实验证、专业棋手审阅和新手学习评估；本次没有运行这些实验。用户已允许有限的自动本地补查；具体工具集合、补查次数和外发历史仍待定，新增付费模型请求仍逐次确认，不从其他项目的默认值继承。

## 主代理独立复核与研究覆盖

主代理重新读取三个重点仓库的LICENSE原文，均为MIT并要求保留版权/许可声明；这不代表模型、教材、资产及全部依赖也自动适用MIT。另重新取其关键源码并核对：GoAgent确有`MAX_AGENT_TURNS=12`、KataGo比较/知识检索工具，工具表也确有`shell.exec`；本次所读运行入口确从system与当前任务建立messages，未追完renderer是否额外注入历史。kgteach的`teach_compare`确实为未分析候选保留空值及`analysis_required`，`teach_line`明确返回仍需引擎分析。Kifu-Sensei确实组装前后局面、PV与可选ownership；逐条prompt的Claude请求只含本条user消息，不是连续对话循环。其源码还显示完整prompt本地日志与SDK重试相关逻辑，不能据许可直接沿用为本项目安全/费用策略。

原研究在本次轮次上限处结束，覆盖5个候选的选定源码/文档而非全仓库审计。主代理未复核所有候选、规则风险或维护日期，未安装或运行任何项目，未取得棋理正确率或教学成效证据。后续若复用实际代码，仍需固定提交、核验许可证范围与对应测试；本报告不是采用批准。
