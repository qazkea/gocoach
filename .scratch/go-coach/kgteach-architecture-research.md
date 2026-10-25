# kgteach 深入架构研究（只读公开源码）

## 研究边界与版本

已读前轮筛选和 `coach-context-design.md`；本轮仅读取 GitHub API、固定提交 raw 文本及原作者文档，未克隆、安装、执行代码、启动引擎/MCP/服务、读取凭据或私人棋谱，未启动子代理。下述“确定”指静态控制流，不是运行复现、安全审计或棋理正确率保证。

[仓库 API](https://api.github.com/repos/KaiQin04/kgteach)给出默认分支 main；再由 [commits/main](https://api.github.com/repos/KaiQin04/kgteach/commits/main)解析出完整 **commit `8653eaff9bf6985e9ded1618f2968d4f15537ec9`**（2026-10-19），其 `commit.tree.sha` 是 `8c6c6b2008ad3e336d968ceb5194abc95bfb4e6d`。前轮把前者称为根 tree SHA 不准确；本轮已区分。以下链接全部固定此 commit，以文件和函数定位，不猜行号。

## 1. 定位、技术栈、进程和存储部署

这是 **Python 教学工具层，不是完整聊天教练**。包版本0.3.0、JSON契约0.2.0，Python≥3.11；运行依赖列表为空，使用标准库手写 argparse、SGF、asyncio JSONL及stdio MCP。[P][C][M] 没有内置模型请求、自动工具规划、聊天记忆或账本。外部LLM宿主决定何时调用、怎样解释、是否继续补查；服务中的 suggested_followups 只是数据，不会自行执行。[T][K]

真实部署有三种：CLI一次启动一次Python；无daemon时每次分析另起KataGo并结束；已运行daemon时CLI经Unix socket交给其持有的 `AnalysisRuntime`，复用一个KataGo。MCP自身常驻，但每次工具调用仍 `subprocess.run([sys.executable,"-m","kgteach.cli",…])`，不是直接共享Python服务对象。[C][M][D][R]

daemon存 `daemon.json`、socket及明文分析缓存；Unix默认 `~/.kgteach`，Windows路径虽指向LOCALAPPDATA，实际通信仍无条件使用 `asyncio.start_unix_server/open_unix_connection`，没有Windows管道/TCP实现，不能据路径分支认为Windows daemon已支持。内存库可设 `cache_dir=None`；没有棋谱/聊天数据库、缓存TTL或容量淘汰。[D][E]

## 2. 真实模块数据流

```text
用户/外部LLM宿主（规划、聊天、付费确认都在外部）
 ├─ CLI main → _dispatch ───────────────────────────┐
 └─ MCP serve → tools/call → 固定工具handler          │
                       → Python CLI子进程 ──────────┘
            SGF路径 → read_text → SGFParser → normalize_sgf
                          ├─ teach line → validate_variation → 本地合法性JSON
                          └─ 其余分析教学 → build_query_from_game
                               → _run_analysis
                                  ├─ 一次性runtime → KataGo子进程
                                  └─ Unix socket daemon → AnalysisRuntime
                                        ├─ 内存/磁盘缓存
                                        └─ 复用KataGo子进程
                               JSONL query → stdin / stdout → id+turnNumber聚合
                               → normalize_analysis_responses
                               → teach_service/teaching（纯格式化和启发式）
                               → knowledge hooks（查询描述，不检索）
                               → CLI envelope → MCP text content → 宿主
```

该图对应 [C][M][D][E][R][A][J][T][K]。`analysis.py`只构造/归一化；`teach_service.py`本身不启动引擎。真正驱动的是CLI编排及runtime，不能把纯服务“只吃已有结果”误推广为CLI永不分析。

## 3. 一次真实核心请求及关键语义错位

以 MCP `teach_compare` 为例，输入为 `sgf_path:string, turn:integer, moves:string|string[]`，可选visits/timeout。schema声明禁止额外属性，但执行器没有通用schema验证，只做所用字段的类型转换；数值没有总工作量上限。[M]

1. `serve→handle_json_line→_dispatch→_call_tool→_tool_teach_compare` 把moves连接为逗号串，调用CLI。
2. CLI `_dispatch`检查路径存在、UTF-8读入、`normalize_sgf`得到棋盘尺寸、规则、贴目、初始石及有色moves。
3. `_teach_payload("compare")→_analysis_for_turn→_analysis_for_game` 建 `id="teach-analysis"`、`analyzeTurns=[turn]`、默认800 visits及policy，读取最多8个候选。
4. `_run_analysis`解析配置；无完整配置则返回None＋warning，有daemon则请求，否则 `analyze_query_sync`启动引擎。
5. `KataGoEngineClient`写一行JSON，按id聚合对应turnNumber最终结果，忽略搜索中消息；归一化保存root估值、候选PV/visits/policy。
6. `teach_compare`从已有候选中取请求落点；没有的返回 `rank/score_loss/winrate_loss/severity=null, analysis_required=true`，不会强制搜索该落点，也不做候选合法性验证。顶层 `analysis_required`仅看是否有任何分析候选，不等于每个请求落点都有证据。最后返回 `turn,played_move,best_move,candidates,knowledge_hooks,warnings`，外包 `ok/schema_version/command/data/warnings/debug`；MCP再包为text和isError。[C][T][J][A][M][F]

**本轮最重要的新发现：普通教学CLI存在落子前后错位。** `_move_at(game,t)`把t解释为第t手实战，但CLI向KataGo请求的是落完t手的局面，而不是t−1；返回的是下一方应手候选，却与第t手落点对比。正常非pass落子仍占着该点，因此通常会被标为未分析；推荐落点也不是同一起点的替代手。`teach_move/compare/quiz/plan`共享此路径；`rank_compare`反而明确用 `analysis_turn=max(0,turn-1)`，是确实存在、但只覆盖该分支的反证，不能修复其他命令。见[C]的 `_analysis_for_game`、`_rank_compare_analysis` 与[T]的 `_move_at`。

这不是声称已实测：静态输入前提是正常棋局第t手和KataGo标准“已下手数”语义。测试甚至构造turn1/currentPlayer=W却把已下黑棋E5放进moveInfos，因而没有拦住错位。见[TS]的 `test_teach_plan_with_untagged_engine_analysis_keeps_concept_tags_empty`。

## 4. 棋局、分支、会话、检索状态

**身份不是可信证据身份。** `_position_fingerprint`仅 `sgf:{board_size}:{turn}`：不含棋局ID、历史、初始石、分支、规则、贴目、引擎条件，所有同尺寸同手数棋局碰撞。服务按turn接收外部analysis，缺turn也可接受；不核验分析属于该局。它不能替代Go Coach已有完整前缀、条件匹配及失效管理的证据引用。[T]

缓存键则较完整但用途不同：SHA256序列化 **整个query（连id和完整后续moves都在内）**，加binary/model/config/human_model的路径、大小、mtime_ns；含query所带规则、贴目、visits、policy等。不是文件内容哈希，不含实际引擎版本/会话；换请求id或同前缀不同后续会失去缓存共享。磁盘读取只验responses是字典列表，不核验kind/schema或签名，不能当抗篡改证据库。[E: `cache_key`, `_file_identity`, `read_cache_file`]

**SGF边界：** parser遇子树整个跳过，包括通常树状SGF的首个续谱分支，只保留根sequence并发warning；不保存变化树。normalize只取根AB/AW、root之后B/W，HA仅metadata；PL未进入模型，中途摆子/移除未应用，根节点上的落子也不进入moves；坏坐标警告后跳过，不能称严格拒绝坏谱。[S][G]

**合法性追到底：** `teach_line→validate_variation→_board_after_turn`从初始石重放有色主线，主线重放期间确实传递ko；但返回值只有board，调用方重新设 `ko_point=None`。之后变化内部会保留ko，pass清ko并换色；`_play_move`查占点、简单劫、提子、自杀，没有历史局面集合，也不读取rules，没有superko及依规则允许自杀的分支。[L]

为反驳“起点丢劫”已检查CLI line、纯服务、规则全文件及测试：没有第二道KataGo校验。现有劫测试仅验证同一line内 `C4,C3`，不覆盖主线/变化接缝。可由其5路测试初形直接推导静态触发：白C3/B4/D4/C5，黑B3/C2/D3；把黑C4放入主线，turn=1后试白C3。主线末产生ko=C3却被丢弃，第一步回提不会命中ko判断。**未执行复现**；若主线末手未形成简单劫或起点后已pass，该特定风险不成立。[TS][L]

`_next_player`优先取谱中下一手颜色，末尾取上一手反色，所以有记录的白先让子棋并非一概错；但无后续落子的初盘默认黑，不读PL/HA。`position_payload`更直接按奇偶算先手。KataGo query有initialStones及有色moves，却无initialPlayer；其特殊初盘推断未在本轮验证。另 `build_query_from_game`用 `float(game.get("komi") or 6.5)`，**零贴目确定被改成6.5**。[L][G][A][J]

`teach_line`在CLI/MCP所有已读入口都只有本地合法性，始终 `analysis_required=true`；即使传visits/timeout也不会估值。外部程序可另拼分支query做分析，但这里没自动实现。[C][T] knowledge模块是6类包元数据和字符串匹配生成查询描述；`knowledge_refs`也只是透传调用者资料，不是检索命中。没有索引、教材库、embedding或对话召回。[K][H]

## 5. 权限、隐私、成本、并发和失败

**权限实际范围。** MCP只有health、daemon_status、game_inspect、teach_move/compare/line/rank_compare七项，没有shell.exec、任意命令、config写入、daemon启动停止工具，也没有直接指定binary/model的参数。SGF路径却未经根目录白名单、扩展名或大小限制；会用进程权限读取任何指定路径再尝试解析，并可能通过元数据或错误暴露内容片段。这不等于通用原样文件读取API。binary来自Python显式配置、环境、当前工作目录项目配置、用户配置或macOS GoReview发现；可控配置能换可执行文件，`create_subprocess_exec`不用shell，但并非二进制白名单。MCP参数本身不能直接改这些配置。[M][C][R][CFG]

无远程模型调用意味着工具自身不产生token账单；不代表宿主不会外发工具结果。无逐请求付费批准、预算账本、对话外发政策；visits、ranks长度、SGF大小及line长度缺总上限。rank_compare先查最佳点，再逐rank分析，工作量随列表增加。明文缓存、socket和state没有专门加密/认证逻辑；目录/socket权限依赖OS和umask，不能称已验证跨用户隔离。[C][D][E]

**所有权和并发。** 一次性runtime `finally`关reader和KataGo，关stdin→terminate→等2秒→kill。`KataGoEngineClient.aclose`只取消reader，不拥有进程；持久runtime负责close。runtime锁串行化缓存miss并二次查缓存，使相同请求只算一次；等待锁不计入client timeout，daemon的queued_requests从未实际增加。MCP同步逐行处理，`subprocess.run`自身没有timeout，取消通知因无id直接忽略。[R][J][E][D][M]

**确定控制流与风险推论分开：** client超时删除pending、取消future，但没有发送KataGo终止请求；持久runtime也不关闭旧引擎。CLI反复使用同一 `teach-analysis` id。若A超时后B复用该id且请求相同turn，A迟到结果可能被B接收；关联没有generation。外部task取消时 `CancelledError`不在 `except Exception`清理范围，pending可遗留。已退出进程也不会因returncode自动重建。以上是源码路径，污染/卡死均未执行复现。[J][E][C]

两处启动均把stderr设PIPE，但没有消费任务；高日志量可能阻塞引擎，此为待复现风险。[R][E] 非JSON/EOF使pending失败；错误JSON未专门按error字段识别：缺turnNumber会报协议错，带匹配turnNumber却无rootInfo/moveInfos的对象可完成并归一化为空数据。CLI已知runtime错误返回 `ok:false`；缺配置及部分普通异常则 `ok:true`＋warning＋缺分析标记，不能只看ok。[J][A][C] 另外 `_candidate_loss`在“候选存在但缺指标”时回退0，severity可成为excellent，说明null策略并未贯穿所有不完整证据路径。[T]

## 6. 优点、缺点与适用场景

优点：无运行时第三方Python依赖；协议/进程/教学服务分层可读；JSON纯输出、未知候选显式null、可选无盘缓存、id/turn聚合、Human SL分rank政策及“材料查询意图”都是具体能力。[P][F][E][J][T][K] 适合已有LLM宿主、可信配置、受控SGF及独立结果校验的开发者实验；纯服务也适合把调用方已经校正的数据压缩为教学结构。

缺点：不提供一盘连续会话、本机聊天保存、完整分支管理或有限自动规划；教学输出还丢弃归一化候选中的PV/visits，不能单靠其severity解释因果。优先级是人工固定权重，不是学习效果模型。前后手错位、劫接缝、先手/零贴目及候选缺字段回退构成可信性缺口；进程取消、并发总预算和Windows daemon亦需补验。[T][H][C][L][A][D]

## 7. 整用、局部复用或仅借鉴：条件而非选型结论

- **整用工具产品**：可把CLI/MCP当外部宿主的围棋插件，前提是接受它不是完整聊天产品，并先验证/修复上述身份、教学局面及规则问题，限制可读文件和配置来源，另配会话与逐次付费确认。不能据本研究批准生产采用。
- **局部复用Python层**：`AnalysisRuntime`适合另建Python worker且确需缓存/引擎复用的部署；纯教学服务适合传入已验证分析。但Go Coach已有Electron/Node/TS、本地KataGo和可信证据，直接引入会多一套Python≥3.11打包、跨语言schema、进程关闭/取消、Windows IPC、配置及引擎所有权协调。若仍由TS拥有KataGo，复用纯服务能避免双重引擎，却还需矫正指标语义和证据绑定。
- **仅借鉴协议**：候选级unknown、合法性与估值分开、Human SL明确可用性、知识“待检索描述”与引用分开，可直接作为TS协议设计参考，不必新增Python。但 `sgf:尺寸:手数`不能用作依据ID，`ok:true`不能当证据齐全，固定权重也不能替代教学评估。[T][E][C][K]

这些选项相对本项目的增益主要是教学数据组织，不是补上可信分析、聊天/RAG或预算能力。究竟采用完整外部工具还是沿用本项目仍由后续比较决定；有限自动本地补查和新增付费请求逐次确认不能从它的默认行为继承。

## 8. 测试、许可、成本与未核验项

已读实际断言：`test_teach_service`验证缺分析null、非候选实战未知、简单劫（同line）、占点/自杀/pass及材料hooks；不覆盖接缝ko、PL/superko或真实教学估值配对。[TS] `test_katago_engine`用假流验证乱序、忽略progress/无关id及超时；`test_engine_runtime`用假client验证同请求去重、缓存先于引擎、close后重建；没有证明迟到同id隔离。[TJ][TE] `test_runtime_analysis`假进程断言argv无shell、超时/协议错会terminate和视角转换；MCP测试验证参数组装、输入错误和非JSON兜底。[TR][TM] daemon测试包含启动真实Python后台进程、ping、停止和缓存坏文件，但没有真实KataGo并发取消断言；本轮没有运行任何测试。[TD]

真实引擎smoke由 `KGTEACH_REAL_KATAGO=1`门控：9路空盘1 visit仅断言id/turn/rootInfo；teach smoke仅断言成功、有候选、无warning，不检查实战/推荐属于同一起点。CI配置只在Ubuntu/Python3.11跑pytest/lint/mypy，没有开启此变量；没有取得该提交真实引擎smoke通过记录，不能声称可用性已实测。[SM][CI]

MIT原文版权为2026 kgteach contributors，复制实质源码须保留版权/许可，不提供保证。[LIC] 源码树未见捆绑引擎/模型大资产；KataGo、权重、未来知识教材和依赖各自许可仍需另核，不能被MIT自动覆盖。构建用uv_build，开发依赖pytest/mypy/ruff；插件启动配置依赖bash＋uv或uvx，后者可能拉取未固定版本的kgteach，不是可直接照搬的离线Electron部署。[P][PLUGIN] 成本为Python分发维护、本地CPU/GPU/内存及模型文件，外部宿主的模型费另计。

覆盖了核心CLI/MCP、SGF/棋规、分析/缓存/daemon和上述测试完整相关控制流；未审阅所有发布脚本、锁文件传递供应链、其余CLI集成测试、所有第三方许可或实际平台行为。后续授权验证重点应是教学t−1配对、跨分支劫、特殊先手/零贴目、迟到id和stderr背压，而非再做README筛选。

## 固定提交证据索引

[C]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/cli.py
[M]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/mcp_server.py
[D]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/daemon.py
[R]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/runtime.py
[E]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/engine_runtime.py
[A]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/analysis.py
[J]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/katago.py
[T]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/teach_service.py
[H]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/teaching.py
[K]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/knowledge.py
[L]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/go_rules.py
[S]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/sgf.py
[G]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/game.py
[CFG]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/config.py
[F]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/src/kgteach/contract.py
[P]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/pyproject.toml
[LIC]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/LICENSE
[CI]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/.github/workflows/ci.yml
[PLUGIN]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/plugins/kgteach/.mcp.json
[SM]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/tests/test_real_katago_smoke.py
[TS]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/tests/test_teach_service.py
[TJ]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/tests/test_katago_engine.py
[TE]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/tests/test_engine_runtime.py
[TR]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/tests/test_runtime_analysis.py
[TM]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/tests/test_mcp_server.py
[TD]: https://github.com/KaiQin04/kgteach/blob/8653eaff9bf6985e9ded1618f2968d4f15537ec9/tests/test_daemon.py
