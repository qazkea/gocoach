# 17 单棋盘工作台实施交接记录

Execution: in-progress（实现交回主代理，未独立审查/验收，不关闭任务）

## 接续与提交

唯一写入工作树：`C:/Users/789/AppData/Local/Temp/pi-agent-7ec2fc37-62c9-470-22e31f67`；分支 `implement/17-single-board`。接手 HEAD 为 `80f4de9c43c8d131d880427db5040390713c3546`，24份既有源码/测试改动保留，没有重写、reset或clean。

- `7ba5b44`：先保存上述24份改动的安全WIP checkpoint。
- `7205558`：接续全量回归发现默认720px高窗口棋盘仅340px，既有断言要求至少350px；仅将原谱棋盘高度预算从减380px改为减370px，没有降低断言。
- `48ea3bf`：先提交自身变更，再合入 `integration/go-coach` 的 `3853e082a3d7a9b7a2e000b3d408abbba50baa36`。只带入21资料核查文档，无冲突；随后重跑构建、完整网页及重新打包桌面。

## 实施范围

保留旧代理完成的实现：`src/main.tsx` 明亮棋馆双栏/窄窗页签与独立教练草稿宿主；`EnginePanel.tsx` 单盘回放、同起点S/A、合法独立PV、自由试下与返回；`FullGameReview.tsx` render-children共享只读分析快照，扫描不随页签重挂；`ReviewEvidence.tsx`复用真实HTTP核验hook；`GoBoard.tsx`非落石标记；`TeachingPanel.tsx`独立预设教学入口；`style.css`布局/焦点/状态。

新增 `tests/workspace.spec.ts`、`tests/workspace-ui.ts`、`desktop-tests/workspace.spec.ts`；迁移既有入口/折叠定位器：tests下board-engine-visual、board-visual、engine、evidence、full-game、guided、import、selection、session-watch、variation-evidence、variations及scripted-engine；desktop-tests下config、evidence。未改棋规、引擎协议调度、凭据、CSP或依赖。

## 历史RED/GREEN与本次区别

旧证据原样保留于 `D:/code/tmp/go-coach-notes/17-implementation-80f4de9/implementer/`。核对日志可见：01单盘、02同起点、03 PV、04试下、05页签草稿、06过期拒绝各有失败与后续通过。03-green.log本身仍为3失败，实际后续通过在03-green-final.log。07-red和07-green均失败：旧测试曾错误期待空候选成功，而真实协议拒绝noResults；现测试尊重既有协议，检查失败可见且不造A。不能仅凭文件名称07已经GREEN。

旧desktop-1.log为57 passed；旧web-final未确认最终汇总，不作为本次完整回归证据。白方PV、迟到核验、低矮放大等接手时已写好，本次只实际回归，不能追称本次逐项RED。

本次真实RED为web-1.log：158 passed、1 failed，默认回放棋盘宽340低于既有350断言。最小CSS修复后targeted-green.log为17 passed，测试断言未改。

## 接续实际命令与结果

所有shell先Set-Location到唯一工作树。新证据根目录：`D:/code/tmp/go-coach-notes/17-implementation-80f4de9/recovery/`。

| 命令 | 结果 | 日志 |
| --- | --- | --- |
| npm.cmd run build | exit 0 | build-1.log |
| GO_COACH_TEST_PORT=5199; npm.cmd test -- --workers=2 | exit 1，158通过/1失败 | web-1.log |
| npm.cmd test -- tests/board-visual.spec.ts tests/workspace.spec.ts --workers=2 | exit 0，17通过 | targeted-green.log |
| 合入integration后 npm.cmd run build | exit 0 | build-final.log |
| GO_COACH_TEST_PORT=5199; npm.cmd test -- --workers=2 | exit 0，159通过，0失败/跳过 | web-final.log |
| npm.cmd run test:desktop | exit 0，新构建并打包exe，57通过，0失败/跳过 | desktop-final.log |
| 主目录技能 scripts/impeccable.cmd detect --json <本工作树>/src/ | exit 0，输出[] | detector.json |

网页真实浏览器与HTTP，桌面真实新打包exe；仅既有外部引擎与平台I/O替身，合成谱、隔离userData，凭据回归仅用测试合成Key。未读真实Key/私谱、未真实推理/embedding/GPU；未触碰5173，无push/发布。构建打包可取得既有资源，不宣称全过程零网络。5199启动前无监听，未杀未知进程。

## 截图实际核对

设置WORKSPACE_SCREENSHOTS到recovery/visual-final，完整网页回归生成并逐张打开核对11张：workspace-1440x900、workspace-1280x900、workspace-920x720、workspace-390x844；coach-920x720、coach-390x844；comparison、pv、trial、details-focus、import-error（均.png）。

实际看到：浅灰青工作底、淡砂棋盘、白色教练面；宽窗双栏、窄窗页签；回放与紧凑走势、草稿可达；S/A为落子前标记，PV显示编号、试下显示不同来源；详情焦点环可见，详情在左区内部滚动时棋盘移出可见区，右侧输入位置不动；导入错误置于上方并显示空导入说明，没有假AI回复或假发送。对照主目录daylight.png/html核对了构图，没有照搬示例棋序或假聊天。

另逐张打开新exe的 `recovery/desktop/真实打包工作台单盘对照试下返回与窄窗草稿/` 中 comparison、narrow-coach、narrow-trial、returned：单盘、窄窗保留草稿/试下、返回原谱可见。桌面初始外窗1280×900对应内容截图1264×835，不冒称为网页1280×900内容区。窄窗试下底部可内部滚动，不声称全部详情首屏同显。

这是实现者核对，不是独立视觉验收。detector无发现不证明所有对比度/可访问性或棋理正确。

## 未覆盖与交回

- 独立Spec/Standards、独立视觉审查、主代理整合复测尚未进行，任务保持in-progress。
- DESIGN.md与sidecar按约定留给最终独立视觉验收后的documenter，未预写。
- 本次尺寸/状态截图齐备；低矮1280×600、920×480与20px根字体由真实UI测试覆盖，但未另存截图；不是操作系统DPI/浏览器全倍率缩放矩阵。
- 真正长聊天、消息滚动/队列/持久化与模型输出由18/19等后续票验收，本票只有不保存、不发送的草稿及诚实未启用说明。
- 真实引擎质量、教学棋理、野狐兼容性、真实GPU和真人学习效果未测，不作完成声明。

## 第一轮审查修复（本次接续）

从干净 `d7931c1` 接手，先 fast-forward 到仅增加审查记录的 `589c88c1182f1c02118a562dbdf2a2bef5cb9fd0`。仍仅写上述 implement/17-single-board 工作树；未操作主目录用户配置、冻结审查树或旧截图 archive。

### 两项修改

- `useReviewEvidence.load(onVerified)` 提供一次成功 DTO 回调，不等待长期 watch 结束，也不读取 setState 后的旧闭包。两个 PV 展开入口均重新请求真实 HTTP，成功且仍为当前 epoch 才展开本次 DTO 的 PV。10 秒截止覆盖 token/watch/查询交付；失败清除有效 A，不补算或自动重试。保留 watch、取消、会话失效语义。
- `WorkspaceBoard` 返回原谱、切换对照和进入试下时同步取消核验；试下时停止对照观察。切手/换谱仍使用原有选择挂载隔离；成功/失败迟到不改变新状态或试下来源。未改16缓存、服务端协议或 TTL。
- `FullGameReview` 增加可见“黑方胜率”和“原谱第 k 手 · 值/未知”；走势图用三角＋虚线定位当前原谱手，始终不是 PV/试下估值。维持紧凑布局，未缩小棋盘或放宽尺寸测试。定位用 SVG path，与数据连接 line 分开，未知区段仍不连接。
- 网页增加两个已显示 A 后 TTL 入口、真实响应门控迟到成功/失败×试下/返回/切手/换谱、有界等待及走势可见语义回归。门控均 route.fetch 取得真实响应后延迟交付，不 mock 核验 JSON、不改 cache。桌面既有工作台测试补充 PV 展开和走势文字/标记检查。

### 本次 RED / GREEN 与完整回归

新日志独立保存于 `D:/code/tmp/go-coach-notes/17-review-fixes/`，没有覆盖 recovery 旧测试日志。

| 日志 | 实际运行与结果 |
| --- | --- |
| ttl-red.log | workspace `-g 已显示A后过期`，2失败：旧实现仍展开 PV，无过期提示 |
| ttl-green.log | 相同2测试，2通过 |
| late-red.log | fresh 核验门控后切模式，1失败（试下来源被迟到 PV 污染）、2通过（返回/切手本已保护） |
| late-green.log | 同组3通过；一次含竖线的 npm.cmd grep 命令未启动测试，随即修正单模式命令后重新记录 |
| trend-red.log | 1失败：找不到可见“黑方胜率” |
| targeted-green.log | workspace＋board-visual，23通过；当时尚未扩展完整迟到矩阵/有界等待 |
| build.log | npm.cmd run build，exit 0 |
| web-full.log | 首轮完整网页170项：169通过/1失败；旧未知区段测试把新增定位 line 算为数据连接，改定位为 path 后保留原断言 |
| desktop-full.log | npm.cmd run test:desktop，重新build/打包exe，57通过，0失败/跳过；打包实际下载了开发用Electron资源，不声称全程零网络 |
| web-final.log | GO_COACH_TEST_PORT=5199 npm.cmd test -- --workers=2，171通过，0失败/跳过 |
| detector.json | 主目录只读技能执行 detect --json src/，本轮一次，exit 0，输出 [] |

新增完整迟到失败/换谱矩阵、有界等待和桌面断言作为后续回归通过，不把它们全部追称独立 RED。未改凭据/CSP、棋规、引擎协议或依赖；仅合成谱、隔离 userData、既有外部引擎/平台 I/O 替身，无真实 Key/私谱/模型推理/embedding/GPU。仍不提供真正聊天。

### 新截图

网页完整回归重新捕获 canonical `D:/code/tmp/go-coach-notes/17-implementation-80f4de9/recovery/visual-final/` 全11图；PV截图新增等待实际展开断言，避免异步核验时拍到加载态。新exe截图先保存在 `17-review-fixes/desktop/真实打包工作台单盘对照试下返回与窄窗草稿/`，再仅复制4张PNG到原 canonical recovery/desktop 同名目录，不改旧测试日志。

已实际逐张打开11＋4图核对：1440/1280下走势标题、原谱手数和三角虚线可见，首屏趋势和输入保留；390窄屏趋势换行仍可见；920标签、草稿、对照、PV编号、自由试下、返回原谱、详情焦点和导入错误均为实际渲染。桌面默认内容图1264×835，窄窗试下底部仍需内部滚动。参考daylight浅灰青/淡砂/白面方向未变。此为实现核对，不是独立视觉verdict。

保留 in-progress。独立 Spec/Standards/finish reviewer 复核、主代理整合复测与验收仍待执行；DESIGN.md 留待主代理另派，不标 done、不 push。

### 提交与合基线后复核

代码提交 `0ddf1176683879e5d83889033c5c3881ee20e3fe`（implement/17-single-board）。随后 `git merge --no-edit integration/go-coach` 返回 Already up to date；integration 仍为 `589c88c1182f1c02118a562dbdf2a2bef5cb9fd0`，已包含，无冲突。

- `GO_COACH_TEST_PORT=5199 npm.cmd test -- tests/workspace.spec.ts tests/board-visual.spec.ts tests/full-game.spec.ts tests/evidence.spec.ts tests/session-watch.spec.ts tests/variation-evidence.spec.ts --workers=2`：78通过、0失败/跳过，`post-merge-affected.log`。
- `npm.cmd run test:desktop -- desktop-tests/workspace.spec.ts`：再次build/打包，1通过、0失败/跳过，`post-merge-desktop.log`；此次附加截图在 `post-merge-desktop/`。canonical 15图仍为同一源码版本的完整网页/桌面回归截图，已逐张打开核对。
- 本段只是提交后的证据追加，未再改变源码或测试；最终交付提交与日志对应见外部证据目录 `handoff.md`。
