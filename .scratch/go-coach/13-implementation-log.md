# 13 实施记录：整局本地扫描

Execution: in-progress

实现子代理交付，等待主代理独立 Spec / Standards 审查、整合复测及授权合成谱 GPU 验收；未标 done。

## 基线和边界

- 隔离 worktree：`C:/Users/789/AppData/Local/Temp/pi-agent-20296e9f-ca70-4f1-ad8c8040`。
- 初始基线 `fe027504cee26084bb3b48727f1a2a6842af08e6`；按主代理补充指示，提交前 `git merge --ff-only integration/go-coach` 更新至 `cdc97e8`（只新增14桌面研究文档）。没有实现14、安装Electron或修改主工作区。
- 已完整读取任务13、13-design、desktop-review-scope、项目工作流/领域/术语表及指定主工作区 TDD SKILL/tests/mocking；`docs/adr/` 不存在，未创建。
- 唯一业务测试 seam 为真实浏览器完整流程；只控制外部引擎进程。新增测试不 mock 内部函数、不用 window 业务侧通道、不以业务函数重算预期。
- 从已有本地 node_modules 复制依赖到本 worktree，无新增依赖/联网下载。未访问Key、未调用在线AI、未启动真实GPU、未推送。

## 修改

- `src/FullGameReview.tsx`：上传代次范围内的顺序队列、当前/前帧优先、暂停与显式恢复、失败重试、缓存、session变更清空、BLACK走势/文字估值、键盘逐手入口、实际执棋方前后变化、当前局面候选及真实未接入说明。
- `src/analyze.ts`：扫描使用现有 token/analyze NDJSON 协议；底层棋规与旧手动面板状态机未重写。
- `src/main.tsx`、`src/style.css`：默认可见自动扫描开关、隐私文案、独立上传key、窄窗可换行区域。
- `src/engine.ts`、`server/katago.ts`、`server/position.ts`：KataGo最终已核验结果附服务实例UUID＋实际进程generation。position结果核验本身不改；engineSession不从客户端或引擎响应获取。
- `server/index.ts`：受既有Host/Origin约束的只读能力GET；只增 `FullGameReview.tsx` / `analyze.ts` 精确白名单。
- `tests/full-game.spec.ts`：14条真实浏览器测试；`tests/scripted-engine.mjs` 提供独立已知root、一次失败/重启、12合法候选场景；`tests/engine-fixture.ts` 增加无配置/坏配置测试环境。
- 旧 `engine.spec.ts`、`board-engine-visual.spec.ts`、`real-engine-browser.mjs` 在上传前用真实UI取消auto，保留手动路径原断言。
- 旧 `guided.spec.ts`、`selection.spec.ts`、`variations.spec.ts`、`import.spec.ts` 精确改动态origin，仅额外允许同源、无body的能力GET，不放行任意api。
- `playwright.config.ts` 支持 `GO_COACH_TEST_PORT`，默认5173，仍 `reuseExistingServer:false`；README同步说明。

## 实际 RED → GREEN

每次先加一条浏览器纵切测试，运行观察失败，再实现并复跑，没有批量预写所有测试：

1. 上传四手短谱自动N+1完整前缀/提子/pass/不含身份：RED 找不到“整局复盘”；最小队列及能力端点后 GREEN。中间发现测试误把HTTP pass预期写成空串，按已有协议改为字面量 `pass`，未改业务序列化凑绿。
2. 独立root固定为 P0=0.60/+2.5、P1=0.45/−1.5、P2=0.30/−5.5：RED 缺少键盘定位按钮；实现后黑手15百分点/4目，白手−15百分点/−4目、当前候选与回看缓存 GREEN。预期为手算常量，不调用计算函数。
3. 慢外部引擎下快速切手：RED 实际顺序 `[0,1,2,3,4]` 而非 `[0,4,3]`；实现下一任务重排、暂停/显式恢复后 GREEN。暂停期间0与4已成功，图仅两点、零连接线；未齐全不算差值。
4. P1处引擎崩溃：RED 重试仍拼接旧P0，缺少会话变更提示；服务生成session及缓存隔离后 GREEN，实际请求 `[0,1,1,0,2]`，两个真实脚本进程。
5. 12合法候选：RED 缺总数/丢弃说明；缓存裁剪和计数后 GREEN，显示10且丢弃2。
6. 窄窗检查：RED 390宽页面scrollWidth为1037；整局区域 `overflow-wrap:anywhere` 后 GREEN，桌面/390截图均保存并实际打开查看。

之后新增换谱迟到成功/失败、多标签、不同RU/KM/HA/初始方、条件拒绝、手动竞争/并存、缺配置/坏配置、2000局面入口边界、同会话失败恢复回归。这些对已实现行为首跑通过，不虚构RED。

## 回归中发现与修复

首次全套暴露React同级key冲突：Course与FullGameReview同用上传数字key，教学区域重复/卸载异常。保留旧断言，给新module增加独立 `review:` key前缀，恢复旧教学流程。

前两次全套命令外层限时180秒提前结束（其中第一次另含上述真实回归失败）；旧1997次真实点击的2000帧测试需约2.6分钟，不能将这些未完成运行称全绿。改为外层300秒，不改测试断言/内部时限后，全套完成。

## 最终实际验证

2026-10-17，本worktree，`GO_COACH_TEST_PORT=5191`（启动前确认无监听）：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过（浏览器39 modules及Node bundle）。
- `npm.cmd test -- --workers=4`：**110 passed，0 failed，0 skipped，约3.6分钟**（原96＋新增14）。最新完整运行是在合入cdc97e8后。
- `git diff --check`：通过；只有Windows LF→CRLF提示，无空白错误。
- 最终测试输出：`D:/code/tmp/go-coach-notes/full-game/implementer/browser-final.log`。PowerShell合并stderr时将esbuild正常stderr标作NativeCommandError文本，但命令实际退出码0，Playwright110全部通过。
- 截图命令：设置 `FULL_GAME_SCREENSHOTS=D:/code/tmp/go-coach-notes/full-game/implementer` 后运行 `npm.cmd test -- tests/full-game.spec.ts -g BLACK走势 --workers=1`。
- 已实际读取/查看 `review-1440.png`、`review-390.png`：选择第1手、黑方走势与15百分点/4目、候选/条件、未接入中文说明、原谱木质棋盘可见；390窗不横向溢出。当前是长页面独立区域，不冒充已完成桌面紧凑布局。

## 清理证据

- 所有引擎fixture在finally执行既有回收断言：服务优雅退出（非SIGKILL兜底）、捕获的每个引擎PID均已死亡；最终110条均通过这些断言。
- 最终检查 `2026-10-17T11:58:58+08:00`：5191监听数组为空；命令行包含本worktree的node进程数组为空。
- 未停止或更改用户5173；没有使用GPU或外部Key。无本次需遗留的服务进程。

## 未覆盖/未完成

- 新容量测试导入2000局面、验证逐手入口/单在途后暂停，并验证2001节点拒绝；**未完成2000局面全扫描**。旧2000帧手动变化1997点击边界完整执行通过。
- 未验证真实GPU整局耗时/质量；由主代理整合后使用已授权合成短谱核验。
- 未重新运行旧14次真实GPU手动脚本，仅更新其UI关闭auto步骤；不将受控引擎当真实性能证据。
- engineSession覆盖真实脚本进程重启、同进程失败恢复；未在浏览器测试中强制重启整个Node服务并维持同一页面。服务实例UUID代码隔离仍需独立审查。
- 不跨标签共享缓存/调度、不持久化；完整引擎候选/PV仍先按既有边界核验，再仅缓存前10。
- Windows桌面、DeepSeek讲解、外发/费用授权、真人教学效果不在本票交付中；任务保持in-progress。
