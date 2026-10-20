# 15：本地服务端讲解依据实施记录

Execution: done（主代理后续验收43d955b，见15-main-acceptance.md；下文保留实施阶段的待审历史记录）

基线：`c3b228dd3fd041cae8e432f260c7c3c9d63e9421`。隔离实现树：`C:/Users/789/AppData/Local/Temp/pi-agent-f88dedf5-bf81-476-e3d0bda0`。本记录不代表独立审查或主代理验收完成。

## 已实现

- `server/evidence.ts`：仅合法最终分析且当前引擎 session 有效时签发每次独立的 32-byte 随机引用。保留规范化完整初盘/初始方/有序历史（含 pass）/RU/KM/HA（缺失区别于0）、session、模型/profile/补偿与固定预算版本、root、前10候选和原总数。序列化内容存储，不保存 Replay 多帧。
- 生产上限 2000 条 / 64MiB UTF-8 payload，LRU；签发后单调时间2h、不随读取续期。失效 session 在读取/签发时清理，关闭时 clear。字节上限不是进程 RSS 上限。
- KataGo 仅新增只读 session 有效性检查，既有取消/墓碑/版本进程/reaper 没有改动。底层 EngineResult 不变，HTTP 与浏览器传输使用 AnalyzedResult。
- `POST /api/review-evidence`：严格同源 Host/Origin/CSRF/JSON/64KiB/no-store/字段白名单；校验请求期望的完整合法局面与前后精确前缀/条件。未知/过期/死亡/旧服务引用410，不匹配400，安全403。不读取客户端 root/PV，不自动取证，不联在线服务。
- `ReviewEvidence.tsx`：整局区域按需查询，初盘无前手；服务复算实际落子/pass、提子坐标和新己链气，前后候选所属方明确；BLACK估值、实际执棋方signed下降、预算及限制明确。切手/换谱/已知会话结果变化/扫描失败清旧请求生命周期，Abort+迟到隔离。保留原布局与棋盘。
- 新浏览器模块加入精确开发白名单。原自动扫描请求白名单测试未放宽，也没有自动查询依据。

## 批准 seam 与动态覆盖

真实浏览器/真实打包 exe → 同源公开 HTTP → 独立 JSONL 引擎。没有 mock store、规则、session、私有函数，未添加 window 业务侧通道或 HTTP 测试开关。

新增11网页测试：

1. 实际UI初盘、黑ab提aa、三气bb/aa/ac、白pass、前后候选方、回看不加引擎查询。
2. 公开HTTP：每次不同64hex ID、伪造root/PV、未知字段、错误期望、错前缀、同盘不同pass历史、KM/HA缺失与0、Japanese HA2白先及Chinese补偿不混；Host/Origin/CSRF/Content-Type/64KiB/方法拒绝。
3. 引擎死亡后新成功之前旧引用已410；旧新代不可拼接；UI过期不自动分析。
4. 新服务实例拒旧引用，第二服务无引擎配置且正常退出。
5. 12候选只返回10，原总数、服务端限制说明保留。
6. 手算黑+15百分点/+4目、白−15百分点/−4目。
7. 无效数值最终结果无result，UI无可用入口。
8. 暂停取消未完成查询无可用依据且不补跑。
9. 外部 Node `--import` 平台 performance.now adapter 推进到2h；到期前读成功、到期后410，读取不续期，UI不降级。adapter不入业务包、不改机器时钟。
10. 外部HTTP仅延迟真实响应交付，切手/换谱后迟到旧结果不能覆盖新详情。
11. **真实2001次公开合法分析**：2000容量、读取提升LRU、插入淘汰第二条、第一与最新仍有效；未缩小生产限额。

新增1桌面测试：原生配置选择（仅dialog平台适配）→合成五局面→真实点击初盘/黑提子/白pass→杀死已记录独立C#引擎模拟外部故障→明确过期→无新增引擎查询/无异源HTTP→正常关窗exit0。C#只是受控引擎，不把它的v1.18.1版本字符串算真实GPU。

## RED / GREEN 与最终命令

所有证据根：`D:/code/tmp/go-coach-notes/evidence-15/implementer/`。

- `01-red.log`：新UI测试因缺少按钮失败；`02-green.log`：1 passed。
- `04-desktop-red.log`：保留旧`windows-x64-fa3a620`真实exe上新UI测试缺按钮失败，正常fixture清理；`09-desktop-green.log`：新真实包1 passed。
- `13-constraints-red.log`：公开DTO缺limitations断言失败；补齐后包含于最终全量。
- `10-evidence.log`：当时10项专项全部通过；之后加入新服务实例测试。
- `11-full-web.log`：中间版本120 passed；`12-full-desktop.log`：31 passed。
- **最终网页**：`GO_COACH_TEST_PORT=5193 npm.cmd test -- --workers=4`，`16-final-web-serial-build.log`：**121 passed，0 failed，0 skipped，3.4m**（原110＋11）。
- **最终桌面**：`npm.cmd run build`，`npm.cmd exec -- electron-builder --win --x64 --dir --publish never --config.electronDist=desktop-release/win-unpacked.tmp`，`npm.cmd exec -- playwright test -c playwright.desktop.config.ts`；`15-final-desktop.log`：**31 passed，0 failed，0 skipped，3.1m**（原30＋1）。使用已解出的本机Electron分发，不安装依赖。
- `npm.cmd run typecheck`、`npm.cmd run build`（40浏览器module）、`git diff --check`通过。命令用cmd重定向，避免PowerShell把esbuild正常stderr算失败。
- **持久候选复测**：`DESKTOP_TEST_EXE`指向下面持久包，专项1 passed、正常exit0，`17-persistent-candidate.log`及`persistent-candidate/`。
- `desktop-final/`保存截图、原生dialog结果、引擎I/O、PID身份及退出；新增测试exit0、survivors空。原套件故障注入非零退出仍按原语义保留，不算正常退出保证。已实际查看最终黑提子全页截图。结束检查自有5193无listener，本树/候选exe无存活进程；未操作5173。

## 失败与夹具修正（不删失败、不以重试冒充首轮通过）

- 隔离树无node_modules：仅robocopy已有主项目依赖到本树，不执行install/ci、不修改主树或lockfile。
- `03-desktop-red.log`是npm exec参数错误，不是产品RED；修正为`npm.cmd exec -- playwright ...`后才得到04真实RED。
- 扩展安全测试初次typecheck因异构header数组推断出undefined失败，改显式Record数组；未进入测试运行。
- 首次desktop:pack解压后rename `win-unpacked.tmp`→`win-unpacked` EPERM，失败输出留在实现会话工具记录。builder显示downloaded；检查现有缓存zip创建/修改为10月17日（早于本次），未安装新依赖。之后显式使用已解出的本机分发路径成功，未修改产品打包配置。
- `06-evidence.log`：6通过/1失败；时钟adapter在Windows用绝对路径而非file URL触发ESM scheme错误，修为pathToFileURL。
- `08-evidence.log`：5通过/2失败，历史PID清理报告64572存活，随后另一测试服务消失。Windows历史PID复用是怀疑原因，未保存当时完整进程快照，不声称已证明该次根因。修正夹具：每个外部脚本复制至自有唯一临时路径，Windows清理必须PID＋CommandLine含该路径，仍对真正自有存活进程报失败；不再对仅历史PID强杀。保留旧断言与失败清理语义。
- `14-final-web.log`：117通过/4失败（原棋盘/手动变化测试区域消失/超时），同时进行了desktop重打包。怀疑生成文件触发Vite重载干扰，不把猜测当确认。未改产品或放宽断言；打包结束后独立完整重跑得到16中的121通过。主代理复测应串行build/pack与网页测试，不要在网页dev运行时改产物。
- 持久包首次PowerShell哈希命令因Get-FileHash不可用失败，生成的空hash清单不算证据；改用已有Node crypto重新完整逐文件核验并覆盖为有效清单。

## 持久候选与限制

`D:/code/tmp/go-coach-desktop/candidate-15-f88dedf5-20261019/Go Coach.exe`

- 全目录 **91文件，386,578,021字节**；18个app资源仍为白名单构建产物，无operator/模型/源码测试/.scratch/密钥。使用本地unpacked Electron路径额外保留runtime分发的version/default_app.asar（相对旧89文件包），没有删改既有验收包。
- `package-manifest.json`由`check-package.mjs`用Node SHA-256核对91文件与本树完整测试包逐字节一致（并检查文件数量）；随后真实运行持久exe专项通过。完整目录不是单exe安装器，未签名/发布。
- **64MiB总payload淘汰与单条超限未动态触达**，只作静态边界实现，不冒称测试通过。没有JS RSS硬上限承诺。
- 未模拟OS单调时钟自身回退；生产用performance.now而非Date.now。2h由外部平台时间推进，不是实际等待2h。
- 没有动态构造“最终合法结果刚完成而在HTTP签发前session失效”微任务竞态；代码在issue再次核对session，取消/坏输出/死亡查询已有公开测试。
- 原139fc4f候选没有主动session推送，无法清除同手已显示或在途详情；这是复审确认的P2，不是可接受的范围限制。下述session修复已增加按需观察，仍待独立审查。
- 未跑真实KataGo/GPU；主代理后续授权验证。未读取用户Key/实际operator、未在线推理/发棋局/付费、未装依赖、未push或发布。仅合成谱。
- 未完成独立Spec/Standards及主代理整合复测；task15保持in-progress，不标05/08/10完成。整体仍不是DeepSeek中文教练。

## session P2中断恢复（2026-10-19）

恢复目录 `C:/Users/789/AppData/Local/Temp/pi-agent-e796e2f4-f48e-47d-8e5cbf7b`，基线d10d3da；先从detached HEAD建立 `fix/task15-session-recovery` 保留既有4文件未提交修改，无reset、无新worktree。主工作区业务未修改。原01/02证据不覆盖。

### 实现与公开契约

- KataGo公开observeSession同步首条有效身份/null，在ready/fail/close/generation变化发布；不启动引擎、不查询GPU、不改EngineResult/预算/事实或回收协议。
- `/api/engine-session-watch`严格空JSON、原Host/Origin/CSRF/64KiB校验、同源NDJSON/no-store，16连接上限与429；响应close解除observer，serverclose结束全部观察。
- 查看才连接；首条匹配refs才取证。持续观察null/不同session/坏协议/断流时abort并清数据，epoch阻止旧响应复活；首包10秒期限、切手/换谱卸载释放。浏览器offline事件可先于idle reader拒绝，故同时监听原生offline并清除；abort解除该事件监听。无自动轮询/重启或GPU查询。
- 保留原详情JSON接口和桌面同源限制，仅旧桌面请求白名单加入明确新增watch路径。

### 验证与失败（证据根 `D:/code/tmp/go-coach-notes/evidence-15/session-fix/`）

- 前代理 `01-*` / `02-*` 原RED→GREEN保留；本次从真实文件接续，未视其为完整验收。
- `03-recovery-watch.log`：9/9专项通过；严格字段/安全/大小/方法、16名额/关闭释放、未配置serverclose、ready/null/restart流、已生成HTTP延迟交付后失效、初始null不取证、坏帧/未完成尾行/连接失败/首包超时。
- `05-watch-expanded.log`：10通过/1失败。真实浏览器 `context.setOffline(true)` 后同手已显示详情未清除，不能依赖idle stream及时reject。新增offline平台事件处理，`06-watch-green.log`：11/11通过，保留原失败断言不skip；另含手动面板显式重启后旧refs仍失效，再看不增加分析。
- `07-full-web.log`：`GO_COACH_TEST_PORT=5193 npm.cmd test -- --workers=4`，**133 passed / 0 failed / 0 skipped，3.1m**（原121＋恢复1＋新增11）。默认扫描无watch，查询/再看无新增引擎分析；切手/换谱晚响应原语义仍通过。
- `08-build.log`、`09-pack.log`：完整build和builder成功。当前树electron包无dist，使用已存在的本机44.8.0 cache zip解到本树 `desktop-release/runtime`，`npm.cmd exec -- electron-builder --win --x64 --dir --publish never --config.electronDist=desktop-release/runtime`；无install、无下载/新依赖。所有build/pack与网页测试串行。
- `10-desktop-red.log`：旧持久候选15-f88dedf5上加强后的同手死亡断言真实失败，残留第4手pass详情；不再用切手或重新查询替代即时清除，fixture正常退出。
- `11-full-desktop.log`：新真实exe **32 passed / 0 failed / 0 skipped，2.1m**（原31加强1＋新增1）。新增桌面真实成功HTTP延迟→外部杀引擎→失效→放行旧response→另一手动面板重启→旧refs不恢复。新增两项均正常exit0，末端引擎survivors为空。
- `04-typecheck.log`、`12-final-typecheck.log`以及build内tsc通过，git diff --check通过。最终追加本日志后diff-check发现EOF多余空行，提交前删除该空行并重新检查。
- `13-persistent-candidate.log`：持久候选两项依据测试 **2/2通过**。`desktop-full/`与`desktop-persistent/`保留截图、engine-io、PID身份与exit.json。已实际读取持久包第3手截图确认黑提子/双方候选与棋盘显示。
- 初次查找恢复树的技能文件失败（这些文件未进入旧基线），随后按主指定路径读取主repo的SKILL/tests/mocking文档；只读取文档不修改主业务。docs/adr不存在，未虚构ADR。路径查询失败不作产品RED。

### 持久包与清理

唯一新候选 `D:/code/tmp/go-coach-desktop/candidate-15-session-recovery-20261019/Go Coach.exe`，完整目录91文件、386,581,676字节；`candidate-recovery-manifest.json`逐文件SHA-256和字节比较证明与测试包相同，校验脚本 `check-candidate-recovery.mjs`。保留所有旧候选和fa3a620，不签名/发布。

测试完成后自有5193无监听、本恢复树无存活业务进程；fixture按PID及唯一执行路径/创建时间确认所有自有引擎退出。只操作本次外部测试引擎，不停止非自有服务或5173。

### 未覆盖与交回

- 网络阻塞但未触发断流/offline时，不保证物理引擎变化同一瞬间可知；没有引入心跳或GPU探测。初始首包超时使用真实10秒等待，不改OS时钟。
- 此次新增的坏帧/尾行故障由浏览器网络adapter注入；没有mock store/session/规则、没有window私有业务API。正常ready/失效/重启来自真实公开HTTP及外部引擎进程。
- 既有64MiB/单条超限、OS单调时钟回退、HTTP签发微任务竞态仍未动态覆盖，不把本次回归当其通过。
- 未跑真实GPU/AI、未读真实operator/Key、未安装/外发/计费/push；08仅合并主分支既有文档，不实施。
- 独立Spec/Standards和主代理整合验收未完成，保持in-progress。
