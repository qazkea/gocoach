# 14：主代理桌面验收（进行中）

Execution: in-progress

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

## 下一步验收准备

- 主代理真实GPU桌面脚本已写 `D:/code/tmp/go-coach-notes/desktop/main-real-engine.mjs`，尚未运行；参数为最终真实exe与全新证据目录。只在修复完成、复审和整合复测后运行。
- 计划选既有operator配置，通过真实原生菜单（自动化仅替换平台dialog返回）启动既有KataGo+b18；合成提子/白pass及Japanese HA2白先短谱共9局面，逐手核对HTTP完整前缀、真实UI root/候选/PV/符号/缓存，再原生关窗验证所有确切自有PID+创建时间均消失。
- 为保持桌面正式路径禁私谱请求日志，脚本不启用recordSyntheticEvidence；仅在外部平台I/O将实际同源分析流原样缓冲回传以保存HTTP结果。需明确这会延迟状态流呈现，耗时含采集开销，不能冒充原始KataGo stdin/stdout日志独立比对。13已有原始协议真实验收，本票未改分析输入/核验。
- 最终仍须在修复提交上独立重跑desktop全部及110网页、查看实际GPU截图、核对最终完整目录包hash/资源清单并记录真实运行/退出及限制。未人工测原生Windows文件选择器、双击/SmartScreen；DeepSeek不在本票，未联网/读Key/付费。
