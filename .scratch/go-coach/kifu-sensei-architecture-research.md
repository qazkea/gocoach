# Kifu-Sensei：固定提交架构研究

## 研究边界与版本

2026-10-23，仅阅读公开 GitHub API、固定提交 raw 文本；未克隆、安装、执行、启动服务/引擎、调用推理、读取凭据或私人棋谱，也未启动子代理。先读了本目录前轮开源研究及 `coach-context-design.md`。以下“确定”指源码控制流，不代表运行成功、安全审计或棋理正确率。

仓库 API 的默认分支为 `main`；[commits/main 返回的提交](https://api.github.com/repos/YianXie/Kifu-Sensei/commits/8e4c66264ce191f958599056bc20eed9afc0c9d2)是 **`8e4c66264ce191f958599056bc20eed9afc0c9d2`**，其 `commit.tree.sha` 为 `3228191058e8a39ace7a4dfbdf5d12f096931594`。因此前轮所谓“根 tree SHA 8e4c…”应更正：本轮用 commit API 确认为提交，不沿用 tree 接口顶层回显作为判据。以下链接全部锁定此提交。

## 1. 定位、技术栈与部署

这是“整盘扫描→选择失误→逐条生成评论”的 Web 产品，不是连续聊天 Agent。真实依赖为 React 19/TypeScript/Vite、Axios、`@sabaki/go-board`；后端 Python≥3.12、FastAPI/Uvicorn、SQLModel、sgfmill、httpx、Anthropic SDK、Fernet、JWT，另有无框架 TS 浏览器扩展与 shared 包。[前端依赖][package]、[后端依赖][pyproject]。

[Makefile][make]分别运行 Uvicorn 与 Vite，没有启动 KataGo 的目标；[配置][config]要求 `API_ENDPOINT`，`get_http_client` 向该地址 `/analyze` 发 JSON。仓库树与所读实现没有这个 HTTP 分析服务器：**KataGo 本体、模型、HTTP 包装器是部署前提，不是此仓库实现**。README 声称 Render 前后端＋PostgreSQL 已部署，只作为作者说明，未访问部署验证。[数据库][db]默认 SQLite 文件，启用外键/WAL/30秒 busy timeout，也有 PostgreSQL 连接池分支；存在 Alembic，但启动 `init_db` 是 `create_all` 加少量补列，不能把它当完整旧库迁移保证。

[模型][models]只有 User、Commentary、CommentaryJob：用户含密码散列、加密 API key、偏好、token_version；评论存 moves、initial_stones、comments、带注释 SGF、model、usage；任务存状态、进度、结果副本和错误。没有棋局唯一键、分支表、消息表、向量库或预算账本。适合自托管批量复盘，不等于离线桌面。

## 2. 真实模块数据流

```text
SGF 文件
  → Commentary.handleFile / handleGenerate（浏览器读文本）
  → useCommentaryJob.start → POST /api/commentary/jobs/ + Bearer
  → CurrentUser → DB 插入 queued（每用户一个活跃 job）
  → FastAPI BackgroundTasks → _run_commentary_job
  → 专用 ThreadPoolExecutor → generate_commentary
      → sgfmill 主线 + setup → 50 visits 全盘 HTTP /analyze
      → 按落子者胜率损失选 N 手
      → 500 visits：这些手后局面 + 对应手前局面，各自分批 HTTP
      → sgfmill 显示棋盘 + 自有 Board 重放
      → DetectorContext → detectors → 最多8行特征
      → board/前后数值/候选/PV/ownership → 每手一个 user prompt
      → 解密该用户 key → Anthropic.messages.create（串行 N 次）
      → usage 求和、C[] 注入 SGF、前端坐标转换
  → Commentary 永久历史 + job.result / succeeded
  → GET job 轮询 → GameViewer / 注释下载
```

链路依据：[页面][page]、[轮询 hook][hook]、[入口][router]、[流水线][pipeline]。SQL 是任务状态与结果存储，不是可恢复执行队列；LLM 没有工具调用出口或自主补查环。

## 3. 一次请求怎样走完

1. `handleGenerate` 读取整个文件，提交文件名、SGF、模型、语言、评论数、输出上限及自定义指令。`GenerateCommentaryRequest` 限评论1–100、输出256–8192 tokens、自定义文本1000字符、SGF字符串200万字符；后者不是精确 UTF-8 字节预算。[page][schema]
2. `create_commentary_job` 提交 queued 行后关闭请求 session，再登记后台任务并返回202；部分唯一索引原子限制每用户 queued/running 一项，冲突409带已有 job id，前端改为附着轮询。旧同步 `/api/commentary/` 仍存在；其注释“web app 使用同步”已过时，实际页面已经用 jobs。[router][models][hook]
3. `_run_commentary_job` 自取 User/job，释放 session 后在线程池运行；`on_progress` 每个评论结束更新数据库。KataGo 扫描阶段没有假百分比，直到 Claude 前才公布总数。默认4工作线程，避免占满普通请求线程池。[router][config]
4. `generate_commentary` 先检查有无 key，再解析、扫描、精查、组 prompt；Claude 返回后生成评论列表，`_inject_comments_into_sgf` 按“落子节点”计数，跳过裸注释节点，保留原 C[] 后追加新文。[pipeline]
5. `_save_commentary` 保存失败会回滚、记录日志但不丢弃已生成结果；job 另存结果后成功。最终结果不逐条落盘，进度已前进不代表该条评论已耐久保存。[router]

## 4. 棋局、配对、分支与记忆

**两阶段不等于两个 HTTP 请求。** `sgf_to_winrate_request` 分析0…M手，50 visits/PV5；`generate_commentary` 把黑方胜率差按刚落子者转换，升序取 N 个最差值，不是绝对摆幅，也不是教学重要性分类；没有最小损失阈值，必要时也会选正收益手。再 deepcopy 相同 SGF条件，500 visits/PV15、ownership/policy、wideRootNoise=0.04，对选中 n 与 n−1 分别分析。默认每请求1000 visits预算，精查每批通常2局面；重叠局面可能跨两遍重复分析。[解析与精查][parse]、[pipeline]

`_check_pass_is_complete` 比较完整 turnNumber 多重集合，随后两组各自排序再配对，避免缺一条或乱序导致错位。`currentPlayer` 是下一方，反色用于评论落子者；返回 `color` 又从 `moves[turn−1]` 读取，不靠奇偶。胜率转落子者视角，绝对目差仍黑方视角、变化对白方反号。[配对检查][check]、[prompt][prompt]

**比较具有共同原谱起点，但不是对称反事实实验。** 推荐手取 `prev_detail.moveInfos[0]`，实战排名也在手前候选中查找，因此不是拿对手下一手当替代手；实战未入候选就明说。可是实战后估值来自另一次 root 搜索，推荐估值/PV来自手前搜索的候选；没有强制 actual/recommended 各500 visits分支、候选有效搜索量对齐、推荐后 ownership 或推荐棋盘重放。图是在实战后棋盘上标记手前推荐点；适合“解释推荐”，不能宣称实现同条件两条变化对照。请求也没有锁定引擎版本、模型指纹或分析证据身份。[prompt][parse]

SGF只分析主线；初手前非落子节点的 AB/AW/AE 会累积，中途 setup 仅警告并跳过；pass 保留颜色与手数。KM[0]正确保留，缺KM默认7.5；RU别名映射，未知规则退为 tromp-taylor。没有读取 PL 或显式发送 initialPlayer，也不根据 HA 单独生成让子；实际摆子靠 AB/AW。特殊先手依赖外部服务如何解释 moves，未核实。原SGF变化可随序列化保留，但没有分析分支树身份。[parse]

`Board.place_move`做提子后判自杀、简单劫与pass；不实现superko，显式color允许指定落子者，不核验严格轮换。检测重放遇错删掉整个特征块；显示重放则跳过坏棋子继续。二者都不是“整谱合法性证明”，且与允许自杀的规则可能不一致。[board][replay]

`GameViewer`浏览 moves/手数与评论；`Commentary`每次生成新增历史行，没有同盘去重、一盘连续会话或自由试下追问契约。全后端只挂 auth/go 两组路由；每条 Claude 请求重新创建单条 user 消息，不携带旧评论。这里的 history 是复盘作品存档，不是聊天记忆；无RAG或隐藏聊天入口的代码证据。[viewer][main][claude][auth]

## 5. 检测器、权限、成本与失败边界

### 检测器实际给了什么

注册表28项：双打吃、打吃、忽略打吃、自打吃、提子、劫、接触、连接、长、脱先、气数、线数、区域、阶段；安定度、最大区域选择、安定变化、局部ownership变化、先后手、方向；切断、征子、提一子菱形、扳、虎口、竹节、空三角、棋子相对形状。`detect_move_ranking`虽实现但不注册，避免重复prompt数据。[concepts]

已完整阅读代表控制流及上下游：`_newly_ataried_enemy_chains`只报告从非一气降至一气；连接按落子前不同棋块计算；空三角要求第四点真空而非敌子；ponnuki要求本手恰提一子。`DetectorContext.from_analysis`把手后ownership与手前候选明确分栏；OwnershipMap统一数组顶行优先和黑方正号，visits<100时相关检测器沉默。`run_detectors`去重、继承优先级、排序，renderer最多8行。[facts][estimates][render]

启发式并不全被诚实降级：脱先靠距离、阶段靠进度、最大区域靠九宫格 `sum(1−abs(ownership))`、先手靠实战候选PV第二点距离≤4，后两者确实标 HEURISTIC，渲染 `estimated —`。**但 `detect_group_settledness` 用±0.60阈值给 settled/dying，`detect_settledness_change`也给安定标签，却未设置certainty，继承默认EXACT；于是标题和system允许“当事实讲”。这是确定的标签控制流不一致，不是已证明Claude必然误教。** ownership是估计，不是死活解答。[estimates][render][system]

征子 `_ladder_line`最多512节点、深度4×棋盘边长，只读被追方延长唯一一气、追方二选一打吃；没有穷举被追方在别处提子解围等防守。结果有限模型内可复算，`detect_ladder`却输出“caught…captured”且默认EXACT；它不是通用战术证明。此风险为读到分支集合后的推论，具体误判局面待复现。[ladder]

提示既有约束也有反证：system要求未知就说未知、只用已检测术语、不把自打吃直接判错；但“可陈述为事实”使标签可靠性成为上游责任。ownership压缩成B/b/?/w/W格、区域均值及局部均值；policy全数组虽请求，却主要使用候选prior及排名；PV是坐标序列与主要区域，没有完整反事实验证。词典来自代码中的关系偏移、区域名称、英文模板，不是检索教材或定式数据库。[prompt][system][vocabulary]

### 权限、隐私、费用、并发

- **账号边界存在**：CurrentUser校验Bearer、token_version；任务/历史按user_id过滤，别人ID返回404。key由 `set_claude_api_key` Fernet加密入库、调用时解密；密钥材料来自服务端配置（SHA256派生），不是本机OS密钥链。后端运营者可解密。代码注释“key不离开服务器”不能按字面采信：Anthropic客户端当然用它向供应商认证。[deps][auth][crypto][claude]
- **外发范围**：完整SGF先上传后端，完整moves/setup及规则传KataGo HTTP；每选中局面的棋盘、数值、特征、PV与custom instruction传Claude。SGF原C[]不直接加入讲解prompt，但在结果SGF保留入库。DEBUG把完整user prompt写 `logs/katago_service.log`，10MB×当前文件及5备份；console INFO避免通常的标准输出聚合，但不是禁日志或脱敏。[logging][pipeline]
- **成本非账本**：Claude串行每手一次，无逐请求确认；SDK未设 `max_retries=0`，依赖SDK默认重试，确切次数/延迟未追SDK源码。成功响应usage相加，失败请求与重试已消耗但未返回usage的量无法对账。没有金额预留/硬上限/原子扣减。README宣称“prompt caching、低于$0.10”，但已读请求未显式配置cache_control；本轮也未追SDK内部或供应商实际缓存行为，不能据README给出已实现缓存或低于该费用的保证。[claude][schema][readme]
- **局部失败可保全**：APIError单手失败插占位继续，全失败抛最后错误；不会为修复一条自动重跑全部。HTTP超时及408/504/524按批减半，每遍最多两次减批重试，单局面不再减；503不重试，返回turn不全即失败。重试并不保证外部引擎已停止原任务。[http][claude]
- **取消不成立**：hook `stopWatching`只停观察；后台没有取消路由。关闭executor只取消尚未开始future，不中断运行中线程。重启 `reap_abandoned_jobs`把所有queued/running标failed，不恢复生成；此前已付费但仅在内存的评论会丢失。[hook][router]
- **部署限制**：4线程是单进程工作并发，不是全局队列容量；同步旧端点未走每用户job唯一索引。启动reaper也未区分worker租约，多worker共库时可能把其他进程活跃任务误标失败。这些是控制流支持的部署风险，未复现。删除key/登出后，已取出的detached User仍可继续运行，不是请求级撤销开关。[router][auth]

## 6. 优点、缺点与适用场景

优点不在“检测器多”，而在模块可解释：纯Board/DetectorContext与网络解耦；前后候选来源清楚；缺候选有明示；关键手筛选削减模型调用；乱序/缺turn防护、部分评论失败保全、用户隔离和真实进度形成实际产品闭环。

代价同样具体：集中服务托管棋谱和key；外部KataGo黑方视角/版本条件是隐含契约；两个重放器容错不同；有限检测被包装成事实；没有交互记忆与对称变化；批次调用不能满足每个付费请求重新确认。适合愿意信任自托管服务器、一次上传取得关键手评论与注释SGF的用户，不适合把它现状称为离线连续教练。[pipeline][router][concepts]

## 7. 整用、局部复用或仅借鉴

- **可考虑整用**：若需求接受Web账号/BYOK、服务器保存、批次复盘，并愿补齐KataGo HTTP服务、部署与许可核验，这是完整产品候选，不必先验排除。但必须实测规则边界、重启/并发及教学输出；不能据README宣告已成熟。转为本机自托管仍有Python/Web/引擎HTTP三层运维。
- **适合局部复用**：`DetectorContext`手前/手后结构、Finding的certainty/salience、OwnershipMap坐标适配、去重/截断、注释节点计数、缺候选表达及测试题型。Python与Go Coach的Node/TS不直接兼容，可移植算法但要重写契约测试；应先修估计分级，把引擎估计和战术读数的适用域一起传递。
- **仅借鉴、不直接搬**：整套JWT/SQLAdmin/服务器key托管、进程内jobs、批次Claude循环、完整prompt日志。Go Coach已有本地KataGo、合法回放、可信分析证据和OS凭据，应比较现有能力与替换成本，而非再造一套。它的证据包可供讨论，但不是我们“一盘一连续会话、本机保存、自由试下、有限本地补查”的实现；付费逐次确认与尚未确定的历史外发范围必须另设契约。本报告不替主代理选择继续自建或整用。

## 8. 测试、维护、许可与未核验项

[流水线测试][tests]真实断言：反序假响应仍配正确n/n−1、筛最差手、分批预算、504减批/503不重试、缺turn拒绝、无key/坏SGF不调用上游、单手占位、全失败抛错、usage只加成功项；Anthropic用固定“Comment #N”和100/40 tokens假响应，不能证明提示能教棋。

[检测测试][ctests]验证旧一气不算新打吃、连接按块不按邻子；[ownership测试][ktests]用不对称合成数组测试转置/行列反转、黑白视角、低visits/缺数据沉默、±0.60阈值；[形状测试][stests]验证不提子的菱形不算ponnuki、征子逃逸/节点限额及措辞不直接判好坏。它们验证程序定义，不验证定义等于正确棋理。另有[可选真实引擎测试][live]仅在环境变量指定端点时执行；本轮未执行，文件存在不代表通过。路由tests以stub pipeline核对202、结果、409、跨用户404与reaper；不是生产多worker竞态证明。[rtests]

提交作者日期2026-08-24，仓库API pushed_at为2026-08-30、未归档；这两个日期不是稳定发布/持续维护保证。MIT原件版权2026 Yian Xie，复制实质代码须保留版权及许可；KataGo模型、依赖、图像/音频资产不自动由MIT覆盖。[license] 锁文件存在但未全量审计；实际成本还有引擎算力、HTTP部署、DB/运维、Anthropic tokens，未核当前模型可用性或价格。

覆盖：读完核心生成与HTTP/LLM控制流、后端路由/模型/配置、前端提交轮询、代表性完整检测及测试；未全面审阅浏览器扩展权限/OGS抓谱、每个检测器所有辅助分支、全部前端棋盘实现、迁移与供应链，也未追外部KataGo服务/SDK内部。尤其黑方视角约定、PL/特殊让子、superko、模型教学质量、全量安全性仍不能给保证。

## 固定提交证据索引

[package]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/frontend/package.json
[pyproject]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/pyproject.toml
[make]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/Makefile
[config]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/config.py
[db]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/database.py
[models]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/models.py
[page]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/frontend/src/pages/Commentary.tsx
[hook]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/frontend/src/hooks/useCommentaryJob.ts
[router]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/routers/go.py
[pipeline]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/katago.py#L1240
[schema]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/schemas.py
[parse]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/katago.py#L781-L883
[check]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/katago.py#L312-L335
[prompt]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/katago.py#L908-L1079
[board]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/board.py#L647
[replay]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/katago.py#L688-L780
[viewer]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/frontend/src/components/game/GameViewer.tsx
[main]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/main.py
[claude]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/katago.py#L1080-L1182
[auth]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/routers/auth.py
[concepts]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/concepts.py
[facts]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/concepts.py#L572-L769
[estimates]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/concepts.py#L1082-L1309
[render]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/concepts.py#L1903
[ladder]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/concepts.py#L1724-L1830
[system]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/katago.py#L884-L907
[vocabulary]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/go_text.py
[deps]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/deps.py
[crypto]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/crypto.py
[logging]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/katago.py#L55-L83
[http]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/app/services/katago.py#L197-L335
[readme]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/README.md
[tests]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/tests/test_katago_pipeline.py
[ctests]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/tests/test_concepts.py
[ktests]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/tests/test_concepts_katago.py
[stests]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/tests/test_concepts_shapes.py
[live]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/tests/test_katago_live.py
[rtests]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/backend/tests/test_go_router.py
[license]: https://github.com/YianXie/Kifu-Sensei/blob/8e4c66264ce191f958599056bc20eed9afc0c9d2/LICENSE
