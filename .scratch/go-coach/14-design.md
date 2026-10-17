# 14：Windows桌面运行与免安装目录包

Execution: in-progress

依据：desktop-review-scope.md；用户已允许Electron运行时与打包工具项目本地安装。13已在b30b039验收。此票交付现有整局复盘的桌面宿主，不冒充DeepSeek讲解完成，也不顺带重写教学/棋规。

## 选型与依赖

- 主代理核对官方release与npm元数据：Electron **44.8.0**（Node24.22.0，包要求宿主Node>=22.12；本机Node24.15符合）；本机Windows11 x64。锁精确版本，不安装全局工具。
- npm当前builder元数据为 **26.15.3**，锁该版本；网页最新文档已经是v27，不能照抄其win.sign。主代理读取已发布app-builder-lib@26.15.3的winOptions.d.ts确认v26有 `signExecutable:false`（禁止签名保留资源编辑）、`signAndEditExecutable:false`（连资源编辑都禁用）。首版显式禁止签名和发布；不发现/读取证书凭据。安装后再核对该包实际schema。
- 使用electron-builder `--win --x64 --dir --publish never`，`asar:false`。交付完整免安装目录里的exe，不是可单独拷走的单文件exe；无自动更新、不创建安装器、不申请管理员权限、不修改注册表文件关联、不绕过SmartScreen。
- 允许这些包及必需运行时/打包工具的下载，保留锁文件、版本、工件目录/体积记录；不新增VS/SDK/驱动/其他引擎或模型。若所需系统组件超出授权，报告而非自行安装。避免无关依赖升级。

## 桌面与桥

- 新增独立desktop主进程module负责窗口、原生配置选择、生产资源路径和自有utility进程生命周期，业务UI/整局队列仍复用现有React。无在线AI、无Key界面/读取。
- app.whenReady之后用utilityProcess.fork启动一个薄bootstrap；生产桥只用随机127.0.0.1端口。无需用户机器另装Node，不依赖npm、Vite或项目cwd。先拿到严格有效的本次回环LISTENING地址再打开业务页面；超时/提前退出可见且不无限重启。
- 现有server/index.ts可最小导出幂等异步close以供bootstrap调用；保留Node IPC（原网页测试）关闭入口。utility的process.parentPort消息必须显式适配，不能假定触发process.on('message')。bootstrap在导入桥前接收并记住关闭请求，避免启动途中关窗丢失请求。
- 关窗/退出只有一次关闭流程：停止业务请求→通知桥close→await既有KataGo回收→utility退出→应用退出。正常退出不能仅kill utility或依靠测试兜底。超时/桥异常要清楚区分，只有自有进程可回收；不能按端口/进程名查杀，不碰用户5173。受控桥故障/分析中关窗需实际检查引擎PID；主进程硬杀/OS关机/断电未验证部分明确披露，不承诺所有灾难场景无孤儿。
- 生产静态根由主进程通过可信启动参数/子进程环境传绝对路径给桥；旧网页production默认可保留以兼容已有流程，但桌面必须显式传入，不依赖cwd。资源使用构建产物白名单：desktop入口/bootstrap、Node桥、dist、必要元数据/runtime依赖。排除源代码、测试、.scratch、operator文件、模型、缓存、密钥。
- 新增desktop启动/打包/测试scripts，打包产物和构建中间文件gitignore。最终用户双击exe，允许整个目录移到含空格/中文路径，程序目录不可写也能正常使用。

## 首启配置

- 先启动未配置的本地服务及可回放窗口；提供明确中文原生“引擎→选择本地配置…”菜单/首启指引。取消选择仍可回放，不弹出要求运行命令行的流程，不默默启用假引擎。
- 主进程原生dialog选择已有operator JSON，文件过滤器不等于校验。验证有界JSON、所需字段、绝对路径与存在性；选中文件可指定执行程序，因此确认对话框明确显示将运行的路径并默认取消，不信任来路不明配置。
- 不改原operator JSON、不把开发机D盘路径写进源码/产物。应用userData的自有子目录保存批准后的配置引用/内容摘要和必要设置；重启自动恢复，但原文件更改、消失或无效时要求重选/确认，不能借同一路径换文件静默运行另一程序。
- 仅把批准配置用于自有子进程env。每次桌面实例的dataDir改为应用userData内自有运行目录，避免与网页服务写同一个analysis-web.cfg；保留现有模型/可复用homeDataDir，勿重复下载。原配置不变。正常桌面禁用recordSyntheticEvidence，不能意外把用户谱落入合成证据日志。
- 分析中更换配置会重启自有服务/清空当前复盘，因此需明确提示并确认；无效/取消不能破坏原有效运行状态。配置路径、任意文件读取/执行、环境变量不提供给renderer通用接口；原生菜单可避免preload/IPC授权面扩张。

## 安全与测试

- BrowserWindow明确nodeIntegration=false、contextIsolation=true、sandbox=true、webSecurity不关闭；无需求不加preload/webview。窗口只加载本次精确origin，拦截外部导航/重定向/新窗/不必要权限和下载，不自动打开外部URL。
- 生产HTTP CSP禁止远程脚本、eval、object/frame等，保留精确同源连接。现有GoBoard/走势使用React内联样式，可限于style-src-attr允许内联属性，不能为了样式放开脚本。必须实际检查棋盘、曲线和布局而非只检查header存在。旧Host/Origin/JSON/CSRF/静态路径限制不削弱；同账户恶意本机进程不在这些网页保护的保证内。
- 延续用户已批准的完整界面流程与平台I/O测试方式：真实打包exe启动→配置选择→导入→自动扫描/逐手查看→关窗退出；通过Playwright Electron操作真实窗口，不仅测localhost网页。不测试内部函数，不用window侧通道，不stub生命周期、规则或复盘业务。
- 原生dialog属于平台I/O，自动化可以只替换其选中/取消返回值，之后必须走真实配置处理；须披露真实Windows文件选择器的人工操作未被替代测试证明。main evaluate仅限原生dialog/窗口菜单操作等平台边界，不窥探私有业务状态。测试使用隔离userData，既有110条网页回归仍跑。
- 桌面自动化用外部引擎adapter，不能让utility的process.execPath误当成普通Node执行.mjs：可测试环境提供明确的外部Node路径或使用现有编译器构建独立测试exe；实际产品仍只用真实KataGo，不向HTTP/renderer开放测试配置。选择具体最小适配需在实施记录说明，不安装额外Node/编译工具。
- TDD先真实exe可启动未配置界面/退出的单切片RED→GREEN，再配置和资源、业务、异常关闭与安全负例；不能批量先写所有测试。Playwright Electron支持是实验性的，不能拿官方v21+当本机版本兼容保证，先小冒烟再扩展。
- 验收包括非项目cwd、中文/空格移动目录、重启配置恢复、取消/坏JSON/路径失效、默认N+1扫描、候选和木质棋盘、渲染器无Node、外部导航拒绝、启动失败/分析中退出和自有进程清理。保存实际exe路径、版本/大小、截图、测试日志，主代理独立审查/整合复测；主代理最后可用既有KataGo做最小合成谱桌面实测，不上传私谱。
- 仅原生窗口宿主完成，不宣称已完成紧凑桌面布局、DeepSeek逐手解释、安装器/签名/发布或所有Windows机器适配。用户最终双击/SmartScreen/系统dialog体验仍需试用确认。

## 官方核查与研究更正

- https://releases.electronjs.org/release/v44.8.0
- https://www.electronjs.org/docs/latest/api/utility-process
- https://www.electron.build/docs/win/ （当前v27，不能用于推断锁定v26配置）
- https://unpkg.com/app-builder-lib@26.15.3/out/options/winOptions.d.ts （已发布v26包声明）
- `npm view electron@44.8.0 version engines --json`、`npm view electron-builder version engines --json`及26.15.3 tarball元数据已由主代理读取。GitHub猜测v26.15.3 raw tag地址返回404，不作为源码证据。
- 更早公开预研见14-electron-preflight.md；本文在版本/签名选项等冲突处优先。最初尚无本项目桌面安装/打包/运行成功证据；候选及主代理复测后续见14-implementation-log.md，最终验收未完成。

## 审查确认的边界补充（待修复）

主代理已核实独立双审查指出的三个P2，候选3c54fe9虽然19桌面/110网页回归通过，仍不得据此标done：

- 首屏加载期间原生配置选择不得中止初始loadURL并被当成启动失败退出。首屏未就绪时禁用选择菜单且选择函数同样校验；加载完成再启用，避免只依赖菜单灰态。
- Windows路径必须完整限定盘符/UNC，或先固定为完整路径后校验、展示和传入；本票采用拒绝根相对路径（例如`\\local\\katago.exe`），同时校验operator自身及四个字段。Node的isAbsolute在Windows上对此返回true，不能单独作凭据；不能因主/utility cwd盘符不同执行另一文件。
- 正常关闭必须收到bootstrap在await bridge.close成功后发出的确认，并确认utility以0退出；异常退出、明确close失败消息和关闭超时分别报告，不能在quitting期间一概吞掉。避免未开始stop就产生无人处理的reject。
- 关闭失败保留窗口且默认不继续退出；用户若明确选择“退出应用（引擎回收未确认）”，才允许以失败退出码退出，并清楚保留未确认回收警告。不能将此兜底算正常关闭或宣称没有残留，也不能为通过测试私自杀其他进程。优先展示明确错误，不把错误只留stderr或退化成笼统超时。
- 三项均通过真实打包exe的界面/原生菜单及外部I/O故障注入做实际RED→GREEN，正常19测试与110网页语义回归保留；不mock生命周期或添加renderer业务侧通道。
