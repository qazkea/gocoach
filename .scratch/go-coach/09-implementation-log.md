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
