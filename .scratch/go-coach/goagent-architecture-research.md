# GoAgent 深入架构研究：桌面工具型老师，而非已闭环的连续复盘记忆

核查日期：2026-10-23。已先读前轮研究及 `coach-context-design.md`。只读取公开 API、固定提交 raw 文本和作者文档；未克隆、安装、执行第三方代码，未启动引擎、服务、MCP、付费请求或子代理，未读取凭据和私人棋谱。以下是静态控制流研究，不是实测、安全审计或棋理正确率报告。

## 版本与阅读口径

GitHub 仓库 API 返回默认分支 `main`；随后 `/repos/wimi321/GoAgent/commits/main` 返回 **commit `edc6efa15a9a08499b5d42c8342a15a26a10fdc6`**，其 `commit.tree.sha` 是 `a5eaf820d4e744c9c7791829e294e99eaef51cfc`。前轮把 `edc6…` 称为根 tree SHA 的说法应更正。本报告链接全部固定此 commit，不借 README 宣称代替执行证据。

## 1. 定位、技术栈与部署

不懂框架也可这样理解：界面是“棋盘与聊天窗口”；主进程是“有文件和进程权限的管家”；KataGo 是“计算棋的专家”；语言模型是“会决定下一步查什么、把资料讲成人话的老师”。老师不是直接看见本机全部资料，而是通过管家提供的工具获取；但不同模型入口给出的工具权限并不相同。

这是完整桌面产品，不只是库。`package.json` 为 v0.4.22，Electron 37、React 19、TypeScript、electron-vite、electron-store；提供 Windows/macOS/Linux 打包。API 模式由 Node HTTP 调 OpenAI-compatible endpoint；另一入口是打包/配置的 Codex App Server 子进程，通过 stdio RPC 和 ChatGPT 登录使用模型。KataGo 可本地持久进程或按批启动，也有智子云/iKataGo 路由和回退，不能把产品整体称为“全离线”。[S1][S2][S7][S9]

`store.ts` 在用户 home 的品牌目录（可由 `GOAGENT_APP_HOME` 改写）建立 library、cache、teacher-reports 等目录，electron-store 保存设置、棋谱索引、画像、聊天。`saveReport` 写 Markdown 和 JSON；会话存全文、结果及日志，最多80条，整文件替换保存，不是数据库事务式对话日志。[S2][S4]

## 2. 真实模块数据流

```text
React App.tsx：当前棋盘 / 试下 / 问题 / UI聊天存档
  ├─ preload → teacher-session IPC → teacherSession → electron-store
  └─ runTeacherTaskWithStream → preload teacher:run → main/index.ts
       → runTeacherTask → runTeacherAgentSession
          ├─ providerRegistry
          │   ├─ API：messages + tools → HTTP模型 → tool_calls
          │   └─ Codex：临时thread + 白名单动态工具 → stdio回调
          ├─ executeAgentToolCall → 注册工具
          │   ├─ SGF / KataGo → before、after、强制实战候选
          │   ├─ knowledgeBundleForState → 本地卡片/训练题/规则匹配
          │   ├─ studentProfile → 本地画像读写
          │   ├─ board截图请求 → renderer PNG → 模型后续输入
          │   └─ API入口还提供文件 / shell / 搜索 / 配置工具
          └─ 证据检查 → 可能再次请求模型修正文案
              → report文件 + progress/result → UI → 700ms防抖会话保存
```

这里有两个不同“会话”：聊天窗口的持久档案，和一次运行中临时积累的模型 messages；图中没有从聊天档案回灌模型的箭头，这是代码结果，不是省略。[S3—S6]

## 3. 一次提问的逐步链路及跨轮历史结论

1. `App.tsx::submitTeacherPromptText` 检查 busy/模型就绪，追加学生和空老师消息；识别当前手、区间、整盘或自由问题。试下时先取得试下分析；提交 `prompt:text`、gameId、moveNumber、boardContext、trialBranch、可选 prefetchedAnalysis。**没有把旧 messages 拼入 text。**[S3:L3039-L3145]
2. `runTeacherTaskWithStream` 增添 runId 和 teacherSessionId，订阅带 runId 的流式事件，暂停 quick/live 分析；preload 原样 invoke，main 的 `teacher:run` 原样转发并注入截图回调，没有补取历史。[S3:L1875-L1958][S5]
3. `TeacherRunRequest` 有 teacherSessionId，但无 history/messages 字段。`runTeacherTask` 归一化工具策略/年龄/棋力，登记 AbortController，分类意图，调用 `runTeacherAgentSession`。[S6][S7]
4. 后者取得当前棋谱绑定画像，建立临时 state；messages 只有 system 和 `initialAgentUserMessage`。后者带当前问题、局面身份、截图/分析摘要，不读 teacherSession。工具结果加入 `assistant.tool_calls` 和带 `tool_call_id` 的 tool 消息，再请求模型；同一轮内确实有累计记忆，最多12次外层 turn。[S7:L2048-L2155]
5. 返回文本后要求相应意图完成截图/KataGo/知识工具，检查视觉表述，必要时另发一次无工具修正请求。随后生成结构化结果、保存报告、发 done；renderer 更新显示，effect 在700ms后调用 `updateTeacherSessionMessages` 持久化。失败显示 error，很多保存异常被 catch 吞掉，不保证异常退出前最后内容已落盘。[S3][S4][S7]
6. 恢复会话的 `restoreTeacherSession` 只设置 sessionId 和 UI messages，不恢复棋谱/试下，也不改变下一次 prompt 组装。Codex 入口也不是暗中延续历史：`runTurn` 每次 `thread/start(ephemeral:true)`，结束 `thread/delete`；没有用 teacherSessionId 恢复线程。[S3:L1073-L1186][S9:L623-L737]

**确定结论：这条已追完的桌面提问链具备本轮工具记忆和本机聊天存档，但没有跨用户轮次聊天记忆；一盘一连续会话也不是约束。**学生画像是另一条跨局长期状态，不能代替“你刚才说的那手”。

## 4. 棋局、分支、检索与画像

### 实战比较确有同局面基础，但不是任意候选搜索器

`analyzePosition` 从同一 SGF 取 N−1 手前缀和 N 手前缀；before 与 `forcePlayedMoveQuery` 共用落子前 moves、初盘、贴目，后者用 `allowMoves:{player:currentMove.color,moves:[实战点],untilDepth:1}` 搜实战候选。`buildMoveAnalysis` 统一黑方数值，再按落子者转换比较；不是把对手下一手一选当成本方替代手。[S8:L878-L1030]

`katago.compareMoves` 本身只读取已有分析或调用一次 `analyzePosition`，然后**筛选 before.topMoves 中已有坐标**；请求的任意新点不在候选里就不返回，未为其单独强制补查。`analysisForMoveNumber` 只比较手数，不验证 gameId、分支、规则、引擎；允许工具参数改变 gameId 后仍复用旧 lastAnalysis，是确定的身份检查缺口，实际错配需合成案例复现。[S7:L1117-L1120、katago_compareMoves]

### 试下存在比前轮更严重的接线问题

`analyzeTrialPositionWithProgress` 拼接原谱前缀与试下，去掉最后一手形成 before，再构建 after 和强制最后试下手查询；传 initialStones/initialPlayer，before 行棋方取试下最后一手颜色。这条服务内流程确实区分实战与试下。[S8:L1182-L1344]

但完整上下游显示：renderer `trialBranch.ts::hashBranch` 是 **FNV式32位、8位hex**，材料为试下的颜色＋GTP列表；main `stableTrialBranchHash` 是 **SHA-256截16位hex**，材料还包括 base、row、col。二者最终字符串长度不同。main IPC 原样回传服务 hash，而 `App::analyzeTrialBranch` 对进度和最终结果都严格要求等于 renderer hash；没有转换层。因此按该控制流正常试下返回会被忽略，final 分支返回 null。这不是已实测UI故障，但不只是猜测“缓存可能失效”。[S10:hashBranch][S8:L178-L196][S5:katago:analyze-trial-position-stream][S3:L2096-L2223]

随后老师工具 `katago.analyzePosition` 在预取不匹配时，回退调用的是**主线** `analyzePosition`，并非试下服务；`knowledgeBundleForState` 同样只用原谱 `record.moves` 重建棋盘，不应用 trialBranch。推论：试下截图、主线分析和主线知识可混进同一回答，需要优先复现、不能当作现成可靠试下教练。[S7:L1058-L1115、katago_analyzePosition]

branchHash 两端都不含完整原谱前缀、规则/贴目/初盘/引擎身份；renderer 缓存另加 gameId 和 modelPreset/model，但不包括全部分析条件。已有缓存设计不等于 Go Coach 的可信证据身份校验。[S3:trialCacheKey]

### 棋规与 SGF 的真实边界

SGF parser 只跟第一子变化；保留有色 moves，空点及越界点按 pass；只取根节点 AB/AW/AE，`PL` 不进入 GameRecord。initialPlayer 由第一手颜色推断，无手时默认黑；中途摆子、压缩摆子范围不是完整实现。KataGo 请求两条构造路径都写死 Chinese，虽然读取 RU 并用于贴目归一化。试下数据无 pass 操作，转换强制 `pass:false`。[S8:buildKataGoPayload、sideToMoveAt][S11]

renderer 检查占点、自杀和试下起点之后重复盘面；未带主线起点以前的重复历史，不能宣称全规则劫/超级劫正确。主进程试下入口只归一化颜色/坐标，没有等价完整合法性重验。知识层 boardState 会警告覆盖占点、自杀后继续重建，是辅助快照，不是拒绝非法变化的可信裁判。[S10][S11]

### 检索是什么：有检索增强，但不是向量记忆

两个知识工具都进 `knowledgeBundleForState`：取局面前快照、局部窗口、候选、PV、损失、画像级别 → `searchKnowledgeMatches` 和 `searchKnowledge` → tool结果送回模型。实际来源是 index 指向的 Markdown、p0/pattern/shape JSON卡和 training-catalog，不是聊天历史库。[S7][S12]

`matchEngine` 按棋局阶段、区域、关键词包含关系、落点特征与答案坐标重叠加权；死活/手筋还比较局部相对棋子、旋转反射/颜色交换、相邻组与气数。`confidence` 是分数阈值；特别是 `sequenceOverlap` 对坐标集合计数，不核对次序和执子方，所以 `exact` 标签不能理解成严格同型证明。另一个 `knowledge/searchLocal.ts` 虽有简单分词检索，但不能只因文件名就把它当这两个工具的实际入口。[S12][S13]

可称“本地规则/关键词检索增强生成”，已读链没有 embedding、向量库或远程索引调用。多数资料集合按根目录进程缓存，p0卡是只判断已有缓存、不核对根目录的例外。Markdown索引正文首次加载时已整读入本机内存，动态的是选中材料进入模型上下文；其MD评分只用元数据、不查query.text，文字匹配在其他分支。详见[知识检索专项核验](goagent-knowledge-retrieval-research.md)。未见这些入口自动联网更新教材；搜索工具只抓 DuckDuckGo 前五标题，不自动写回知识库。来源注册表自述原创新编常见型、外部分类参考及禁止导入的资料；这是作者来源声明，非本研究独立版权/棋理认证。[S12—S14]

画像 `getStudentProfile` 可创建默认画像；模型可调用 `studentProfile.write`，把本次标签、训练重点、典型手和复盘数量累加写入，不需要单独“画像LLM”。但不是每次问答结束必然更新，也没有对模型给的弱点做独立专家验证。`updateStudentAfterAnalysis` 另有函数，本轮没有穷尽其他入口调用，不能宣布全产品更新时机均已追完。[S7:studentProfile_write][S15]

## 5. 权限、隐私、成本、并发和取消

**权限必须按 provider 分开，修正前轮笼统判断。**[S7][S9][S16]

- OpenAI-compatible：registry 返回全部工具；`executeAgentToolCall` 只查注册名称、取消状态和解析参数，没有逐工具授权弹窗、目录沙箱或设置开关。shell 执行前确有 `dangerousShellCommand` 黑名单（rm -rf、sudo、git reset等），不能说完全无防护；但不是命令白名单，cwd 任意 resolve，继承 process.env。filesystem.read 任意 resolve 后同步整文件读取、再 slice；maxBytes 实为字符截断，不是读前字节限额。主入口存在别的 appHome 路径保护函数不代表这里调用了它。
- Codex：registry 剔除 shell/filesystem/web/config/system，只留领域工具；客户端执行回调再次检查 allowedTools，禁内建shell/web/插件等，临时根目录、read-only sandbox，非动态工具RPC拒绝。`approvalPolicy:'never'` 是无审批交互，不是每次让用户确认；领域工具仍能写画像/报告。不能把 API 风险原封不动归给此入口，也不能把 Codex 沙箱当成主进程工具的通用沙箱。
- 输出有正则脱敏、18k工具结果截断、24k shell输出限额；这是缓解，不是可靠保密边界。模型控制搜索 query，工具描述说“不发隐私”，执行体没有强制泛化/隐私检测。工具正文作为 tool消息再输入模型，无独立防提示注入验证；与广权限组合是推论风险，未做攻击复现。
- 密钥并非当前使用 OS safeStorage：`encryptSecret` 用 AES-GCM，seed 放同目录 `secrets.key`（创建 mode 0600）；旧 safeStorage 值直接返回空，要求重新输入。具备该用户目录读权限者可同时拿密文和seed，保护目标不同于本项目 OS加密；API key 以 Bearer 发往用户设置 endpoint，窗口还可通过专用IPC取已存key。这里只读了代码，没有访问任何真实secret。[S2][S5][S17]

**成本：**没有在已追模型路径中发现逐次付费确认或累计金额账本。12是外层 turn，不是网络请求硬上限：一次 turn可能多个工具；视觉修正额外请求；API流式空结果会尝试参数变体/非流式，后者可能把4096预算提高至8192；暂态失败最多3次尝试，已出可见文本则不自动重试，遵守最长60秒 Retry-After门槛。usage 用于诊断/空结果判断，不等于预算扣账。Codex 一次外层turn内部可反复动态调用，上限18按成功调用记录计数，失败不累加，且未构成全链费用上限。[S7][S9][S17]

**取消与并发：**renderer busy阻止本窗口重入，runId过滤迟到文本；main 用 ACTIVE_TEACHER_RUNS map，并非全局单任务锁。取消会abort模型并取消KataGo，指定run还额外取消整个teacher组，可能影响其他并发运行。API timeout180秒覆盖响应正文消费，取消也可打断重试等待。shell前台超时SIGTERM，但不接teacher abort；后台启动即清除timer，只登记全局SHELL_TASKS，teacher结束/取消不自动kill。DuckDuckGo有12秒超时但未接本轮signal。Codex RPC20秒失败会杀进程并拒绝pending，turn completion等待本身没有总时限；有 interrupt 与 finally清理临时图/线程。引擎持久池、远端重连和多窗口全部竞态未审完，不作隔离保证。[S3][S7—S9][S17]

## 6. 优点、缺点与适用场景

**优点：**真实自主工具闭环；截图由界面回填模型；同一落子前强制实战搜索避免只比前后根值；明确 partial/weak 资料边界；领域工具与provider适配器分离；支持本机档案、画像、完整桌面发布。适合愿意接受其产品流程的单机学习者，以及研究“老师应主动查哪些证据”的团队。[S1][S7—S16]

**缺点：**存档不回灌、试下hash上下游不一致、试下知识仍取主线、比较缓存身份不足；规则只部分支持；API入口权限远超围棋；自动重试与修正不满足请求级费用确认。大型 `App.tsx` 与 `teacherAgent.ts` 集中大量状态/工具；复用运行时不是复制一个纯函数即可。知识“exact”及质量门不能替代专业棋手审阅。适用性取决于愿意修这些边界，不能只看功能列表。[S3][S7—S17]

## 7. 整用、局部复用、仅借鉴：条件而非选型结论

| 路径 | 具体对象与条件 | 相对 Go Coach 的差异 |
|---|---|---|
| 可考虑整用/分叉完整产品 | UI、棋谱管理、画像、报告、双provider整套；先授权隔离验收，修复分支/历史链，决定权限和请求确认政策，核对数据许可证 | 同为Electron/Node/TS，迁移不跨语言；但现有合法回放、可信证据、OS凭据不能假定由其等价替代。完整替代也不是被本报告预先排除 |
| 可局部复用 | provider接口/流式tool_call组装、独立知识匹配器、画像数据结构、置信边界格式、试下UI交互思路 | provider adapter直接读全局store取key，知识包装读Electron路径，teacherAgent依赖store/SGF/截图IPC/注册表。应先注入存储、凭据、证据/工具接口；知识卡单独审许可与内容 |
| 仅借鉴为宜的当前实现 | 跨轮记忆方案、branchHash、棋规/缓存身份、广权限工具、12轮及重试默认值 | 当前记忆链没有实现需求；hash两端不一致；本项目已有规范前缀和证据时效，不能降级为手数匹配。逐次付费确认须拦每次真实请求，而非只拦用户按发送 |

仍待产品选择：一盘唯一会话、跨手/跨分支指代、外发哪些历史、自动本地补查额度。GoAgent提供参考和可改造产品基础，不替主代理或用户决定采用、分叉或继续自建。

## 8. 测试、许可、依赖成本与未核验项

`teacher-agent-runtime-contract.test.mjs` 和 `trial-branch-contract.test.mjs` 是读源码后 assert.match/doesNotMatch，证明文字/接线形状存在，不会发现两端hash算法不一致。`knowledge-training.test.mjs` 不全是正则：还检查真实JSON结构，并通过jiti执行fixture，断言匹配排行、geometry/liberties；能约束样例召回，不证明推荐手合法或教学正确。本研究未运行任何测试。[S18]

作者说明 engine-silver 是 schema/silver-oracle gate。`eval_real_teaching.mjs` 的“真实”模式确会启动引擎/调模型，但使用脚本自建parser、payload和prompt，不走桌面teacherAgent；评分检查关键词、坐标是否在已知集合、bestMove集合及 evidenceRefs非空，不验证引用实际支撑论断。默认缺配置可skip、strict才失败；存在脚本不是已取得的评估结果。本研究没核实运行日志、专家盲审或学习收益。[S19]

根 LICENSE 是 MIT（2026 haoc，保留版权与许可）；**整包不等于纯MIT教材**：`joseki-source-manifest.json` 明列随包 Pachi SGF 为 GPL-2.0-only、Josekle为MIT，Kogo未打包且要求授权。来源表也注明上游数据/评论需另查。未独立追溯所有素材、模型和依赖授权，不给法律保证。[S14][S20]

本地模型/引擎有磁盘、CPU/GPU及打包维护成本；API推理按供应商收费，Codex依赖登录/账号条件；语音资产、Python复盘属于额外依赖面，非最小teacher链必需。未测安装体积、性能、远程算力价目、OS沙箱实效、全规则棋谱、完整artifact安全、全引擎缓存/调度、全部知识识别下游。最先应在另获执行授权后复现hash拒收、试下回落主线、恢复旧会话追问、跨game同手数缓存四组反例。

## 固定提交证据索引

链接中的函数/区间均来自实际读取；未稳定逐行核对的条目只给文件和函数，不补造行号。

- [S1 package.json](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/package.json)：依赖、打包配置。
- [S2 store.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/lib/store.ts)：appHome、stores、encryptSecret/decryptSecret。
- [S3 App.tsx](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/renderer/src/App.tsx)：上述提交、恢复、持久化与试下函数。
- [S4 teacherSession.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/teacherSession.ts)：saveSessions、updateTeacherSessionMessages。
- S5 [main/index.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/index.ts)；[preload/index.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/preload/index.ts)：teacher/试下/会话/凭据IPC。
- [S6 types.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/lib/types.ts#L1345-L1366)：TeacherRunRequest。
- [S7 teacherAgent.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/teacherAgent.ts)：runTeacherTask、runTeacherAgentSession、executeAgentToolCall、createTeacherAgentTools、knowledgeBundleForState、runShell、saveReport。
- [S8 katago.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/katago.ts)：analyzePosition、analyzeTrialPositionWithProgress、forcePlayedMoveQuery、queryKataGoBatch。
- [S9 codexAppServerClient.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/llm/codexAppServerClient.ts)：handleServerRequest、runTurn、request、waitForTurnCompletion。
- [S10 trialBranch.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/renderer/src/features/board/trialBranch.ts)：hashBranch、addTrialMove、boardWithTrialMoves。
- S11 [sgf.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/sgf.ts)；[go/boardState.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/go/boardState.ts)：parseMoves、readGameRecord、extractInitialStonesFromSgf、playMove。
- [S12 knowledge.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/knowledge.ts)：searchKnowledge、searchKnowledgeMatches；[training.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/knowledge/training.ts)：loadKnowledgeTrainingLibrary。
- S13 [matchEngine.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/knowledge/matchEngine.ts)：buildFeatures、sequenceOverlap、localShapeGeometryMatch、confidence；[patterns.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/knowledge/patterns.ts)；[shapeRecognitionEngine.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/knowledge/shapeRecognitionEngine.ts)。
- S14 [source-registry.json](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/data/knowledge/source-registry.json)；[joseki-source-manifest.json](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/data/knowledge/joseki-source-manifest.json)。
- [S15 studentProfile.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/studentProfile.ts)：resolveStudentByName、updateStudentProfile。
- [S16 providerRegistry.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/llm/providerRegistry.ts)：toolsForLlmConnection、runProviderTurn。
- [S17 openaiCompatibleProvider.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/llm/openaiCompatibleProvider.ts)：fetchWithTimeout、attemptOpenAICompatibleToolTurn、streamOpenAICompatibleToolTurn。
- S18 [runtime contract](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/tests/teacher-agent-runtime-contract.test.mjs)；[trial contract](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/tests/trial-branch-contract.test.mjs)；[knowledge-training.test.mjs](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/tests/knowledge-training.test.mjs)。
- S19 [作者评估说明](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/docs/TEACHER_PERSONA_SESSIONS_REAL_EVAL.md)；[eval_real_teaching.mjs](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/scripts/eval_real_teaching.mjs)：callLlm、scoreFixture、main。
- [S20 LICENSE](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/LICENSE)。
