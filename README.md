# 围棋赛后复盘 — 回放、示例教学与本地引擎

电脑浏览器手动读取已结束对局的完整 SGF，逐手查看实战棋盘与俘虏数。
文件在浏览器读取；显式打开真实分析后，仅必要棋局经同源 HTTP 发送到同机回环 Node 服务。
没有外部 AI、付费调用、账号、自动同步或实时辅助。名字、评论、原始 SGF 不进入分析请求。
**教学仅为四份核验合成记录的预设示例分析，不是真实引擎/AI。尚未验证野狐导出兼容。任务验收由主代理另行组织。**

## 运行

Node 24 / npm 11；在项目目录运行：

```sh
npm ci
npx playwright install chromium
npm run dev
npm test
npm run typecheck
npm run build
```

Windows PowerShell 可使用 `npm.cmd` / `npx.cmd`。开发服务仅监听 `127.0.0.1`。
上传 `tests/fixtures/manual-finished.sgf` 可检查自制四手结束样例。
回放区域可聚焦；左右方向键前后浏览，Home/End 到起始/末尾。每个棋盘点提供
SGF 坐标与黑/白/空的可访问名称（aa 左上，ss 右下，先列后行）。

## 本地 KataGo（任务09，已完成本机验收）

`npm run dev` 使用单个 Node HTTP 服务（默认 `127.0.0.1:5173`）挂载 Vite；
`npm run dev -- --port 5174` 可换端口。服务端更改须重启 dev，浏览器模块支持同源热更新。
`npm run build` 构建浏览器 dist 与 esbuild Node ESM；`npm start -- --port 5173` 同源提供 dist。
不能直接把 Vite 或 dist 静态预览当作完整引擎服务。仅使用 `http://127.0.0.1:端口`，严格 Host/Origin。

引擎懒启动：仅回放、示例教学或读取 CSRF 令牌均不启动 GPU。任何符合条件的导入谱都可
点击“打开本地真实引擎分析”，从当前回放步开始双方连续试下、Pass、撤回/重走、替换未来、回原局。
原谱不改。换文件/回放步会关闭面板并取消；换分支清旧估值后等待。失败、无结果或 busy 可手动重试。
关闭面板只取消其请求；服务退出才关闭自己的引擎，先关闭 stdin，3秒后必要时仅终止自己 spawn 的 PID。

### 操作员本地配置（不要提交 Git）

无需重新下载；本机授权资产在 `D:/code/tmp/go-coach-runtime/katago-1.18.1-opencl`。
本次留下 `web/operator.local.json`，使用已校验 exe/b18 与原 home 缓存，生成配置和诊断日志在 web 内。
PowerShell：

```powershell
$env:GO_COACH_CONFIG='D:/code/tmp/go-coach-runtime/katago-1.18.1-opencl/web/operator.local.json'
npm.cmd run dev
# 或 npm.cmd run build; npm.cmd start
```

其他路径的配置结构（全部由操作员设定，不接受 HTTP 提供路径或引擎 action）：

```json
{
  "executable": "D:/local/katago/package/katago.exe",
  "model": "D:/local/katago/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz",
  "dataDir": "D:/local/katago/web",
  "homeDataDir": "D:/local/katago/home"
}
```

仅支持本票已核验的 v1.18.1 OpenCL；程序会调用 version 核对。缺配置时仍能回放并明确分析失败。
请勿改用其他引擎/模型而沿用本票验收结论。服务没有下载器，不安装驱动或运行库。
默认不记录完整请求/响应；`dataDir/engine-logs` 保留引擎运行诊断。
**仅授权合成验收**可在单独配置加入 `"recordSyntheticEvidence": true` 留存完整棋局和响应日志；
不要对私人棋谱启用。普通 `operator.local.json` 不启用；`web/synthetic-evidence.local.json` 仅供复现合成验收。

### 条件、语义与限额

- KM 必须为 [-400,400] 半整数。非空初盘缺 HA 拒绝估值（不妨碍回放）。HA0 或空盘缺 HA 补偿0。
  HA≥2 只接受数量匹配的纯黑初盘和白先：Chinese 的 whiteHandicapBonus=N，Japanese 为0。
- 显式近似 profile：SIMPLE ko，Chinese AREA/NONE tax，Japanese TERRITORY/SEKI tax，禁自杀；
  不是完整中国/日本裁判规则，也不声称野狐完整认证。完整有序历史用于实际棋规与所有候选/PV验证。
- 固定 BLACK 视角，正目差为黑领先。预算100 visits、cfg maxTime2秒，分析线程1/搜索线程2、batch2/cache18、analysisPVLen=15（不含首着，PV数组最多16着）、无ownership。
- 资源平台检查：`node tests/fixture-resource-check.mjs timeout`（亦支持 `exit` / `disconnect` / `nofork` / `spawn-error`）。嵌套 Playwright 启动失败是预期；以外层命令的退出码和 PID/临时目录检查判定。独立配置不进入正常浏览器套件。
- Windows 真实 EPIPE 浏览器回归已通过，无跳过；包含旧进程退出后再重试、回收中关闭及迟缓版本查询进程关闭。
  临时原生测试引擎使用本机既有 .NET Framework 4 的 csc.exe / System.Web.Extensions.dll，编译产物随测试删除；缺少工具会报错，不自动安装。普通应用运行不依赖这些测试编译工具。
- 外层检查自身超时的独立验证：`node tests/fixture-deadline-check.mjs`。真实断管的平台探针：`node tests/windows-input-probe.mjs`；平台探针不替代浏览器回归。
- 实际 visits 照实显示，可能略超100。启动600秒与就绪查询30秒独立，不能将首次调优耗时当查询耗时。
- 候选不等于全部合法手或最强证明，PV 是假设而非必然结局，估值不是棋理原因。
  显示前10项，同时显示总数与未展示数；缺PV不补齐。未知循环只标不支持，不冒充非法着证明。
- 64KiB 流式输入、最多2000帧、最多362候选、单条响应2MiB；任何坏候选/PV整次拒绝。
  最多4个未收尾身份（含取消墓碑/待终止确认）；超出 busy，超时清理后可重试。
- JSON + 随机 CSRF 令牌、同源 Origin/Host、无 CORS；没有 HTTP shell、路径、引擎 action、任意文件入口。
  生产仅 dist 静态根；开发仅白名单浏览器模块、Vite依赖及公开示例资源，不公开 server/runtime/任务文档。

### 验证边界

`npm test` 保留原58条语义回归，新增测试通过真实浏览器/HTTP/规则/序列化，只将外部进程换成
Node 脚本或 Windows 临时原生测试进程。每测试独立进程/随机端口；成功的受控分析标“可控测试引擎”，不是真实接入证据。
测试进程入口 `GO_COACH_TEST_ENGINE` 仅由本机测试启动环境选择，不能由网页注入。

真实浏览器验收为独立手动命令（先 build）：

```powershell
$env:GO_COACH_CONFIG='D:/code/tmp/go-coach-runtime/katago-1.18.1-opencl/web/synthetic-evidence.local.json'
$env:GO_COACH_EVIDENCE='D:/code/tmp/go-coach-runtime/katago-1.18.1-opencl/web/new-acceptance-directory'
node tests/real-engine-browser.mjs
```

请用全新证据目录。只运行内置合成输入，不读取用户棋谱；完整日志/截图留本机，不进 Git。
[09实施记录](.scratch/go-coach/09-implementation-log.md) 与
[真实网页记录](.scratch/go-coach/09-browser-acceptance.md) 区分受控回归、真实运行、失败尝试及局限。
最终状态见[主代理验收](.scratch/go-coach/09-main-acceptance.md)：92条浏览器回归全过，另有14次真实网页分析。
仅确认本机Windows/指定引擎与模型；低预算重复分析的首候选可能变化，不代表最强手证明或教学效果。

## 单局面教学（任务02）

上传以下任一个完整样例，再点“进入核验教学局面”：
- `tests/fixtures/manual-finished.sgf`：第2手后，课堂和模拟引擎同选 ab。
- `tests/fixtures/manual-two-corners.sgf`：第4手后，课堂选 ab，模拟引擎首选 rs。

分析只读取同源 `/analysis/corner-a.json` 或 `/analysis/corners-b.json`，请求只有公开示例ID，
不发送上传SGF、名字或注释。名称/描述可不同，初盘/行棋方/完整序列/规则/贴目须匹配；
其他文件仍可回放，不套固定答案。此示例路径不调用本地引擎，无付费调用。

等待结束后可点击棋盘先试一手、请求提示后继续、直接看答案，并切换实战/两种推荐。
棋盘按钮提供坐标及颜色可访问名称，Tab 聚焦、Enter/空格落子。
每次试下或比较都从指定原局面开始，不构成多手变化；原实战不变。
红框标目标，蓝框标提示中的气，绿框标推荐。试下只反馈本课局部目标，不一律判其他合法着全局错。
响应缺证据、位置冲突或失败时不呈现答案，可重试；切换局面/文件后不采用旧响应。

B的预设排序不证明 rs 更强或 ab 更简单；不展示编造的胜率/目差。没有
文字追问、练习或学习记录；真实引擎使用下方独立入口，不冒充示例教学。手算来源及全序列见
[02独立核验说明](tests/fixtures/guided-positions.md)，实际验证见
[02实施记录](.scratch/go-coach/02-implementation-log.md)。

## 少量教学精选（任务04，已验收预设示例流程）

上传后即显示分析等待，核验证据后提供0–3个精选，逐个进入同一套教学与变化流程。
1–3个、约10–15分钟只是目标，不保证、不凑数。原谱回放始终保留。

新增真实文件：
- `tests/fixtures/manual-mixed.sgf`（C）：白先、9手。默认候选含救棋、连接、吃子和有限三手提子；
  真实筛选先提供危险棋子aa、吃mm、连接gh/gj，不按输入顺序或损失排序。
- `tests/fixtures/manual-force.sgf`（D）：可直接体验有限简单死活，黑ba后枚举白全盘合法应手与pass，
  固定下一黑着ab提aa；模拟引擎推荐ab、固定下一黑着ba也独立核验。

新增出口仅同源 `/analysis/mixed-c.json`、`/analysis/force-d.json`。两者提供候选而非最终课程，
响应包含完整公开源上下文（setup、初始行棋方、规则贴目、让子、全序列）；名字评论不参与或外发。
A/B旧资源仅在adapter归一化，随后与C/D共用真实棋规、目标证据、筛选与UI，未另留题库UI。

有限事实：己链一气补到至少两气；两条己链合法连通至少两气；提净一气敌链；三手内强制提净原敌链。
最后一类完整枚举对方全盘合法应手含pass，验证固定第三手，不把单条PV或当前两气当活棋。
完整原局前缀参与每个分支的合法性校验。仅占点、自杀、简单劫类型可排除为非法应手；
未知循环/未支持规则保留结论。不是通用死活、劫活或全局最优证明。

最多32候选；整题两类推荐涉及的原目标合计最多2链/6子，三手证明共享4096次落子验证预算。
超限拒绝，耗尽说明未完整核验。核验后按证明步数、原目标链数、原子数、原局步数、稳定ID排序；
同一步同教学目标去重，最多选3。该尺度不是成熟难度评分，模拟损失不参与排序。
空输入、证据不足、不支持范围、请求失败分别说明；失败可重试。切课/离开教学清除试下提示答案变化；
换文件或请求后迟到结果不覆盖当前队列。新课程没有专门变化证据时显示暂无分析，可继续行棋。

手算与输入格式见[04样例说明](tests/fixtures/selection.md)，实际验证见
[04实施记录](.scratch/go-coach/04-implementation-log.md)。本节示例精选不使用真实引擎，无真人用时或教学成效证据。

## 连续变化探索（任务03）

教学准备就绪后点“探索连续变化”，从教学起点按轮次连续试走双方；支持 Pass、
撤回、重走、回起点与切回实战。撤回后落新着替换后续；只保留一条变化，不保存分支树。
原实战不变，完整已知前缀与变化共用原有有限棋规，合计最多2000帧。

A仅六个手算变化有预设局部证据：起点、dd、dd/ab、dd/ss、dd/ss/ab、ab。
B/C/D与其他合法变化仍可操作，但明确显示“暂无已核验示例分析”，不复用起点结论。
红框是当前证据目标，蓝框是当前棋链的气。两气不等于全局活棋。
无真实胜率/目差，不展示估值；未来数值统一黑方视角。

请求只含同源公开示例及变化资源ID（`/analysis/variations/corner-a/*.json`），
不发送上传文件或个人字段。响应核对完整公开示例身份、起点、规则、贴目和顺序历史，
并在真实当前盘核验链、气或提子。盘面先更新、旧证据立即清除，再等待分析；
失败保留变化，可重试。换着、撤回/重走、模式、局面或文件切换隔离迟到成功和失败。

手算依据见[03核验说明](tests/fixtures/variations.md)，实际RED/GREEN及限制见
[03实施记录](.scratch/go-coach/03-implementation-log.md)。不代表真实引擎或AI分支能力。

## 有限支持范围

- 只接受**一棵树的一条序列**，不截取集合、分支或损坏文件中的一部分。
  要求明确 `FF[4]`；`GM` 缺省 1、`SZ` 缺省 19，明示值仅接受 1、19。
- 必须在同一个 game-info 节点提供 `RU[Chinese]` 或 `RU[Japanese]`，以及有效数字 `KM`。
  信息节点可不在根。缺失/未知规则或缺贴目须补齐文件重传，不猜测、不提供补齐表单。
- **仅基础回放校验，不是完整中国/日本规则裁判**：交替行棋、当前占点禁入、先提敌方无气链再判己方无气（禁止自杀）、简单劫禁止立即还原对方上一着之前的盘面。
  提空的历史落点可以再下。落子形成非立即全盘历史重复时仅报“暂不支持该循环规则”，不判其在所有规则下非法或自动无胜负。
- `B[]` / `W[]` 和19路的 `tt` 是 pass，计一手；pass 自身不参加循环拒绝。
  连续 pass 不让应用推断真实结束；不校验停止后死活确认、恢复对局等程序，不计分、不裁判终局争议。
- `AB/AW/AE` 可在根及第一手之前的多个节点设置/覆盖/清空初始盘面；支持矩形展开。
  同节点不得重复/交叠，禁止越界、反向或一格矩形；setup 与 move 不同节点。
  初始最终盘面不能有无气链。途中 setup/PL 明确拒绝。
- `HA` 仅记录，不按星位自动摆子，不要求 AB 个数等于 HA；有限范围接受 0 或2—361整数。
  HA≥2 默认白先，否则黑先；第一手之前最后一个 `PL[B/W]` 可覆盖初始行棋方。
  setup 不计手、不计提子。只知道提供的初始局面，不臆造其之前的历史。
- 结果仅展示 `RE` 原记录，缺失显示“未记录”，不据文件真假推断胜负/实际是否已结束。
- 编码：`CA[UTF-8]`、`CA[GBK]`、`CA[ISO-8859-1]` / `CA[latin1]`（大小写不敏感）。
  无 CA 使用真正 Latin1，保留 0x80—0x9F，不用浏览器 Windows-1252 别名。
  严格解码后才处理 SGF 转义；仅接受与自身根 CA 一致的候选，不按昵称猜编码。未知 CA、坏 UTF-8/GBK 字节拒绝。
- 最大 **1 MiB、2000 个节点**（含注释和 setup）。读取前检查 File.size，解析时在生成棋盘快照前限制节点数；帧数不超过2000，每帧361点，避免无上限复制盘面。

### 属性白名单与明确拒绝

处理棋局的属性：`FF GM SZ CA B W AB AW AE PL RU KM HA RE PB PW`。
接受但不参与棋盘/计分且暂不显示的描述性属性：
`BR WR BT WT GN GC DT EV RO PC SO US AN ON TM OT C N AP ST`。
`AP` 限 `应用名:版本`，不支持字段内冒号；`ST` 限0—3。
除了 setup 点列表，支持的属性均为单值；属性重复、根属性出现在非根、多个 game-info 节点均拒绝。
所有其他属性（包括 `KO`、标注/时间剩余等当前未实现属性）明确报不支持，不静默丢弃后称成功。
这是应用子集限制，不代表这些文件违反 SGF 标准；不是通用 SGF 编辑器或完整标准认证器。

## 依据与验证

[浏览器样例独立核验说明](tests/fixtures/README.md) 列出每步坐标、气与提子依据；全部为自制样例，无私人棋谱。
[实施记录](.scratch/go-coach/01-implementation-log.md) 区分实际 RED/GREEN、新增回归验证与未验证事项。

- [SGF FF4 语法、属性类型与 Real](https://www.red-bean.com/sgf/sgf4.html)、[属性定义](https://www.red-bean.com/sgf/properties.html)、[围棋属性](https://www.red-bean.com/sgf/go.html)。SGF 能记录非法着；产品拒绝非法落子是额外校验，不能把格式可解析当棋局合法。
- [中国围棋协会规则](http://wqwh.weiqi.org.cn/rules/) 第3—5、20条支持基本提子/禁着/立即回提/pass 的核验。
  **协会网页未标年，不能称已逐字核实2002版**；未核实野狐具体执行细则。
- [日本棋院1989规则全文](https://www.nihonkiin.or.jp/match/kiyaku/zenbun.htm) 第3—6、9条；
  [第11—12条官方解说](https://www.nihonkiin.or.jp/match/kiyaku/kiyaku11-12.html) 解释循环与双方同意无胜负。
  两个 RU 标签不能唯一确定版本、赛事细则或停止后程序；上述有限支持不宣称全部国家规则兼容。

浏览器测试不会替代真人教学验收、真实平台兼容或完整棋规裁判验证。
