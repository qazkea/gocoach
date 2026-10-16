# 09：授权范围内的本地 KataGo 环境探针

## 结论与边界

**环境探针 success；任务09未完成，尚未满足09浏览器验收。** 2026-10-16（本机日志时区 +0800），授权的 OpenCL 引擎与 b18 在已有 GPU 环境成功启动，三个合成局面返回真实候选、PV 与估值，正常退出。没有网页/业务实现，没有更改任务状态。

仅下载指定两个二进制/权重及官方文本；没有安装驱动/额外运行库，没有更换后端/模型，没有修改系统/PATH/注册表/防火墙，没有在线或付费 AI 调用、棋谱外发、contribute 或公网服务。版本输出的“Compiled to support contributing…”只是编译能力说明，本次执行的子命令仅 `version`、`analysis`。

## 文件、来源与实际校验

运行根目录（下文 `R`）：`D:/code/tmp/go-coach-runtime/katago-1.18.1-opencl`。初始不存在，本次新建；没有覆盖既有内容。该目录在 worktree 外，保留供后续经授权的接入使用，不随 worktree 清理。

|文件|实际字节|实际 SHA256（与授权值一致）|
|---|---:|---|
|`katago-v1.18.1-opencl-windows-x64.zip`|6,004,137|`1710db1903ab921aa6837a9599c8474f8a59f057650217c5d9bc125ee393a9ff`|
|`kata1-b18c384nbt-s9996604416-d4316597426.bin.gz`|97,898,094|`9d7a6afed8ff5b74894727e156f04f0cd36060a24824892008fbb6e0cba51f1d`|

总计 **103,902,231 字节**。来源：
- https://github.com/lightvector/KataGo/releases/download/v1.18.1/katago-v1.18.1-opencl-windows-x64.zip
- https://media.katagotraining.org/uploaded/networks/models/kata1/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz

`prepare.py` 使用 Python 标准库 `hashlib.sha256` 核验实际字节和哈希，保存 `verification.json`；解压前检查所有 ZIP 项解析后的目标均在 `R/package` 内并拒绝符号链接，拒绝覆盖已有 package。完整清单 `zip-manifest.json`。随包 DLL、README/许可内容及所有其他文件均原样保留；另存官方 `LICENSE` 与 `network-license.html`。`probe.py` 执行前再次核验两个文件。首次 PowerShell `Get-FileHash` 不可用（命令不存在，退出1）；改用已安装 Python 标准库完成校验，并非跳过或安装依赖。

版本实测（退出0，0.047秒）：
```text
KataGo v1.18.1
Git revision: 92ee95c0a4b25fec214da00951ab69e97e207729
Compile Time: Aug 23 2026 23:32:20
Using OpenCL backend
Compiled to support contributing to online distributed selfplay
```

引擎路径：`R/package/katago.exe`；模型路径：`R/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz`。运行日志确认 model version 14、同名 b18 nbt convnet、26,326,985 参数。

## 官方字段核对与环境

执行前获取并核对固定 **v1.18.1** 文本（本地同名副本保留）：
- [Analysis_Engine.md](https://raw.githubusercontent.com/lightvector/KataGo/v1.18.1/docs/Analysis_Engine.md)：逐行 JSON、完整历史 `moves`、`initialStones/initialPlayer`、`rules/komi`、`maxVisits`、响应 id/turnNumber、退出协议。
- [analysis_example.cfg](https://raw.githubusercontent.com/lightvector/KataGo/v1.18.1/cpp/configs/analysis_example.cfg)：`maxTime` 是配置项，故设置在本地 cfg，**没有向 JSON 顶层盲传 maxTime**；其余线程/batch/cache/视角字段均有文档。
- [gtp_example.cfg](https://raw.githubusercontent.com/lightvector/KataGo/v1.18.1/cpp/configs/gtp_example.cfg)：`homeDataDir` 指定 OpenCL 调优等缓存目录。
- [GTP_Extensions.md](https://raw.githubusercontent.com/lightvector/KataGo/v1.18.1/docs/GTP_Extensions.md)：`chinese` 为 SIMPLE ko、AREA、suicide=false、tax=NONE、whiteHandicapBonus=N、hasButton=false、friendlyPassOk=true；不是 chinese-ogs/kgs 的 POSITIONAL ko。此次明确使用该内建 chinese，无让子、无规则转换警告；**未测试让子补偿或劫/超劫专门样例**。
- [analysis.cpp](https://raw.githubusercontent.com/lightvector/KataGo/v1.18.1/cpp/command/analysis.cpp)：只读核对实际就绪标记 `Started, ready to begin handling requests`，不编译/修改引擎。

Windows x64；既有研究记录 i5-13400F / 16GiB RAM。本次只读 `nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader` 返回 `NVIDIA GeForce RTX 5060, 8151 MiB, 610.88`。引擎实际识别 OpenCL 3.0 CUDA 13.3.80、device 0 RTX5060；自动调优选 FP16Storage=true、FP16Compute=false、FP16TensorCores=true、FP16TensorCoresFor1x1=true。不更改驱动或电源设置。

`R/local.cfg` 的完整有效配置：
```ini
homeDataDir = D:/code/tmp/go-coach-runtime/katago-1.18.1-opencl/home
logDir = D:/code/tmp/go-coach-runtime/katago-1.18.1-opencl/engine-logs
logToStderr = true
logAllRequests = true
logAllResponses = true
logErrorsAndWarnings = true
warnUnusedFields = true
reportAnalysisWinratesAs = BLACK
numAnalysisThreads = 1
numSearchThreadsPerAnalysisThread = 2
nnMaxBatchSize = 2
nnCacheSizePowerOfTwo = 18
maxVisits = 100
maxTime = 2
analysisPVLen = 15
```

启动日志内部将搜索线程字段显示为 `numSearchThreads = 2`，没有未使用配置警告。未开启 ownership。KataGo 自身调优缓存只指定 `R/home`；未主动改动驱动自身缓存设置。

命令（工作目录为 R，所有参数均绝对路径）：
```text
R/package/katago.exe version
R/package/katago.exe analysis -config R/local.cfg -model R/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz -quit-without-waiting
```

## 真实输入与输出摘要

以下为 `queries.jsonl` 的全部真实输入；`maxTime=2` 由上述 cfg 生效。SGF 手算映射：aa=A19、ba=B19、ab=A18、dd=D16、ss=T1，GTP 跳过 I 列，19 在顶部。原局前缀和分支均从空盘带完整合法历史；**分支不包含实战未来 B ab / W ss**。

```jsonl
{"id":"empty19","rules":"chinese","komi":7.5,"initialStones":[],"initialPlayer":"B","boardXSize":19,"boardYSize":19,"moves":[],"maxVisits":100,"includeOwnership":false}
{"id":"A-prefix","rules":"chinese","komi":7.5,"initialStones":[],"initialPlayer":"B","boardXSize":19,"boardYSize":19,"moves":[["B","B19"],["W","A19"]],"maxVisits":100,"includeOwnership":false}
{"id":"A-branch","rules":"chinese","komi":7.5,"initialStones":[],"initialPlayer":"B","boardXSize":19,"boardYSize":19,"moves":[["B","B19"],["W","A19"],["B","D16"],["W","A18"]],"maxVisits":100,"includeOwnership":false}
```

三条最终响应 id 与请求相符，turnNumber 分别0/2/4，`isDuringSearch=false`、`rootInfo.currentPlayer=B`。所有胜率/分差依 cfg 为**黑方视角**（正分差为黑领先）。下表摘自真实响应而非假数据：

|id|单次墙钟秒|root visits|root winrate|root scoreLead|候选数|order=0 候选 / 其 winrate / scoreLead|
|---|---:|---:|---:|---:|---:|---|
|empty19|0.735|101|0.374763328|-0.934750891|40|Q16 / 0.375587305 / -0.920245833|
|A-prefix|0.453|101|0.673383952|1.88778712|11|Q4 / 0.677310921 / 1.85613684|
|A-branch|0.515|101|0.988156713|13.128037|13|Q4 / 0.988221285 / 13.0937525|

order=0 的真实 PV（首项即候选，后续交替 W/B）：
- empty19：`Q16 D4 C3 D3 C4 D5 B6 D16 Q4 R17`
- A-prefix：`Q4 Q16 D4 D16 R17 R16 Q17`
- A-branch：`Q4 D3 Q17`

实际 root visits 为101而非精确100，保留此观测差异，不伪写成100；配置/请求确实均为 maxVisits=100（2搜索线程）。本次都先于2秒返回，**并未单独证明时间上限触发行为**。空盘包含 `isSymmetryOf` 对称展开候选，不能简单求和 visits 当成独立搜索预算。没有预设必须选 A18(ab)，实测前缀 top 为 Q4，不据此否定其他合法手。

离线 `check_responses.py` 重放各完整输入历史与**全部64条候选 PV**，检查坐标范围、轮次、占点、提子、禁自杀与 simple ko，以及 pv[0]==move、胜率范围/有限分差。40/11/13 条分别通过；PV 实际长度范围1–10 / 2–8 / 2–5，没有补齐到15或伪造变化。这是临时探针的有限合法性核对，不是产品规则库测试或独立完整规则认证。

## 启动、日志与进程清理

- 启动至 ready：**174.984秒**（含加载/首次调优）；独立600秒上限未触发。
- 日志调优从18:03:59到18:06:46，约167秒（日志秒级精度）；18:06:53 ready。调优耗时未混进查询耗时。
- 就绪后串行三请求，各自外层30秒超时；没有超时、解析错误、JSON warning/error、未使用字段或规则转换 warning。调优 `ErrorProp` 是数值误差测量，不是被隐藏的运行失败。
- 引擎 PID **45524**；finally 关闭 stdin，等待退出，退出码 **0**，没有强杀；日志末行为 `All cleaned up, quitting`。后续 `Get-Process -Id 45524` 无进程。没有留下后台引擎，也没有终止其他进程。

原始长日志/临时脚本均不入 Git，保存在 R：
- `prepare.py`、`probe.py`、`check_responses.py`、`local.cfg`
- `verification.json`、`zip-manifest.json`
- `version.stdout.log`、`version.stderr.log`
- `queries.jsonl`、`responses.jsonl`（完整原始输出，不仅 top3）
- `analysis.stderr.log`（含完整调优、请求、响应及退出）
- `engine-logs/20261016-180358-D32B57BC.log`
- `probe-summary.json`（精确墙钟、命令、PID、返回码、top3）
- `legality-check.json`
- `home/opencltuning/tune13_gpuNVIDIAGeForceRTX5060_x19_y19_c384_mv14.txt`

验证命令及结果：`python R/prepare.py` 校验/安全解压通过；`python R/probe.py` version+三查询通过且正常清理；`python R/check_responses.py` 64条候选PV检查通过。此阶段未运行网页测试、产品单测或浏览器验收；没有更改产品代码，不以此替代那些测试。

## 后续仍需验收

本次仅每局面一次低预算试跑，**未测重复运行/预算变化的稳定性**，未测乱序/取消/过期/失败 UI，未测用户上传真实棋谱、让子、劫历史影响、网页分支接入。没有用引擎数值生成自然语言原因；候选不等于全部合法手或全局最优，PV不等于必然结局，估值仅为上述模型/规则/预算条件下输出。

报告提交前已将 `integration/go-coach` 从派发基线 `e3063a9212da1aecd89ea27acc4967d84e0f4d4b` 先 fast-forward 合并到 `a13466a976ae4f380d79e090dd01509f23af79d8`（04实现），提交前再次合并最新 `e4581291aa68dc1f453363fb55bd3a7d2684efdb`（04独立审查记录）。本次自己的改动仅此报告；不修改其他跟踪文件、不标完成、不 push。
