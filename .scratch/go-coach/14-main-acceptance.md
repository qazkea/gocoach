# 14：主代理桌面验收

Execution: done

## 最终结论（代码fa3a620，本机Windows x64桌面宿主切片）

- 最终代码 `fa3a620fa4b1924701de5bbda6bc8b51b4912941` 已快进整合，代码/测试工作区干净。原三个P2与首窗前失败留空进程P2全部关闭。
- **Spec**：`47d5dec1-1216-4a2`复审无确认缺陷；**Standards**：`531ac51c-568f-476`复审无确认缺陷。均Astra/Medium、只读独立审查；不把静态审查算测试。
- 主代理在整合后独立 `npm.cmd run test:desktop`（含typecheck/build/真实pack）：**30 passed，0 failed，0 skipped，2.1分钟**。再独立网页回归（自有5194）：**110 passed，0 failed，0 skipped，2.7分钟**；另typecheck/diff-check通过。日志 `D:/code/tmp/go-coach-notes/desktop/main-fa3a620-{desktop,web}.log`；截图/原生dialog选项/进程记录在`main-fa3a620/`。实际查看最终GPU两张全页及错误窗口截图。
- 主代理检查退出记录：29份fixture记录含31次应用退出，26次正常0、5次明确异常1、survivors全部空；额外直接启动smoke/early-quit/坏包由各测试检查。异常故障注入与显式exit1不是正常回收保证。自有5194及最终GPU随机58627均已释放；最终目标exe无存活进程，未停止用户5173。

### 已核对的交付包

`D:/code/tmp/go-coach-desktop/windows-x64-fa3a620/Go Coach.exe`

- 必须保留整个目录：**89文件，386,457,432字节（约368.6MiB）**；exe247,033,344字节。Electron44.8.0、内置Node24.22.0，builder26.15.3；未签名、未发布、非单文件安装器。
- 主代理从自己刚通过30测试的完整包独占复制到上述持久目录，89文件逐字节SHA-256相同，18个app资源严格白名单并核对源码/构建结果，无operator/模型/测试/源业务文件/.scratch/密钥。清单 `D:/code/tmp/go-coach-notes/desktop/main-fa3a620-package.json`。
- 首次比较实现者候选与主构建包时精确摘要不相等，已确认**仅desktop三个mjs的LF/CRLF差异**（21/75/133字节），其余86文件完全相同，三文件统一行尾后全文相同；不是代码回退。保留实现者原包不覆盖，以主代理新复制的精确同字节目录作为交付包，不谎称两份原包全字节相等。

### 最终目录包真实GPU复测

证据 `D:/code/tmp/go-coach-notes/desktop/main-gpu-final-fa3a620/`，脚本 `D:/code/tmp/go-coach-notes/desktop/main-real-engine.mjs`。

- 从上述持久exe、非项目cwd、隔离userData、移除外部Node/npm产品PATH启动，原生菜单选已有operator（仅平台dialog返回受控）。KataGo v1.18.1 OpenCL+b18、原home缓存，无新模型/驱动下载。
- Chinese提子/pass **5/5局面，4.420秒**；Japanese HA2白先/pass **4/4局面，2.368秒**。总9/9成功，同引擎会话。逐步核对真实HTTP完整历史/初始方/RU/KM/HA、root和候选/PV显示、双方变化符号、缓存不重发，提子1与白pass/让子木质棋盘正确。
- 主应用PID28440、真实KataGo27460及记录的所有自有PID+创建时间均消失，正常退出0、无兜底强杀；原operator摘要未改。运行snapshot指向独立userData，recordSyntheticEvidence=false，analysis配置明确禁完整请求/响应日志。
- 采集仅将真实HTTP流在平台I/O原样缓冲回传，未伪造结果或替换业务；耗时含采集，**不是性能基准，也不是原始引擎协议日志独立核对**。13已有原始协议实测，本票未改分析序列化/结果校验。此前两次候选GPU预验不重复计入此最终9局面。

### 交付边界与保留风险

- 本票仅Windows本机桌面宿主完成：导入、自动整局本地估值、逐手候选/变化与退出管理。**DeepSeek中文讲解尚未接入；仍是长页面，不是紧凑桌面UI或整体中文教练完成。**
- 原生文件选择器人工操作、人工双击/SmartScreen、真实UNC共享、跨机器兼容、主进程硬杀/OS关机/断电仍未验收；未签名可能有系统提示，不建议绕过保护。用户双击试用另验。
- 历史Playwright宿主0xC0000409仍原因未知，最终单轮30全过不宣称已根治。npm audit的8个moderate构建链依赖告警保留（无high/critical，不随资源白名单进入app），未擅自升级。
- 不曾读取DeepSeek Key、传私谱、在线推理或付费，不push/发布；完整2000局面扫描、真实野狐兼容、真人学习效果不在本票证据内。

以下保留候选阶段的历史过程；其中“待修复/下一步”由上述最终结论覆盖。

## 候选与独立验证

- 初始候选代码 `3c54fe9cd51d67464ee33722d54548afb8f69a4c`，来自保留worktree `C:/Users/789/AppData/Local/Temp/pi-agent-ddfe4e74-df37-42c-b73f6747`、分支 `implement/windows-desktop-sol`。已快进整合，但**不是最终验收通过**。
- 主代理阅读实际19文件diff、desktop三个运行mjs、服务关闭/静态根差异、package/lock、测试fixture及实施记录；实际查看两张实现者截图。持久候选 `D:/code/tmp/go-coach-desktop/candidate-14-sol/` 的三个desktop源码与提交一致，应用资源目录仅18个产物/元数据文件，外层Electron完整目录89文件、386454700字节。
- 主工作区独立 `npm.cmd ci`、typecheck成功；npm提示8个moderate依赖告警，未执行audit fix或无关升级。未据此宣称依赖无漏洞。
- 在3c54fe9上主代理执行 `npm.cmd run test:desktop`（build/pack真实exe）：**19 passed，0 failed，0 skipped，1.4分钟**；证据 `D:/code/tmp/go-coach-notes/desktop/main-3c54fe9/`。
- 同代码 `GO_COACH_TEST_PORT=5194; npm.cmd test -- --workers=4`：**110 passed，0 failed，0 skipped，2.4分钟**；diff-check通过，5194无监听，未操作用户5173。

## 独立审查仍需修复

Spec reviewer a46588d1-fb92-423 与 Standards reviewer 1dba441e-41b9-47d 均使用GPT-6.1-Sol/max，分别报告：

- **Spec P2**：首次loadURL尚未完成时菜单可choose；批准配置会替换导航，旧加载的reject误落入启动catch并退出。
- **Standards P2**：Windows isAbsolute接受根相对路径，主与utility cwd盘符不同可使确认/实际运行文件不同。主代理另用只读Node探针确认`\\local\\katago.exe`在D/C cwd解析不同。
- **Spec/Standards共同P2**：stop丢弃utility退出码，quitting同时屏蔽异常；bootstrap close失败消息无主端接收。故不能确认回收却可按正常退出。

主代理已核实三项，更新14-design补充边界并提交 `89d6d6666ef02fb6649384726a98bd04be16b278`；委派 implementer **94af6ebb-ba4c-4ab**（desktop-review-fix，GPT-6.1-Sol/max）在原worktree修复。以上19/110不覆盖缺陷，不能据此勾done。修复需先合最新主分支文档、真实exe RED→GREEN、全量复测、保留新候选目录不覆盖旧证据。

## 修复候选复审与主代理预验（0117b65，仍非最终验收）

- 用户把所有子代理改为 **Astra/Medium**，配置文档 `d4f95bf`；独立Spec `19fc3512-977c-411`确认原三P2关闭，Standards `73307c1a-af2a-491`另发现首窗创建前桥失败后选择“保留窗口”实际无窗口、无法再操作退出。主代理读完整main确认，委派 `33d9c3e8-f6fd-4f5`修复：先创建安全纯静态中文错误窗口，默认保留后仍可通过原生菜单/关窗明确选择退出1。
- 修复代码 `f3faeffb60ef5bd5c03b2013eeed4e5edbb9c4b0` 与新模型文档已由implementer整合，主/候选同HEAD `0117b65502f5137995438ff4b4fa40fec8846442`，整合时双方clean。
- 主代理在0117b65独立网页回归：**110 passed，0 skipped，2.5分钟**，自有5194已释放。日志 `D:/code/tmp/go-coach-notes/desktop/main-0117b65-web.log`。首次desktop命令的PowerShell Stop＋2>&1/Tee-Object将esbuild正常stderr视作NativeCommandError，打包/测试尚未完成；这是命令包装错误，不是产品RED或完整测试结果，失败日志保留。后续采用cmd直接重定向，不修改产品迎合包装。
- 主代理既有持久包 `candidate-14-review-fix-2026-10-17T17-14-12-354Z/Go Coach.exe` 已跑**真实GPU预验9/9局面**（Chinese提子/pass 5局面5.463秒；Japanese HA2白先4局面2.393秒）。脚本核对真实HTTP完整前缀、显示root/前10候选/PV/双方估值变化与回看缓存；实际KataGo进程28936、应用31548及全部确切自有进程均退出，exit0、无兜底强杀，原operator摘要不变，独立userData且禁止私谱日志。产品PATH没有外部Node/npm，非项目cwd，Electron44.8.0/内置Node24.22.0。证据 `D:/code/tmp/go-coach-notes/desktop/main-gpu-preflight-f3faeff/`；主代理已看提子桌面全页截图。此为前一候选预验，**最终修复包仍须复跑**，不能据此勾done。
- `npm audit --json`（只查询、不fix）仍报告8 moderate、无high/critical，集中在electron-builder及其下载/日志传递依赖；完整报告 `D:/code/tmp/go-coach-notes/desktop/main-dependency-audit.json`。这些构建依赖不进入资源白名单，仍如实披露而不宣称无漏洞；未做无关升级。

## 历史：验收准备

- 主代理真实GPU桌面脚本已写 `D:/code/tmp/go-coach-notes/desktop/main-real-engine.mjs`，已完成前一候选9局面预验；参数为真实exe与全新证据目录。最终仍在最新修复完成、复审和整合复测后再运行。
- 计划选既有operator配置，通过真实原生菜单（自动化仅替换平台dialog返回）启动既有KataGo+b18；合成提子/白pass及Japanese HA2白先短谱共9局面，逐手核对HTTP完整前缀、真实UI root/候选/PV/符号/缓存，再原生关窗验证所有确切自有PID+创建时间均消失。
- 为保持桌面正式路径禁私谱请求日志，脚本不启用recordSyntheticEvidence；仅在外部平台I/O将实际同源分析流原样缓冲回传以保存HTTP结果。需明确这会延迟状态流呈现，耗时含采集开销，不能冒充原始KataGo stdin/stdout日志独立比对。13已有原始协议真实验收，本票未改分析输入/核验。
- 最终仍须在修复提交上独立重跑desktop全部及110网页、查看实际GPU截图、核对最终完整目录包hash/资源清单并记录真实运行/退出及限制。未人工测原生Windows文件选择器、双击/SmartScreen；DeepSeek不在本票，未联网/读Key/付费。
