# 13：主代理整合验收

Execution: done

## 代码与独立审查

- 基线 `cdc97e8`；功能 `56562883c5b5280f3ea6fcb93d2d32a315b842ae`；最终代码 `ed10ae9345a22a1d8d4d22233dc8ee2c74b60db3`，已快进整合到integration/go-coach。
- Spec审查（0dfdee28-bf49-476）：没有确认的缺失、越界或实现错误；明确区分未测项与功能缺陷。
- Standards审查（6d3bbc86-b3ed-431）：无硬规范违反；提出分析传输DuplicatedCode非阻断建议。主代理采纳，由独立实现代理使EnginePanel复用analyze，再由原审查者复核关闭；取消/active保护/清旧结果仍在。
- 主代理实际读取diff、核心module、测试/实施记录以及实现者桌面/390截图；不是只转述子代理总结。

## 主工作区独立回归

在最终代码上执行：

- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过，39个浏览器module。
- `GO_COACH_TEST_PORT=5192`，`npm.cmd test -- --workers=4`：**110 passed，0 failed，0 skipped，3.4分钟**（原96＋新增14）。
- `git diff --check`：通过；测试后工作区干净，5192无监听。
- 截图输出 `D:/code/tmp/go-coach-notes/full-game/main-after/`；没有通过修改测试副本或禁用默认新功能凑绿。旧手动路径明确由公开UI关闭自动扫描；隐私检查只增加精确同源无body能力GET。

## 真实KataGo整局核验

使用既有获准的KataGo v1.18.1 OpenCL、b18模型、原有调优缓存。仅合成谱，不读用户私人棋谱，不联网，不新增运行时。独立生产服务随机端口65296；采用单独dataDir及仅合成数据日志配置，未改operator.local.json。

| 合成谱 | 全部局面 | 导入至扫描完成 |
|---|---:|---:|
| Chinese 7.5，ba/aa/ab提子＋白pass | 5（初盘＋4手） | 5.508秒，含首次加载 |
| Japanese 0.5，HA2 dd/pp，白先qq/黑dc/白pass | 4 | 2.389秒 |
| Chinese 0.5，同HA2白先序列 | 4 | 2.392秒 |

- **13个局面全部完成**。启动就绪2.618秒，利用已有调优缓存；不从这些短谱外推200/300手整盘耗时或其他硬件性能。
- 主代理逐一核对真实浏览器HTTP输入与独立手工前缀预期：初盘、RU/KM/HA、初始方、每个有序历史和pass，无名字/评论/原SGF。
- 对照原始KataGo日志核对13个唯一请求ID、最终响应、turnNumber/currentPlayer、GTP初盘和完整前缀、100 visits请求预算、profile及Chinese让子N/Japanese让子0补偿。
- 逐手点击实际UI，对照原始引擎输出核验根胜率/目差/visits、候选总数与前10保留数、显示的候选与PV；核验黑白实际执棋方的前后估值变化符号及百分点。回看不新增查询，原谱提子仍正确。所有核对经真实界面与外部引擎I/O，不读取内部业务状态。
- 实际打开最终真实GPU桌面及390截图：走势/文字/候选与棋盘可见，窄窗无横向溢出。当前仍为长页面，**不是桌面紧凑布局或中文教练的视觉验收**。
- 自有服务PID25704退出0，无signal；引擎PID24608已退出。脚本及随后独立PowerShell确认两PID不存在，未停止用户5173。

证据：`D:/code/tmp/go-coach-runtime/katago-1.18.1-opencl/web/13-main-ed10ae9-2/`，含 `summary.json`、`http-inputs.json`、`raw-logs.txt`、`main-wire-check.json`、截图、stdout/stderr、ownership及exit记录。主代理脚本：`D:/code/tmp/go-coach-notes/full-game/main-acceptance.mjs`。

### 验收脚本首次失败（不是产品RED）

第一次运行保留在 `web/13-main-ed10ae9/`：主代理脚本尝试使用Playwright `response.text()`读取已被页面消费的流式fetch响应，出现 `Network.getResponseBody: No data found for resource`，未及时处理的异步拒绝使脚本退出。此运行未完成，不计入13个成功局面，也没有正常退出记录；随后检查未发现对应路径的Node/KataGo进程残留。脚本改为只观测HTTP请求、直接对照授权合成引擎原始日志与UI，提前保存所有权记录并保留finally清理；第二次上述完整验收成功。没有为此改业务代码。

## 完成边界

- 本票完成的是默认整局本地扫描、走势及逐手引擎结果、会话内缓存与生命周期；不等于整体桌面＋中文教练完成。
- 2000局面入口/单在途和超限拒绝已动态覆盖；**没有完整扫描2000局面**。Node服务整体重启且页面维持的场景没有动态跑，服务实例UUID隔离为静态审查；实际引擎进程重启缓存隔离有受控浏览器测试。
- 没有新跑原09的14次手动GPU脚本；旧手动行为由完整回归覆盖，共享传输已在本轮真实扫描运行。
- 估值变化不是严格最佳手损失，100 visits低预算不是棋理证明；无ownership，不宣称终局裁判、野狐真实兼容、真实中文讲解或真人学习效果。
- 下一阶段Electron桌面，随后完成08保护及05/10的DeepSeek按需中文讲解；真实外发及费用仍待确认授权。
