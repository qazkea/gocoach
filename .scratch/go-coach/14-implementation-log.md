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
