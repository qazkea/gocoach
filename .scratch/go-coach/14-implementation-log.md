# 14：Windows 桌面实现续接记录

Execution: in-progress（主代理验收前不标 done）

## 恢复与范围

- 2026-10-17，使用 `openai-codex/gpt-6.1-sol` / max 续接既有 worktree `C:/Users/789/AppData/Local/Temp/pi-agent-ddfe4e74-df37-42c-b73f6747`，未在主工作区写业务代码，未另建 worktree。
- 原 detached `96a9999` 的 `.gitignore`、package/lock、server/index、desktop、desktop-tests 和 desktop Playwright 配置全部读过并保存为 `c9f5548` WIP checkpoint。手工分支 `implement/windows-desktop-sol`；随后以 `0beda61` 合入最新 integration/go-coach `f6c684d`，只新增工作流模型文档变化。
- 已读 AGENTS、工作流、领域说明、GLOSSARY、14-design/任务/预研、13-main-acceptance、desktop-review-scope 及主路径 TDD 三文件；worktree 无 docs/adr。
- 旧输出末尾记录 `npm.cmd run test:desktop` 的 1 条 smoke 通过（旧 agent 2026-10-17 12:20:37 本地时间）。这不是本代理的新 RED 或完整验收。原包/源码只实现未配置窗口与基本 utility 关闭；无配置选择、CSP 等交付证据。
- 恢复时精确路径进程检查仅匹配执行本次检查的 PowerShell；没有遗留桌面/桥/引擎进程，也未终止任何进程。5193 无监听；用户 5173 不操作。

## 依赖与包基线

- 实装 electron **44.8.0**、electron-builder **26.15.3**、Playwright **1.64.1**；宿主 Node **24.15.0** / npm **11.12.1**。
- 既有 lock 与 96a9999 比较，原有 package 路径的版本均未升级；新增/去重来自获准 Electron/builder 安装，未跑 audit fix。
- 已核对本地 app-builder-lib/scheme.json：v26 支持 `signExecutable:false` 与 `signAndEditExecutable:false`。保留两者，禁签名及资源编辑；dir / win x64 / asar:false / --publish never。未读签名凭据。
- 恢复时旧包 `desktop-release/win-unpacked`：88 文件、386,448,626 字节；exe 247,033,344 字节。这是旧产物，不是最终候选。
- 没有安装系统 SDK、编译器、驱动、额外 Node 或引擎/模型。后续桌面测试使用 Windows 已有 .NET Framework csc 编译临时外部 JSONL 引擎 adapter，避免 utility 的 Electron process.execPath 误作 Node。仅测试依赖此平台工具，产品用户不需要它，也没有 HTTP/renderer 测试配置入口。

## 已确认的测试 seam

真实打包 exe → 原生菜单/dialog 平台 I/O → 真实配置处理 → 上传/默认 N+1 扫描/逐手 UI → 原生关窗 → 操作系统自有进程效果。仅替换 dialog 返回与外部引擎 adapter；不 mock 业务、窗口生命周期或读取内部业务状态。隔离 userData。配置、程序目录移动、renderer 安全和进程所有权也从此 seam 观察。

## 新证据与 RED→GREEN

续接后逐纵切片记录如下；旧 1 条 smoke 不计为新 RED。实际命令日志、截图、OS 所有权/退出记录保存到 `D:/code/tmp/go-coach-notes/desktop/implementer-sol/` 的各独立运行子目录。

| 切片 | 新 RED / 修复 | 新验证 |
|---|---|---|
| 原生配置→真实扫描 | `01-config-red`：缺少原生选择菜单；实现菜单、64KiB有界UTF-8 JSON/绝对路径及存在性检查、默认取消确认、独立dataDir/字段白名单 | `03-config-green` 1 passed；`02` 曾因测试错误地 await MenuItem.click（Electron 返回void）过早还原dialog替身而失败，修正为等待原生I/O回应及实际页面重载，不计产品RED |
| 重启恢复 | `04-restore-red`：重启后未配置、0/5；增加引用+SHA-256摘要原子保存、每次恢复重新验证，变更/失效退回未配置菜单提示 | `05-restore-green` 2 passed；`06-config-negative` 7 passed：取消/确认拒绝、坏JSON/超限/相对/不存在/类型错误路径、有效更换清谱、摘要变更、原配置/模型/exe消失、恢复扫描 |
| 生产CSP | `07-csp-red`：真实exe返回无CSP；生产HTTP加严格脚本/连接/框架/对象策略，仅放开样式属性 | `08-csp-green` 1 passed；`11-security-negative` 2 passed：renderer无Node、实际内联脚本拦截、棋盘grid/走势样式、异origin导航/302重定向/新窗/iframe/权限/下载拒绝、HTTP来源/CSRF/静态白名单 |
| 包移动/不可写 | 沿用旧绝对静态根方案，本轮新增的是回归证据而非新RED | `14-moved-package` 1 passed：真实全目录移至中文空格路径、异cwd，ACL拒绝本测试用户写入（WD/AD）且实际writeFile失败后仍扫描成功；仅改自有临时复制目录，finally移除deny并删除。`12` SID语法及`13` generic W同时阻断read的测试夹具错误已保留，不算产品RED |
| 正常及故障回收 | 沿用已有KataGo幂等关闭/utility parentPort显式适配；无新增引擎策略 | `15-lifecycle` 4 passed：版本启动中、分析中、不配合EOF、坏协议；`17-bridge-fault-red` **实际是1 passed，不是RED**：OS只杀确认本次父链的utility，native adapter PID实际消失、正常关窗且fixture无幸存引擎。`16`仅为识别Playwright的cmd包装父链错误，未执行kill；此后使用确切所有权父链，不按端口/名字查杀 |
| 启动中退出 | `21-early-quit-red`：原生app.quit取消初始页面加载后仍弹“启动失败/ERR_FAILED”而阻塞退出；仅对已开始主动退出的分支抑制错误弹窗并防止再spawn | `22-startup-green` 2 passed：原生早退无错误弹窗；复制包删除桥入口后实际提前退出有中文错误且退出，不重启。`18`超时/`19`读取已disposed的app.process、`20`实测退出被弹窗阻塞的记录均保留；测试原生dialog输出捕获揭示真正RED后再修复，未mock生命周期 |

测试通过真实 `.exe` 加临时独立 C# JSONL adapter；其version只为走已存在的真实配置通道模拟，不是本机真实KataGo/GPU证据。手算合成 ba/aa/ab/pass 共5前缀、提子1，候选D16未被占用，BLACK 60%/2.5目/101visits来自固定外部输入；没有从业务实现重算预期。自有引擎I/O记录还核对桌面dataDir、复用home、logAllRequests/Responses=false，以及原operator记录仍true不被修改。

所有权文件记录Playwright自有cmd包装、实际Electron main、utility/renderer/gpu及引擎父链；测试正常退出检查后才允许清理。受控故障只操作已经确认的utility PID。fixture失败兜底只对独占临时exe路径/自有ChildProcess PID操作，不能把兜底kill计为成功。`18`外部命令超时后另行查询未发现本worktree/本次临时adapter进程残留，未触碰5173。

## 最终验证与失败保留

- `npm.cmd run test:desktop`：先真实 build/pack，再 **19 passed，0 failed，0 skipped，1.3分钟**（`25-final-desktop.log`）。包含原 smoke 1 条及新增18条；产品进程 PATH 只含 Windows/System32，不含外部 Node/npm/Vite。为验证不会静默启用宿主配置，测试给父进程的 GO_COACH_CONFIG/TEST_ENGINE 故意非空，而未批准 UI 仍未配置。
- `GO_COACH_TEST_PORT=5193; npm.cmd test -- --workers=4`：先确认5193空闲，`reuseExistingServer:false`，**原110 passed，0 failed，0 skipped，2.7分钟**（`26-web-110.log`）。没有修改13策略、棋规或旧110测试，没有停止用户5173。测试后5193无监听。
- 桌面命令内的 `tsc --noEmit`、Vite39模块及 esbuild 成功；tsconfig现在也覆盖新增桌面测试。交付前另行运行显式typecheck/build、三个desktop mjs的node --check、暂存diff --check，见 `29-final-checks.json` 与对应日志。
- 实际打开并查看 `25-final-desktop` 下 `scan-and-board.png` 与 `moved-package.png`：走势5点、逐手结果、明确未启用DeepSeek、浅木棋盘/19路线/九星/坐标及提子后的两黑子均可见，CSP未破坏样式。当前仍是纵向长页面，棋盘在下方，未做紧凑布局视觉验收。
- 已实际读取原生adapter I/O与退出记录：BLACK/预算/五个有序前缀无身份字段；版本与分析PID、自有Electron父链均有记录；正常、不合作、受控utility故障最终 `code:0, signal:null, survivors:[]`。正常退出没有靠fixture杀进程。

### 全量尝试23/24（不抹去失败）

- `23-final-desktop.log`：17 passed / 2 failed。一条是测试逐手循环已经到末尾后再次点击禁用“末尾”，删去重复操作、保留当前帧/提子断言；另一条为Playwright **Node宿主worker异常退出0xC0000409**，根因未确认，不能伪称产品RED或已修复其原生崩溃。
- 该worker在应用launch途中退出，遗留本次隔离userData `go-desktop-sol-QQBtdG` 的未配置窗口。另行核对实际exe绝对路径、父PID/创建记录和完整独占userData标识后，对该确切原生窗口发送WM_CLOSE，正常退出，没有kill或按端口/名字查杀。记录 `23-worker-crash-owned-recovery.json`。未影响其他实例。
- `24-final-desktop.log`：18 passed / 1 failed。仅观察用的测试父链遍历遇到Windows历史PPID复用（新renderer PID恰为旧系统父PID），把更早启动的系统进程错误计入“仍存活”。**没有对这些PID发送任何信号或关闭操作**。修复测试所有权：子进程创建时间须不早于已确认父进程，退出检查使用PID＋CreationDate身份，不把历史PPID或复用PID当本实例。故障注入也使用同一精确身份链。
- 25全量通过；原生worker崩溃仅在23观察到一次，保留为实验性Playwright/Electron组合的已知未解释风险，不能靠一次成功外推稳定性或跨机兼容。没有升级依赖、屏蔽/跳过测试或重试凑绿。

## 持久候选包

- 已复制完整目录到 **`D:/code/tmp/go-coach-desktop/candidate-14-sol/`**（新目录，没有覆盖旧候选），exe为该目录下 `Go Coach.exe`。worktree及手工分支均保留，不整合主分支、不push。
- **89文件，386,454,700字节（约368.6MiB）；exe 247,033,344字节**。asar:false / win x64 dir；未签名、未发布、未安装系统组件，无自动更新。
- `27b-candidate-manifest.json` 为所有文件逐一SHA-256/体积清单，并逐文件对照worktree产物全部相等。最初PowerShell Get-FileHash在此宿主不可用，`27-candidate-manifest.json` 的hash无效并保留，不能用它当校验成功；改用Node标准crypto生成27b，未装工具。
- 又从此**持久候选**、异cwd及不含外部Node的产品PATH真实启动未配置窗口，确认宿主GO_COACH_CONFIG/TEST_ENGINE不被读取，原生关窗退出0，全部确认自有进程已消失，未用强制回收。实际运行元数据：**Electron44.8.0 / Node24.22.0 / Chromium152.0.7977.167**（应用0.1.0）。见 `28-candidate-verification.json/log`、ownership和窗口截图；脚本 `verify-candidate.mjs` 留证据目录，不随包。
- 打包应用白名单只有 desktop运行mjs、.server/index.js、dist和package元数据；没有源TS、tests、.scratch、operator、模型或密钥。实际核验清单，不只凭配置推断。原运行时DLL/locale等保留在完整目录。

## 未覆盖及交付状态

- 交付的是任务14桌面宿主候选，**仍待主代理独立Spec/Standards审查、整合复测及最后真实GPU合成谱桌面验收**；没有修改任务done状态。
- 未人工测试真实Windows文件选择器、双击/SmartScreen；Playwright仅控制原生dialog返回。未跑真实GPU、私谱、DeepSeek或任何在线AI/费用/Key流程。
- 动态测试了初始页面加载中退出、引擎版本启动中/分析中退出及utility受控SIGKILL后本机后代回收。未强制拖住桥module import来覆盖每个启动时隙，15秒握手超时/关闭回收失败分支、主进程硬杀、系统关机/断电未动态验证，不承诺所有灾难场景无孤儿。
- 没有全页面紧凑布局、签名安装器、发布、自动更新、全Windows机器兼容或整体中文教练完成声明。原生worker一次异常仍需主代理复核/观察。

## 三项 P2 审查修复候选（2026-10-18 本地时间，待独立复审）

Execution 仍为 **in-progress**。本节补充而不替换上面的历史证据和限制。

### 基线与修改范围

- 继续只在原 worktree / `implement/windows-desktop-sol` 修改，未新建 isolation、调度子代理、修改主工作区、push 或标 done。先读主工作流，再从 `3c54fe9` 快进至主代理边界文档 `89d6d66`；提交前又快进至 `56770d8`，完整保留主代理新增的 `14-main-acceptance.md`。
- 完整重读最新14-design、原实施记录、desktop三个mjs、所有桌面测试/fixture、任务/领域说明/GLOSSARY和主路径 TDD 三文件。没有相关 ADR 目录。
- 仅修复 a46588d1 / 1dba441e 已确认的首屏选择竞争、Windows路径确定性、关闭确认三个 P2；未改 server/棋规/复盘/网页110测试或 package/lock，不升级依赖，不安装系统组件。
- `main.mjs` 每次 start 在整个 loadURL 期间保持 starting；菜单 disabled，choose 也守卫，finally 统一恢复。已开始 stop 的旧导航/地址握手不再成为另一次启动失败/退出；选择中同样防重入。
- `config.mjs` 对 operator 本身和 executable/model/dataDir/homeDataDir 统一要求完整盘符根路径或完整普通 UNC，拒绝根相对、盘符相对及不完整 UNC；先以 Windows 规则规范化，再 stat、确认展示、保存引用或生成运行 snapshot。保留 `D:/...` 写法，不依当前盘符解释。
- bootstrap 仅在真实 `await bridge.close()` 成功后发送 `closed` 再退出0；失败发送有实际原因的 `close-error`。main 观察 Promise 只 resolve 事件，不提前制造无人接收的 reject；仅 closed + exit0 算正常关闭，异常退出/缺确认/明确关闭失败/10秒超时分类可见。主动 stop 的后续 exit 不再重复弹框。
- 失败默认“保留窗口”（defaultId/cancelId=0），不能确认引擎回收的警告明确保留；用户明确选择“退出应用（引擎回收未确认）”才 `app.exit(1)`，不当作正常回收。失败状态不偷偷重启，不遍历或 kill 其他 PID，也不陷入无法退出的循环。

### 本次测试 seam 与真实 RED→GREEN

所有证据新增于 **`D:/code/tmp/go-coach-notes/desktop/review-fix/`**，未覆盖旧目录。仍从真实打包 exe、原生菜单/dialog、实际页面和操作系统效果观察，不读取私有业务状态，不 mock 产品函数或添加 window 业务侧通道。

- 首屏用外部 HTTP forward proxy 拖住**第一次文档响应**，同时核对 `forwarded:false` 和原生 `webContents.isLoadingMainFrame():true`。随后直接调用原生菜单动作，即便 disabled 也验证 choose 自身守卫；放行后再真实选择配置并完成扫描。
- 关闭故障由外部合成引擎 adapter 的 stdin EOF 记录确认“回收已开始”，再操作已由 PID + CreationDate + 父链确认的 utility。既有 csc 编译的独立 OS adapter 还逐次复核启动毫秒/执行路径，只对该 utility 做 suspend/resume 或 exit0；未操作非自有进程。
- 明确 close 失败通过外部平台 adapter entry 继续导入**未修改的真实 bootstrap**，仅在 Node 的公开 `ChildProcess.kill` OS 信号 seam 为确切自有引擎子进程返回拒绝。真实6秒回收期限失败、bootstrap消息和主端处理都执行。原生 utility fork I/O 只为加载此外部 adapter；ESM原生导出通过 Node VM默认loader取得（实验性警告保留），没有导入或替换私有业务模块/函数。适配器不进入产品包，也未向 renderer/HTTP 加测试配置。

| 切片 | 实际 RED | GREEN |
|---|---|---|
| 首次文档仍 pending 时选择 | `03-starting-red`：held=true、forwarded=false、loading=true；旧菜单 enabled=true，实际打开chooser一次 | `05-starting-green` 2 passed；菜单false/chooser0，就绪后真实配置与扫描成功；最终29全量保留 |
| Windows确定路径 | `06-paths-red` 5 failed：operator及四字段的真实根相对路径都被错误接受并出现信任确认 | `08-paths-green` 5 passed；另测盘符相对，拒绝后保留旧origin、完整扫描和已定位的棋谱，原有效配置仍可扫描 |
| 回收中非零 utility exit | `09-shutdown-exit-red`：EOF已记录、身份核实后受控OS故障；旧程序直接退出0而没有保留窗口警告 | `10-shutdown-exit-green` 1 passed，默认保留、明确非零退出；最终全量再覆盖 |
| 明确close失败分类 | `16-close-error-red-old-candidate`：只读启动旧 `candidate-14-sol`，OS拒绝实际有记录，真实桥报6秒close失败，但旧main忽略消息直到10秒笼统错误 | `17-close-error-green` 2 passed；实际原因立即通过原生警告呈现，而非超时。此额外分支测试是在09修复代码之后补写，RED来自未修改的旧候选，不冒称该分支先于实现编写 |
| 超时后不得重复弹框 | `18-timeout-red`：实际暂停已确认utility，10秒警告后恢复；观察到同一次关闭自动弹框两次 | 加入 stopRequested 去重后 `19-lifecycle-green` 12 passed；最终全量仍验证只有一次，且可明确退出1 |
| exit0仍须closed确认 | `20-no-ack-red-old-candidate`：外部OS以0终止EOF阶段utility，旧程序将缺确认误作正常退出 | 最终29全量中 zero-without-ack 通过：明确“缺少关闭确认”、保留窗口，只有确认后退出1 |

本轮新增10条，原19条均保留。原有“utility崩溃”和“破损桥启动”两条异常测试的退出期待按修订规格从错误的正常0退出加强为默认保留/明确1退出；其错误可见、回收观察与不无限重启检查不删除。正常关闭、取消/恢复/更换、生产安全和移动只读目录语义不变。

### 失败/夹具问题原样保留

- `01` 初版夹具在等待 firstWindow 时文档尚被自身proxy阻塞，未形成有效RED；`02` 已捕获正确RED但过早关闭proxy导致teardown超时。改为先释放并完成文档、再断言的 `03` 是干净RED。另行查询没有遗留本次进程。
- `04` pack成功，测试命令中的正则 `|` 被 Windows cmd误作管道；改用现有Node执行Playwright CLI，`05`通过，不算产品问题。
- `07`：7 passed / 5 failed，新增路径测试误以为自动扫描会把回放位置移到末尾，实际仍在第0手。测试先通过真实“末尾”按钮定位后再验证保留；没有为此改产品，`08`通过。
- `11`–`15` 为平台故障夹具探针（Playwright去掉NODE_OPTIONS、utility的require预加载未生效、CJS/ESM原生对象差异、inspector evaluate无默认动态import callback等），未实际拒绝kill，**不计产品RED**。`16`开始实际OS拒绝、真实close失败及错误分类都已留证。
- `24` 独占创建目标目录后，Node cp(errorOnExist)拒绝复制到已存在根目录；未生成完整包。`24b`改为逐入口独占复制，另取时间戳新目录成功；仅删除24自行创建且复核为空的目录，不动旧候选。
- 前次 Playwright宿主 `0xC0000409` 仍是**根因未知的历史风险**，本次没有复现不能证明已解决或稳定；不以 skip/retry 凑绿。本次全量21只执行一次，29条全部通过。

### 最终验证与新完整包

- `npm.cmd run test:desktop`：真实build/pack后 **29 passed，0 failed，0 skipped，2.4分钟**，`21-full-desktop.log`。配置/扫描/棋盘/CSP/renderer安全/异cwd/中文空格只读目录/正常和异常退出全覆盖上述 seam。
- 先确认自有5193空闲，再 `GO_COACH_TEST_PORT=5193; npm.cmd test -- --workers=4`：**110 passed，0 failed，0 skipped，2.7分钟**，`22-web-110.log`；before/after均无5193监听。没有停止或操作用户5173。
- 独立 `npm.cmd run typecheck`、`npm.cmd run build` 成功（`23-typecheck.log` / `23-build.log`）；desktop三个mjs及外部平台adapter的 `node --check`、`git diff --check` 通过。package/lock/server没有本轮diff。
- 新完整包为 **`D:/code/tmp/go-coach-desktop/candidate-14-review-fix-2026-10-17T17-14-12-354Z/`**；实际exe是其中 `Go Coach.exe`。**89文件，386,456,712字节（约368.6MiB），exe 247,033,344字节**，未签名/未发布/asar:false。
- `24-candidate-manifest.json` 逐文件SHA-256确认新包与本轮真实测试产物完全相同，并核对18个应用资源与当前源码/构建输出；资源仍仅3个desktop mjs、.server、dist、package元数据，没有测试adapter、operator、模型、.scratch或密钥。
- 直接从这个**持久新候选**、独立userData/异cwd/无外部Node产品PATH再次运行配置→5局面扫描→逐手/棋盘→原生关闭：**1 passed**（`25-persistent-candidate.log`），正常退出0且无强制清理。此为工件核验，不是失败重试。
- 已实际查看25下 `scan-and-board.png` 和21下 `timeout-preserved.png`；正常5点走势/浅木棋盘/提子1与DeepSeek未启用可见，异常时窗口及棋谱仍保留。原生警告只控制dialog返回并保存实际options，截图不是人工系统dialog体验的证明。
- `27-audit.json` 汇总全量28份fixture退出记录：26次正常应用退出0、5次明确异常退出1，全部 `survivors:[]`；直接启动的smoke/early-quit/破损包另由对应测试检查。正常流程不依赖fixture kill。异常adapter的release/OS故障及退出1不冒充正常回收保证。
- `26-live-cleanup.json` 最后按本worktree/独占测试exe/新旧候选精确路径查询，没有相关应用/utility/引擎存活、5193无监听；此次查询不发送信号。`27-audit.json`另逐一复核旧 `candidate-14-sol` **89文件SHA-256/字节全部未变**。

### 仍未覆盖 / 主代理下一步

- 仍待主代理两轴独立复审、整合后独立复跑及真实KataGo/GPU桌面验收；本代理没有跑GPU，也不更改任务完成状态。
- 本轮明确close失败/10秒超时已通过外部OS/引擎adapter动态验证，但不等于真实GPU驱动拒绝回收、主进程硬杀、OS关机/断电等灾难场景保证。UNC支持未挂载真实共享作跨机器验证。
- 仍未人工操作系统文件选择器、双击/SmartScreen或做跨机兼容/紧凑桌面布局验收。未接入DeepSeek、读取Key、外发棋谱或付费；生产配置仍独立dataDir且禁recordSyntheticEvidence。旧网页Node IPC入口未改并通过110回归。

## 第四项 P2：首窗前启动失败默认保留（2026-10-18，待主代理复审）

Execution 仍为 **in-progress**，仅修复 standards73307c1a 指出的无窗口存活问题，不重做前三项修复。

- 原 worktree / `implement/windows-desktop-sol`，基线0117b65；提交前已 fast-forward 合入主64a9bcb，保留主代理14-main-acceptance更新。未调度子代理、整合主工作区、安装依赖、GPU测试、push或发布。
- quit失败且尚无窗口时，复用原createWindow安全设置和导航/重定向/新窗/权限/下载拒绝处理；先加载主进程固定中文纯静态data页面，encodeURIComponent编码、meta CSP `default-src 'none'`，不拼接异常/路径、不加renderer接口、不修改正常origin或生产CSP。捕获首次无窗状态，原生warning仍显示“启动失败，退出未完成”和实际异常；保留后文件→退出/关窗仍能再次选择，明确退出为1，不算安全回收。
- 新测试仍在已批准的真实exe/原生dialog菜单/窗口/OS seam：复制实际完整包删除.server/index.js，首次dialog返回0，核对可见静态内容、CSP实际拦截脚本、Node禁用/隔离/sandbox/webSecurity、外部导航/新窗拒绝、原生退出菜单和无存活Node utility；再从文件→退出返回1，核对退出1及已确认PID+CreationDate全消失。未mock内部业务。首次留窗到第二次退出期间未重启服务。

证据独立目录：`D:/code/tmp/go-coach-notes/desktop/startup-retain-p2/`；历史候选/证据保留。

- **真实RED**：`02-red.log`，build/真实打包成功后1 failed，首次warning默认保留，5秒内无任何可见窗口（expected true / received false）。仅此是本P2产品RED；测试写于产品改动前。
- `01-red.log`为测试TypeScript缺失Electron原生getLastWebPreferences类型声明，未执行测试，不算RED；仅此原生观察处做类型断言。
- `03-green.log`为原生取消导航后Playwright仍等待pending navigation的夹具问题；按原security测试先断言URL不变再reload清除记账。`04-green.log`把Chromium network utility误当桥；收窄到Node utility subtype，不忽略真实桥进程。两次失败均保留，不是产品修复或重试凑绿。
- `05-full.log`：`npm.cmd run test:desktop`真实build/pack后 **30 passed，0 failed，0 skipped，2.2分钟**（原29+新增1）。命令用cmd重定向，未把esbuild正常stderr误作PowerShell异常。
- `06-web.log`：先确认自有5193空闲，再`GO_COACH_TEST_PORT=5193 npm.cmd test -- --workers=4`，**110 passed，0 failed，0 skipped，2.6分钟**，退出后5193无监听。未停止/操作5173。
- `07-typecheck.log` / `07-build.log`：显式typecheck/build成功；node --check desktop/main.mjs、git diff --check成功。没有package/lock/server/网页测试改动。
- 新完整持久包：**`D:/code/tmp/go-coach-desktop/candidate-14-startup-retain-2026-10-18T05-24-29-523Z/Go Coach.exe`**。89文件，**386,457,203字节**（exe247,033,344字节）。`08-manifest.json`逐文件SHA-256及字节相等核对真实测试产物；仅目录免安装包，未签名/未发布。
- `09-persistent.log`直接以新持久包作破损复制来源复验新增流程：**1 passed**，退出1、自有PID全部消失；已实际查看retained-startup-error.png，固定中文标题/说明可见。dialog返回替换不证明人工系统对话框体验，截图是静态页面而非系统warning。
- `10-live-cleanup.json`按本worktree/独占测试exe/候选路径查询没有相关桌面/utility/引擎存活，5193无监听；未发送进程信号。新增用例成功路径不依赖fixture强制清理。

仍待主代理独立复审、整合复跑及新包真实GPU验收。主代理此前对旧持久候选的GPU结果只保留于其验收文档，不冒充本包验证。此改动不扩展为OS关机/断电/主进程硬杀保证，也不覆盖人工双击/SmartScreen/原生文件选择器或跨机兼容；历史Playwright worker原生异常风险仍未解释。没有标done。
