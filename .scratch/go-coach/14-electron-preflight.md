# 14 · Electron 桌面预研（仅公开文档，未实施）

## 边界与结论
- 已读 `docs/agents/pi-workflow.md`、research 技能、`desktop-review-scope.md`；仅辅助读取 `server/index.ts`、`package.json`、`tests/process-cleanup.ts`。未研究 task13 整局扫描实现。
- 本次只写本文；没有安装、构建、测试、启动/停止进程、读取 operator JSON/账户密钥、调度代理或 git 提交。
- **建议（未验证）**：Electron 主进程 + `utilityProcess.fork` 托管现有 HTTP 桥；首轮用 electron-builder 的 Windows `dir` 免安装目录、`asar:false`，先验收目录内真实 `.exe`，不先追求单文件 portable。
- 用户已允许项目本地 Electron/打包工具依赖下载；这不是驱动安装、重下 KataGo/模型、签名、发布或在线 AI 请求授权。

## 1. 版本、Windows 与安装
- **官方事实**：[Electron v44.8.0 release](https://releases.electronjs.org/release/v44.8.0) 本次获取时明确标为 **“Latest Stable”**；发布日期 **2026-10-15**，内嵌 **Node.js 24.22.0 / Chromium 152.0.7977.167**。已用原始 HTML 核对版本、标签和 Node 更新说明，不按稳定列表第一行猜版本。
- **建议候选**：锁定 `electron@44.8.0`（精确版本，不写 `^`）；实施前再次核对 release 与可下载工件。当前是文档候选，**没有下载或实际运行证据**，不能称本项目兼容。
- [官方 Windows 支持公告](https://www.electronjs.org/blog/windows-7-to-8-1-deprecation-notice) 的边界是 Electron 23 起放弃 Windows 7/8/8.1，要求 Windows 10 或更新；本项目首目标 Windows 10/11 x64。未核验本机 OS build/CPU；不把此支持边界解释为所有 GPU/驱动组合都可运行。
- [官方安装](https://www.electronjs.org/docs/latest/tutorial/installation)：短引文 “install Electron as a development dependency”；后续可在项目中 `npm install --save-dev --save-exact electron@44.8.0`，**本次未执行**。嵌入 Node 不等于构建机 Node：Vite、esbuild、打包工具的宿主 Node 要求须独立核验。
- 安装页称二进制可首次运行时下载，也保留 installation 下载说明；因此不能只凭 npm 包安装完成判断运行时已备齐。下载范围含 Electron 对应 Windows 工件（Chromium + Node + 配套 DLL/resources）、npm 传递依赖；缓存可能位于用户目录，不是“项目依赖”就保证零项目外缓存。

## 2. 子进程方案与关闭协议
- **现有事实**：桥为 esbuild ESM 输出 `.server/index.js`；生产标志 `--production`，`--port 0` 可随机端口；stdout 为 `LISTENING http://127.0.0.1:<port>`。当前 `process.on('message', 'close' 的处理器)` 会等待引擎关闭后尝试 `process.disconnect()`。
- [utilityProcess 官方 API](https://www.electronjs.org/docs/latest/api/utility-process)：短引文 “creates a child process with Node.js and Message ports enabled”；只能在 app `ready` 后 fork。可配置 `cwd/env/args`、stdout/stderr `pipe`，有 `spawn/message/exit`；`error` 是实验性的 V8 fatal-error 事件，不能当作普通 Node ChildProcess 全套错误语义。
- **关键差异**：utility 父端用 `child.postMessage(...)`，子端用 `process.parentPort.on('message', e => ...)` / `e.data`；子端回传 `process.parentPort.postMessage(...)`。这**不会自动触发现有 Node IPC 的 `process.on('message')`**。
- [Electron Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses#runasnode)：短引文 “With this fuse disabled, child_process.fork throws”；Node `fork` 依赖 `ELECTRON_RUN_AS_NODE`，官方建议改用 Utility Processes。
- **备选推断**：`child_process.fork(桥绝对路径, args, {execPath:process.execPath,...})` 配合 `ELECTRON_RUN_AS_NODE=1`、IPC channel，可最大限度复用现有 `send('close')/disconnect`。无需用户安装独立 Node，但必须保留 RunAsNode fuse；不能硬化掉该 fuse 又沿用这个方案。打包路径和 ESM 仍须实测。
- **推荐最小方案（设计，不是已实现）**：主进程 `whenReady` 后 fork 一个桌面 bootstrap；桥输出为明确 `.mjs` 或保留有效 `type:module` 边界。小型 IPC 适配把 utility 的 close 消息接到同一异步关闭逻辑，保留旧 Node IPC 路径供网页测试使用；不能仅改父端方法名。
- 启动：明确绝对 entry/cwd/dist/config 路径，传 `--production --port 0`；读取有界 stdout/stderr，严格解析 LISTENING 的回环地址/有效端口，成功后才 `loadURL`。超时或提前退出显示本地错误，不弹终端、不偷偷重启无限循环。
- 退出：单次关闭状态机拦截 `before-quit`，发 close → 桥停止接收请求、关连接并 await 引擎 → 回传 closed → 等待子进程 exit → 主进程退出。显式结束 utility 只能在清理完成后；IPC 句柄是否使其继续存活须验收。
- 超时才调用自有 child 的 kill；**kill 不是业务清理协议，也没有“自动杀净 KataGo 孙进程”的文档保证**。不能按端口/进程名杀其他实例；不触碰用户 5173。
- [app 退出 API](https://www.electronjs.org/docs/latest/api/app#event-before-quit) 明确 Windows 关机/重启/注销可能不触发 `before-quit`；主进程崩溃、强杀、引擎卡死的孤儿清理仍是风险，须另测或设计受控进程所有权机制。
- `tests/process-cleanup.ts` 的 ChildProcess `send/connected/signalCode` 不能原样用于 UtilityProcess；可复用“仅清理自有句柄、限时等待”的思想，不能宣称已有桌面清理测试。

## 3. ASAR 与生产资源
- [ASAR 官方限制](https://www.electronjs.org/docs/latest/tutorial/asar-archives)：短引文 “Archives Are Read-only”“Working Directory Can Not Be Set to Directories in Archive”；归档内执行二进制只有 `execFile` 获支持，且可能临时解包。不是禁止 `spawn` 调用归档外的真实 exe。
- **建议首轮 `asar:false`**：降低 ESM loader、子进程入口、真实 cwd 等组合风险；后续启用 ASAR 再单独验收，不能把归档当安全隔离或保密机制。
- 外部 KataGo executable/model/dataDir/homeDataDir 保持在用户原有真实目录；不复制模型、不硬编码开发机 D 盘路径、不把 cwd 指向 archive。即便后续 ASAR 打包，外部引擎仍用绝对真实路径与 `shell:false`。
- [app.getAppPath](https://www.electronjs.org/docs/latest/api/app#appgetapppath) 返回应用目录；[builder extraResources](https://www.electron.build/docs/win/#extraresources) 将指定资源复制到 Windows `resources`。
- **建议布局**：主程序入口在应用目录；桥与 Vite `dist` 用白名单放到 `resources/bridge`、`resources/ui`，主进程按 `process.resourcesPath` 构造绝对路径传入桥。开发态也显式计算路径，禁止把 `resolve('dist')` 留作生产 fallback。
- 桥的静态文件根改为显式输入，继续做解码/越界验证；随机 cwd、含中文/空格路径、只读程序目录、移动整个免安装目录都要测试。`cwd` 仅是兼容参数，不再是资源定位协议。
- 打包白名单只包含运行入口、构建产物、必需 runtime dependencies/元数据；排除 `.scratch`、测试、源项目、operator JSON、账户资料、模型和本机缓存。生产不启 Vite/HMR；`--packages=external` 输出的实际 runtime imports 要审计，不能假设 esbuild 已打包所有依赖。

## 4. 双击首启，不要求用户设环境变量
- [app.getPath('userData')](https://www.electronjs.org/docs/latest/api/app#appgetpathname)：短引文 “directory for storing your app's configuration files”；Windows 默认在 `%APPDATA%/<应用名>`，官方建议应用自有子目录，避免与 Chromium 缓存冲突。
- [原生 dialog](https://www.electronjs.org/docs/latest/api/dialog#dialogshowopendialogwindow-options) 在主进程调用 `showOpenDialog`，`properties:['openFile']`、JSON filter；返回 `canceled/filePaths`。扩展名 filter 不是内容校验。
- **建议首启**：双击 exe → 主进程读取 `userData/settings/desktop.json` 中已选配置引用 → 缺失/失效则原生弹窗选择现有 operator JSON → 校验字段/路径/读写权限并向用户确认 executable → 启动桥 → 成功后打开复盘窗口。取消保持未配置状态，可重选或退出，不静默使用模拟引擎。
- 仅持久化 operator JSON 的绝对路径及必要非秘密偏好；原 JSON 不改、不随包。相对路径若现有格式允许，必须按明确的原格式规则解析，不能因复制配置改变语义；规则不明就要求绝对路径并给错误说明。
- 为最少改动，可由主进程仅在子进程 `env` 内设置 `GO_COACH_CONFIG`，值来自上述选择；**用户不用命令行/环境变量，不等于内部必须删除该机制**。不要把配置全文、文件系统任意读写或 env 暴露给 renderer。
- 无配置阶段可先用主进程原生 dialog；后续“重新选择配置”用原生菜单最省 IPC。如需页面按钮，仅开放单一选择动作，校验 sender/frame 与 schema；不暴露通用 IPC、任意路径执行接口。

## 5. Renderer 与回环 HTTP 安全
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)：短引文 “Enable context isolation”“Enable process sandboxing”“Validate the sender of all IPC messages”。显式设 `nodeIntegration:false, contextIsolation:true, sandbox:true`，不关 `webSecurity`、不加 `--no-sandbox`；无需 preload 时不添加。
- 主窗口仅加载本次握手得到的精确回环 origin；限制导航/重定向和子框架入口，使用 URL parser 进行精确 origin 比较而非字符串前缀；`setWindowOpenHandler` 默认 deny，禁 webview 与不需要的权限/下载，不自动 `shell.openExternal` 用户输入。
- 官方同页建议本地内容优先 custom protocol 而不是 file；**本项目保留已有回环 HTTP 是最小迁移权衡，不是官方声称 HTTP 最安全**。不得把它扩成远程站点、0.0.0.0 或任意端口代理。
- 保留 `127.0.0.1` 随机端口、精确 Host、Origin/Sec-Fetch-Site 检查、同源 JSON POST 与随机 CSRF token；无宽泛 CORS。桌面壳不能替代这些检查；同时它们也不防拥有同一账户权限的恶意本机进程。
- **建议生产 CSP 起点**：`default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`，通过桥 HTTP 响应头交付。当前是否有 inline style/data 图片需求须验证后收紧/调整；不为省事开放脚本 `unsafe-inline/unsafe-eval`。
- 开发 HMR 与生产策略分离；WebSocket/跨域/导航负例必须针对真实 exe 重测。当前辅助读取的静态响应未见 CSP，不能说现状已满足。

## 6. 无签名本机打包与依赖范围
- [electron-builder Windows 官方文档](https://www.electron.build/docs/win/) 列出 `dir/zip/portable`，短引文 “portable … without installation”；默认 target 是 nsis，故必须显式选择，不能误做安装器。
- **建议**：项目本地 devDependency `electron-builder`，先 `dir`（例如开发者后续运行 `electron-builder --win --x64 --dir --publish never`），交付整目录，用户双击其中 `.exe`；不是把 `.exe` 单独拷走。zip 仅为可选目录运输方式；单文件 portable 后置，避免首轮增加自解包/临时目录/启动器验收变量。
- 当前官方 Windows 页为 **v27 语义**：`win.sign:false` 或 null 明确禁止签名，短引文 “disable code signing entirely”；留空会发现环境中的证书。不要照抄旧版 `signAndEditExecutable:false`。本次未核对 builder 精确 release，**版本锁定及该配置可用性是实施前门槛**，不是已给出可直接执行的完整配置。
- 明确不配置自动更新、不发布、不读取签名凭据；无签名不等于无 SmartScreen/安全软件提示，不承诺普通用户策略一定放行，也不建议关闭系统安全功能。
- 预计下载：上述 Electron 运行时、builder 及 npm 传递依赖、Windows 打包/资源编辑所需工具（可能包括 app-builder/压缩与资源编辑组件）；选择 portable 还可能增加 NSIS 工具。**具体工具、体积、缓存位置依锁定版本/target 才能确认**，不能声称只下载两个 npm 小包。
- 不需要额外 Node 供最终用户运行；不在本阶段批准 Visual Studio/系统 SDK/驱动等全局安装。若构建要求未预期系统组件，应停止并报告，不自动扩大授权。

## 7. 真正 `.exe` 的 Playwright 验收与限制
- [Playwright Electron API](https://playwright.dev/docs/api/class-electron)：短引文 “experimental support”，支持表为 `v21+`；`_electron.launch({executablePath:实际打包exe的绝对路径})`、`firstWindow()`、renderer 操作、main `evaluate()` 与 `close()` 是官方支持的自动化入口。
- “v21+”不是本仓库 `@playwright/test ^1.56.0` 与 Electron 44.8.0 的实测矩阵；本次不读 lockfile、不升级、不安装额外浏览器。实施时先核对实际解析版本与 `_electron` 导出，再做小冒烟。
- 官方已知限制：`EnableNodeCliInspectArguments` fuse 不能关闭，否则 launch 可能超时；测试产物必须明确保留该能力。不要把仅供自动化的 inspector 能力无说明带入未来发行版；本次不发布。
- Playwright 不拦截原生 Electron dialog；可在主进程 evaluate stub 它来验证选中/取消/错误后的业务路径，但**不能据此声称真实 Windows 文件选择器已验收**。首次自动弹窗可能先于注入，建议保留用户点击/原生菜单触发的确定性测试入口，不加生产任意执行后门。
- 后续最小验收清单：从非项目 cwd 启动真实目录产物；首次选配置/取消/坏 JSON/路径失效；重启记忆；不依赖外部 Node/Vite；随机回环端口及安全负例；渲染棋盘与既有本机引擎分析；分析中关窗；启动失败、桥崩溃和超时只清理本实例；移动安装目录仍可启动。
- 用测试隔离 userData，禁止污染真实用户配置；自动化 `.close()` 不代替 Windows 标题栏关闭/双击启动/原生 dialog/SmartScreen 的人工验收。引擎真实性、GPU表现和进程残留需单独证据，不能用 mock 或浏览器 localhost 测试冒充桌面验收。

## 尚未解除的门槛
1. Electron 候选版本和 Windows 工件实际取得、宿主 Node 与 builder 精确版本/配置核验。
2. utility IPC + ESM + production runtime imports 的最小编译/打包验证；正常退出与异常退出的引擎所有权证据。
3. operator JSON 原有路径规则、可写目录/本机驱动兼容性未读未测；未改变任何真实配置。
4. Windows 无签名真实 exe、Playwright 版本组合、CSP 与原生首启体验均未测试。本文仅足够进入下一阶段设计，**不构成“已可用”结论**。
