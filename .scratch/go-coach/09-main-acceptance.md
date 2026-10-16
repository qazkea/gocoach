# 09：主代理独立验收记录（仍在进行）

## 42c5205 候选

代码已整合到 integration/go-coach；以下命令和核对由主代理实际执行，不是转述实现代理结果。

- `npm.cmd run typecheck`、`npm.cmd run build`、`git diff --check`：通过。
- `npm.cmd test`：90条中 **89通过、0失败、1跳过**，约2.2分钟；跳过的是Windows真实EPIPE，不能算通过。
- `node tests/fixture-resource-check.mjs <scenario>`：timeout / exit / disconnect / nofork / spawn-error 五个外层检查退出0，各自记录 `alive:false,tempExists:false`。嵌套Playwright启动失败是注入预期，不是正常套件通过。尚未覆盖该检查脚本自身的45秒超时（见复审）。
- 已授权本地KataGo，`GO_COACH_CONFIG=.../web/main-acceptance-42c5205/local.json`、`GO_COACH_EVIDENCE=.../web/main-acceptance-42c5205/browser`，执行 `node tests/real-engine-browser.mjs`：**14次真实浏览器合成分析全部完成**。没有下载新引擎、模型或系统依赖，没有上传棋谱或调用在线AI。
- 完整证据根：`D:/code/tmp/go-coach-runtime/katago-1.18.1-opencl/web/main-acceptance-42c5205/`。原probe、acceptance-4及实现代理证据未覆盖。五个fixture日志在根目录；真实页面、HTTP输入、引擎原始日志和退出记录在browser目录。
- 实际server47120/engine48520正常退出，exit.json为code0、success:true、remaining:[]；主代理另查两PID已不存在。

### 真实浏览器核对

覆盖非示例原局与分支重复、白轮BLACK估值、双方连续试下、撤回后替换未来、Chinese/Japanese、HA2及HA0、同盘不同简单劫历史。主代理抽看白轮分支完整截图，确认变化盘有新增黑dd、原盘未改及两种盘面/条件分列；这不是界面易用性或真人学习效果验收。

主代理逐条从原始日志对照14个浏览器HTTP输入与14个引擎请求/最终响应：自行将SGF点转换GTP，核对完整moves、setup、初始玩家、贴目、计分profile，以及响应ID/步数/当前玩家；页面四舍五入后的黑方根胜率、目差及实际visits与原始输出一致。记录在browser/main-wire-check.json。初次核对脚本未去除CRLF导致匹配不到记录，另一次失败后读取未保存的暂存值也失败；修正日志行trim后核对通过，均是验收脚本问题，不是产品RED。

- 原局首次3.443秒（含启动），重复0.137秒；引擎ready 2.637秒。使用已有OpenCL调优缓存，不能称首次冷启动。
- 白轮分支首次0.865秒，重复0.159秒；其余样例0.130–0.914秒。
- 原局黑胜率67.828750% → 67.581901%，目差1.961483 → 1.947449；白轮分支黑胜率60.679531% → 60.634428%，目差1.153166 → 1.153836。两个重复对的首候选分别保持Q4/Q16，其他排序/数量有变化；不能据此宣称稳定最强。
- 配置maxVisits100、maxTime2秒、analysisPVLen15；页面如实显示实际101 visits及含首着PV最多16。此次真实样例最长PV9着，16/17边界来自受控合法序列，二者不能混同。
- Chinese HA2为whiteHandicapBonus N，Japanese HA2/HA0为0；明确近似profile，不代表完整规则或野狐认证。

### 双轴复审待办

**Spec**：原分析进程清理所有权和16/17边界静态审查无新增确认缺陷；Windows EPIPE仍缺真实复现。另确认P2：读取配置后未及时检查closing/代次，且version的execFile子进程未纳入关闭等待，可能在退出期间启动或遗留。已交实现者以外部迟缓version进程补浏览器/平台回归。

**Standards**：原fixture启动finally已修复，无额外启发式建议；另确认P2：`fixture-resource-check.mjs`自身45秒超时先reject，record尚未赋值，finally不能回收其fixture资源，反而删除记录目录。已交实现者修复并注入外层deadline验证。

主代理确认机器已存在.NET Framework csc.exe及System.Web.Extensions.dll，允许仅用既有工具制作临时外部测试引擎，直接关闭自己的Windows输入句柄，补查Node注入失败的EPIPE场景；不得安装运行库或触及其他进程。待这些问题修复复审、整合后再独立回归，09仍未验收完成。
