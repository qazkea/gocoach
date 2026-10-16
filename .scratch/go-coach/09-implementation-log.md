# 09：网页纵向实施记录（待独立验收）

## 基线与职责

隔离工作区：`C:/Users/789/AppData/Local/Temp/pi-agent-1cc03bfc-346e-427-397c2e86`。
开始HEAD为 `11a8b057d314884e62e98991586865e85fcb5f23`，祖先检查通过，干净；新建 `implement/09-local-engine`。
已读取任务全部评论、09-design/探针/研究/父spec/术语及项目工作流、既有回放/变化/教学和浏览器测试。
仅实现代理工作；未调度代理、未push、未改任务状态/checkbox、父spec、09-design或其他任务。
最终验证前实际 `git merge integration/go-coach`：Already up to date（最新tip仍11a8b057）。

## 实施范围

- `server/index.ts`：127.0.0.1单HTTP，开发Vite middleware/同源HMR、生产dist；Host/Origin、JSON/CSRF、64KiB流式限制；无HTTP路径/action/shell接口。
- `server/position.ts`：严格输入白名单、KM/HA/setup条件，安全最小SGF复用importReplay重建完整历史；官方显式近似profile、SGF↔GTP；真实规则检查全部候选/PV，任一坏项整次拒绝，未知循环保留不支持。
- `server/katago.ts`：本地操作员配置、实际version核对、懒启动JSONL进程、固定预算/BLACK、600s启动与30s查询；ID/进程代次/轮次/完整上下文绑定；4个未收尾身份含取消墓碑/确认；warning后收尾、严格terminate确认、超时回收与自有PID关闭。
- `src/engine.ts` / `src/EnginePanel.tsx`：独立入口、必要输入、完整前缀，复用variation的双方/pass/撤回/重走/未来截断；立即盘面更新、清旧估值、切步/文件/关闭取消；候选/PV/条件/局限明确。
- main隐私文案、README、esbuild Node ESM构建、tsc覆盖server、开发依赖锁；没有修改回放或教学的既有业务实现。
- 测试只在已确认浏览器seam，经真实HTTP/adapter/规则，外部KataGo替换为独立脚本进程。每测试独立Node/端口/观测文件；不mock HTTP业务结果或新增内部unit seam。

## 实际 RED → GREEN 与首跑GREEN

以下失败都实际运行过，不是事后推断：

|切片|RED事实|GREEN修正/证据|
|---|---|---|
|非示例纵向入口|按钮不存在，浏览器30秒timeout|真实HTTP→进程→条件/估值界面，单条通过|
|官方profile及历史出口|字段误为koRule等、Japanese friendlyPassOk=false、缺顶层bonus|按v1.18.1官方GTP文档改ko/scoring/tax/suicide、friendlyPassOk=true及显式bonus，两条通过|
|重复候选|重复D16被当2项成功|整次拒绝重复落点，三条通过|
|同源静态安全|Vite默认暴露server/任务文档等路径|只允许浏览器模块/Vite依赖/公开示例资源；HTTP拒绝与未发进程检查通过|
|warning迟到final|warning后删除请求，旧final使新重试变JSON协议失败|warning保留取消墓碑直至final；定向通过|
|取消未收尾超时|四取消墓碑永久busy；真实等待31秒后仍无法重试|取消保留30秒查询deadline、超时回收重启；约32秒定向通过|
|错误终止确认身份|任意action=terminate被忽略，5秒内仍等待|只接受自己生成且target匹配的确认，错误身份明确失败|
|缺失终止确认|已收到被取消final但确认记录可无限增长|未确认身份也计入4上限，确认30秒期限与清理；定向通过|
|旧58语义回归|首轮全套84中82过、2失败：Vite客户端另连24678|HMR挂同一个HTTP监听，严格upgrade来源；两条原测试不改断言即通过|
|真实网页日志|网页完成但新增引擎日志存在性检查ENOENT|配置logDir；之后发现CDP流式body不可读，改真实浏览器请求出口+显式合成原始引擎日志，最终14次完整通过|

首个纵向切片同时包含其必需的输入/协议/规则防护；后续以下测试**首次运行即GREEN**，仅作新增回归证据，不伪写为各自RED驱动：双方分支/撤回重走/pass、KM/HA/白轮条件、普通warning/无结果/缺PV/非法PV/坐标/数值/轮次/ID/响应及候选上限、加载/迟到成功失败/标签页隔离、崩溃重试、同盘不同历史及长循环、等待立即清旧结果/关面板/换步/换文件。
受控fixture收尾还核对所有自己启动的外部脚本PID已消失。

一次PowerShell通过npm.cmd传含`|`的grep参数，被cmd解释为管道而退出，未执行测试；随后直接运行完整engine.spec通过。一次整理日志的PowerShell表达式语法失败，改用read读取并解析；均非产品RED。
未缺驱动/运行库，未发生需要越权安装的环境阻塞。

## 最终实际验证

- `npm.cmd ci`：成功；`npm.cmd install -D esbuild`：成功（已有传递依赖提升为显式dev依赖，未安装引擎/运行库）。
- `git merge integration/go-coach`：Already up to date。
- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过，Vite浏览器dist + esbuild Node ESM。
- `npx.cmd playwright test tests/engine.spec.ts --workers=4`：**28通过**（含真实30秒超时路径）。
- `npx.cmd playwright test --workers=4`：最终 **86通过 / 0失败 / 0跳过**，约2.1分钟；原58条文件未改语义/断言。
- `git diff --check`：通过（提交前再次检查含新增文件）。
- 真实浏览器：`GO_COACH_CONFIG=.../web/synthetic-evidence.local.json`、`GO_COACH_EVIDENCE=.../web/acceptance-4`，`node tests/real-engine-browser.mjs`：**14次真实分析与证据检查通过，服务退出0**。
  原局/分支各重复两次、两规则、白轮固定BLACK、HA2/HA0、双方试下撤回、同盘不同劫历史；见[真实网页记录](09-browser-acceptance.md)。
  原始日志/截图仅本机runtime；最终engine26932/server37012均已检查不存在。

## 限制与待主代理验收

- 未实等600秒触发启动超时；未专门让不合作进程拖过3秒强杀期限。启动等待/实际启动成功、查询30秒超时、正常EOF退出、崩溃重启已有覆盖。
- 小样例与缓存热重复不证明整盘性能、跨硬件稳定性或最强手；候选/PV不生成自然语言棋理、教学精选或练习。
- 不是完整国家规则/野狐认证、不是用户真实棋谱兼容验收；不做聊天、练习、跨盘学习记录或在线AI。
- 没有替代主代理的独立Spec/Standards审查、整合复测与票状态更新。用户的授权资产未改变，未外发棋谱、付费、push或发布。

## 独立审查后资源与 PV 修正（仍待验收，EPIPE 验证阻塞）

- 隔离 worktree `C:/Users/789/AppData/Local/Temp/pi-agent-1de03024-2367-4cf-f4503212`，分支 `implement/09-resource-fix`；基线 `fea729c`，结束验证前实际 merge `integration/go-coach` 到 `a25226c`。未调度、push、改票状态或父 spec。主代理的 PV 规格澄清经 merge 取得。
- 所有致命 `fail`（含 stdin error、spawn error、启动/查询/确认超时）统一失效代次并取得同一个回收 Promise；旧 child 不提前清空。重试必须先等待回收；close 等待同一 Promise。stdin EOF 后3秒仅向自己 child 发 SIGKILL，6秒仍无 exit 则显式失败、保留 child 以供后续回收，不允许覆盖。无 PID/已经 exit 或 signalCode 的进程不等待未来 exit。
- fixture 从 mkdtemp/fork/startup/use 开始由 finally 保护；共享测试 helper 区分无 PID、已退出、IPC 已断和存活，4秒强制关闭、8秒报失败；send callback/同步异常不绕过清理。tempdir 在最外 finally 删除；真实浏览器脚本也使用该 helper 并核对自有引擎 PID。

### 实际失败与通过，不混淆证据

1. **EPIPE 仍未证实**：先添加浏览器场景，外部脚本第一请求后保持 interval 存活，关闭读取端并返回 noResults；网页再请求期望“引擎输入已关闭”。在本机 Node 24/Windows 依次实际尝试 `stdin.destroy()`、`closeSync(0)`、`stdin._handle.close()`，并增加多次网页重试。均仍显示查询等待，没有真实管道错误。这些是失败的故障注入尝试，**不是产品 EPIPE RED**。Windows 场景明确 skip；非 Windows 分支也未运行验证。未把 crash、stderr 或 EOF 等同 EPIPE，未直接调用 KataGo 类或 mock HTTP。
2. 独立的不合作外部进程经真实 stderr 报 fatal，后续网页立即重试：500ms 时旧 PID 仍活、观测 PID 列表仍仅一项、不能显示成功；3秒后旧 PID 消失，新代次完成。另一个浏览器场景在回收过程中结束，由 fixture 请求服务关闭并检查所有自有 PID。两条通过；属于补充覆盖，**不是先前 EPIPE 的 GREEN**。首次 stderr 场景脚本还提前回了成功，修正外部场景后通过，不当作产品 RED。
3. **fixture RED→GREEN**：先在原 fixture 上运行 `node tests/fixture-resource-check.mjs timeout`，20秒未监听，外层发现 `tempExists:true`（PID 53256 已由测试 worker 环境收尾）；外层断言失败并清理该次目录。修复后 timeout / exit / disconnect / nofork / spawn-error 五种平台检查全部外层退出0、`alive:false,tempExists:false`。每次嵌套 Playwright 的1条失败是有意启动故障，不是正常业务套件失败，也不宣称嵌套套件通过。注入只重定向测试 fork 的外部可执行文件，未改生产 HTTP。
4. **PV RED→GREEN**：空19路黑先经外部脚本返回合法16着，实际浏览器 RED 为“PV 无效或超限”；将数组上限改为16、UI/README说明首着＋15后续后 GREEN。原 longPV 场景改为合法17着并明确断言 PV 超限。保留 cfg `analysisPVLen=15` 和其他预算。
   独立手算序列：`D16,Q4,D4,Q16,K10,L10,K11,L11,K12,L12,K13,L13,K14,L14,K15,L15`，17着追加 `K16`；全部不同交叉点，K/L 两列同色链各有外侧气，不靠重复占点伪测长度。来源由主代理核对：`https://raw.githubusercontent.com/lightvector/KataGo/v1.18.1/docs/Analysis_Engine.md`（analysisPVLen 不含首着）；`https://raw.githubusercontent.com/lightvector/KataGo/v1.18.1/cpp/search/searchresults.cpp`（getAnalysisDataOfSingleChild 先 push move，再 appendPV；getAnalysisJson 输出整条）。

### 最终验证及环境记录

- 未下载依赖：复用已安装 node_modules 的本机复制。首次尝试目录 junction 时 Vite 模块路径导致网页不可用，改为本地复制后正常；那次 setInputFiles 超时不是产品 RED。
- merge 后 `npm.cmd run typecheck`、`npm.cmd run build`、`git diff --check` 通过。
- merge 后完整 `npx.cmd playwright test --workers=4`：**89通过 / 0失败 / 1跳过**（90条，约2.1分钟）。保留既有86语义；新增合法16着、不合作重试、回收中服务退出3条通过；真实 EPIPE 1条因上述平台阻塞跳过。
- 已授权真实 KataGo：使用新的 `web/review-fix/implementer.local.json` 和 `implementer-data`，原 probe/acceptance-4 不覆盖。两次 `node tests/real-engine-browser.mjs` 各14次真实浏览器分析通过；最终证据 `D:/code/tmp/go-coach-runtime/katago-1.18.1-opencl/web/review-fix/implementer-browser-final`。最终原局首次2.932秒、重复0.178秒；分支首次0.884秒、重复0.130秒，其余10次0.128–0.908秒。小样本不作性能保证。
- 最终 `exit.json`：server50148、engine39296，code0、success:true、remaining:[]；首次复跑server10584/engine31404也已退出。旧故障尝试及正常套件均由自己的 fixture 收尾，只处理本次生成/记录的PID。最后一次组合 PowerShell 命令因随后 `Get-Process` 查已不存在的旧PID返回1，真实浏览器本身的 exit.json 明确成功；不把该查询退出码冒充引擎失败。
- **未完成**：本机真实 EPIPE 的浏览器端复现与修复前后证据，及主代理独立双轴复审/整合复测。未自标 done。未安装引擎、模型、驱动或运行库，未外发、付费或发布。

## Windows 真实 stdin EPIPE 回归补齐

- 分支 `implement/09-windows-epipe`，隔离 worktree `C:/Users/789/AppData/Local/Temp/pi-agent-a277a77a-c34a-4ca-4323881d`，基线 `42c5205`；最终两次 `git merge integration/go-coach` 均 Already up to date。未重做生命周期修复、未改任务状态。
- 新外部 adapter `tests/windows-broken-input.cs` 使用现有 .NET Framework 4 编译器及 `System.Web.Extensions.dll`，每次编译到 fixture 的独立 tempdir；不提交 exe、不安装或下载依赖。仅 P/Invoke 获取/读取/关闭自己 `STD_INPUT_HANDLE=-10`。首代读合成 JSONL 后关闭真实输入句柄、记录 held-open、返回 noResults，并无限等待；第二代经同一 JSONL 出口返回空盘合法 D16/pass 候选。没有 stderr fatal、crash、伪造 error 事件或其他进程句柄操作。
- 操作员 `GO_COACH_TEST_ENGINE` 仅允许 Node `.js/.mjs/.cjs` 脚本或本地 `.exe`，仍为 spawn 参数数组、shell:false；HTTP 无法选择路径。生产配置/版本/同源/CSRF 未变。非 Windows 保留原 Node adapter，本次没有跨平台运行证据。

### 平台 CLI 与实际浏览器 RED → GREEN

1. 先运行 `node tests/windows-input-probe.mjs`：真实 `code:EPIPE, message:"write EPIPE", pid:42812, alive:true`；收尾等待 child exit，删除 tempdir。此时尚未修改产品测试启动选择。最终复跑相同命令：PID 476，同样 `EPIPE / write EPIPE / alive:true`，收尾通过。CLI 仅验证外部注入，不代替浏览器。
2. 临时将 `server/katago.ts` 生命周期恢复 `a25226c`，保留新 adapter/fixture 和操作员 exe 选择；`git diff a25226c -- server/katago.ts` 实际确认唯一差异为测试启动选择。构建旧服务后运行真实浏览器测试：上传合成空盘→noResults→重试→“引擎输入已关闭”→立即重试，500ms 旧 PID 52364 仍活（该断言通过），但 PID 列表已经 `[52364,47372]`，应仅 `[52364]` 的断言失败。首次同样 RED 是 `[48976,43548]`。不是超时/编译/依赖故障冒充产品 RED。
3. 恢复 `42c5205` 生命周期（最终 diff 仅测试启动选择）并重新构建；同浏览器回归 GREEN。500ms 旧 PID 活且仅旧代次；至少等待2秒以上才完成，旧 PID 已退出，第二 PID 不同且仍活，页面显示分析完成。新增 broken-input shutdown 场景，在断管回收期关闭服务，fixture 核对全部自有 PID 退出。Windows 不再 skip。
4. fixture 的失败收尾同样检查并等待自有 PID 消失，必要时只杀它记录的自有 PID，再报告原资源泄漏。两次 RED 后分别查询上述四个 PID 均不存在；没有遗留旧引擎。所有 fixture tempdir 均走 finally 删除，编译 exe 同时移除。

### 最终验证与限制

- 复用本机已安装 node_modules 的副本，没有新增安装。首次默认 Playwright 入口因其他会话占用5173而未执行测试；未停止其他会话，改用临时 `playwright.engine.local.ts`：`defineConfig({testDir:'./tests',fullyParallel:true,reporter:'list'})`，不用全局 webServer，每条 engine fixture 仍启动真实独立 HTTP 服务/随机端口。临时 config 验证后删除。
- `node node_modules/@playwright/test/cli.js test tests/engine.spec.ts --config=playwright.engine.local.ts --workers=1 --grep 真实输入管道`：上述产品 RED；恢复后定向 GREEN。
- 首次 typecheck 因新 mjs 缺声明失败；添加 `windows-input-probe.d.mts` 后最终 `npm.cmd run typecheck`、`npm.cmd run build` 均通过。
- 最终 `node tests/windows-input-probe.mjs` 通过；`node node_modules/@playwright/test/cli.js test tests/engine.spec.ts --config=playwright.engine.local.ts --workers=4`：**33通过 / 0失败 / 0跳过**，43.5秒，含真实30秒期限、断管重试、断管中服务关闭、原 stderr/crash 独立场景。
- `git diff --check` 通过。仅引擎相关浏览器套件；未重复全站旧58条或14次真实 GPU 查询（由主代理独立执行），未代替独立复审。此处解决前段日志记载的 Windows EPIPE 注入阻塞；不据此关闭09票。

### 接续主代理追加的两项收尾修复

主代理在本次工作期间授权纳入独立复审的两项 P2，沿同一外部进程/平台 I/O seam；以下为追加验证，最终结果取本节。

- `server/katago.ts`：配置 readFile await 后、execFile(version) 前复核 generation/closing；version child 与 analysis child 串行占用同一自有 child 槽，close/fail 使用已有共享有界回收，等待真实 exit；版本查询结束后也复核代次，不能继续启动 analysis。没有放宽生产版本校验或改已有3秒/6秒回收期限。
- `slow-version` 浏览器测试经真实页面触发生产 `GO_COACH_CONFIG` 路径，只把配置指向本次 tempdir 编译的外部 exe；它接到 `version` 参数后记录 PID 并保持活着，不输出假的 KataGo 版本。初始仅检查 PID 的测试在原实现下首跑通过，因为本机 Windows 的子进程联动退出掩盖了 fixture 对 server 的4秒强杀。加上服务必须无 SIGKILL 正常退出的断言后，原实现实际 RED：`Received: "SIGKILL"`；不是把首次通过当 RED。纳入 version 所有权后同例 GREEN（3.9秒），fixture 检查 version PID 消失且 server 正常退出。配置 readFile 的晚恢复竞态没有用 mock/readFile 内部 seam 强行注入，修复后的代次检查由源码审查核验。
- `tests/fixture-resource-check.mjs`：child/recordFile 在 finally 可达，异常/超时后独立重读记录；先有界等待自己启动的外层子进程退出，再回收记录的自有 fixture PID 与目录，最后删除记录目录。spawn 无 PID 的 error 也完成等待；如果 OS 拒绝回收，报错并保留记录目录，不提前丢失回收入口。
- 新 `tests/fixture-deadline-check.mjs` 是外层独立观察器。先确认记录已写且 fixture PID 活着，再让被测脚本在该状态下缩短 deadline；独立检查 outer/fixture 两个 PID 和 fixture/record 两层目录。旧逻辑实际 RED：`code:1,outerAlive:false,fixtureAlive:false,fixtureDir:true,recordDir:false`，观察器 finally 删除本次残留目录。修复后同命令 GREEN：`code:0,outerAlive:false,fixtureAlive:false,fixtureDir:false,recordDir:false`；无全局进程扫描或 kill。
- `node tests/fixture-resource-check.mjs <mode>` 的 timeout / exit / disconnect / nofork / spawn-error 五种均外层退出0，`alive:false,tempExists:false`。内层每次1条 Playwright 故意失败是注入事实，不冒充正常套件通过。记录 PID 45668/51444/49068 均消失，nofork/spawn-error 为 pid:null。
- 追加修复后再次 merge integration（当时 Already up to date），随后主代理提交验收文档 `4d76776`；提交前已实际 fast-forward merge 到该最新基线（仅新增主代理验收记录），并在 merge 后再次验证。`npm.cmd run typecheck`、`npm.cmd run build` 通过；CLI EPIPE 复跑 PID40760 仍活时报 `write EPIPE`，随后 exit/目录清理通过；deadline 独立观察器复跑通过。
- 最终引擎浏览器命令同上：**34通过 / 0失败 / 0跳过**，44.9秒。包含断管重试、断管关闭、迟缓 version 关闭及既有引擎回归。diffcheck 曾提示日志末尾空行，整理后再次通过。未追加真实 GPU 运行或全站旧58条；待主代理定向复审和整合复测。
