# 09：真实浏览器合成验收记录（交主代理复核）

本记录是网页→同源 Node→实际 KataGo→网页的真实运行，不是 CLI 探针或受控进程测试。
不自标任务完成；规格/Standards 独立审查及整合复测仍由主代理组织。

## 环境、授权与证据

- 沿用已校验 KataGo **v1.18.1 OpenCL** 和指定 b18：`kata1-b18c384nbt-s9996604416-d4316597426.bin.gz`。
  exe/model/home 均在原授权目录 `D:/code/tmp/go-coach-runtime/katago-1.18.1-opencl`（下称 R）。未再次下载或改变探针资产。
- Windows、RTX5060（原探针的既有驱动/运行库）、Node + Playwright Chromium；本次未安装驱动、运行库、在线AI或付费服务。
- 单 Node 生产服务、实际 dist 页面、真实浏览器上传合成 SGF、按按钮试下；未用 HTTP 业务结果 mock、window 注入或命令行查询代替网页。
- 完整最终证据：**`R/web/acceptance-4/`**，本机时间2026-10-16 18:49:56—18:50:10 +0800。
  - `20261016-184956-06CC54E6.log`：实际引擎完整启动配置、14条 Request/Response、退出。
  - `http-inputs.jsonl`：实际浏览器14条必要输入，和引擎出口可交叉核对；无姓名/评论/原始SGF。
  - `summary.json`：14次网页可见文本、按钮到完成墙钟时间。
  - 14张同名 `.png`：网页截图（含回放与独立引擎分支）。已实际查看 `branch-1-white-turn.png`。
  - `server.stdout.log`：监听、引擎PID、就绪时间；`exit.json`：服务正常退出0。
- 复现脚本：`tests/real-engine-browser.mjs`，命令见 README。使用独立 `R/web/synthetic-evidence.local.json` 开启完整**合成**日志。
  普通 `R/web/operator.local.json` 不开启请求/响应记录。运行配置仅本地，未入Git。
- 最终 server PID **37012**、engine PID **26932**；脚本关闭浏览器后经进程IPC关闭服务，stdin正常关闭，日志 `All cleaned up, quitting`。
  随后按这两个精确PID只读检查，均已不存在。未终止其他进程。

## 条件与输入手算

所有请求均19×19，BLACK视角，100 visits、cfg maxTime=2秒、分析线程1/搜索线程2、batch2/cache18、PV15、无ownership。
实测14次 root visits均 **101**，不伪称精确100。profile使用官方JSON字段 `ko/scoring/tax/suicide/hasButton/whiteHandicapBonus/friendlyPassOk`。

1. **非示例完整谱**：`(;FF[4]RU[Chinese]KM[7.5];B[ba];W[aa];B[qq];W[rr])`。
   页面显示“当前没有对应示例分析”，仍可显式打开真实引擎。回放到第2手：出口必须只有 B B19、W A19；qq/rr未来不能混入。
2. 在第2手后 B dd（D16），轮白；再 W ab（A18），轮黑。撤回后 W ss（T1）替换未来；重走禁用，原谱末尾仍qq/rr且dd为空。
3. 坐标独立预期：aa=A19，ba=B19，ab=A18，dd=D16，ss=T1；i列跳过I，ih=J12。
4. Japanese、KM6.5、B dd后白轮：显式 SIMPLE/TERRITORY/SEKI、bonus0，网页黑方胜率/分差与引擎原值对应，没有因白轮反转。
5. HA2：初盘B dd、B pp（D16/Q4），PL[W]，KM0.5；Chinese AREA/NONE bonus=N，Japanese TERRITORY/SEKI bonus0。
   请求无伪造moves。profile是近似计算条件，不宣称完整国家或野狐规则。
6. HA0：初盘B ba、W aa，黑先，KM7.5；必须显式bonus0，不让引擎猜setup为让子。
7. **同盘不同历史劫**：真实有序九手
   `B gh; W hh; B hg; W gi; B ih; W ii; B ss; W hj; B hi`。
   第9手B hi提W hh；B hi仅hh一气，其邻gi/ii/hj为白，其他黑链仍有外气。
   立即W hh将还原第8手盘面，完整历史下必须拒绝简单劫。
   对照setup为 `HA[0]PL[W]AB[gh][hg][ih][ss][hi]AW[gi][ii][hj]`，不声称有之前历史。
   脚本逐点比较两棋盘361个可访问名称，完全相同；setup下W hh可提B hi，随后真实分支分析成功。
   实际引擎原局9候选中没有H12；无历史setup的7候选中有H12（不是要求它成为top）。

所有14次输出经产品实际完整历史规则校验全部候选及每条PV后显示；无warning/error或非法PV被静默筛掉。
原始Response完整保留，网页只显示前10并准确给出总数/未显示数。

## 实测（最终 acceptance-4）

时间是从网页点击到可见“分析完成”的墙钟，包含HTTP/UI等待；不是纯搜索时间。
本次复用已有OpenCL缓存，启动到ready **2.158秒**，与原探针首次调优175秒不是同一条件。

|网页操作|秒|轮次|root黑方胜率|root黑方目差|候选数 / top GTP|
|---|---:|---|---:|---:|---|
|原局第2手，第一次|2.939|B|0.674903354|1.89962471|10 / Q4|
|同原局第二次|0.150|B|0.674672258|1.90716324|9 / Q4|
|B dd分支第一次|0.866|W|0.606646101|1.16416584|8 / Q16|
|同分支第二次|0.126|W|0.605743596|1.15051105|8 / Q16|
|再W ab|0.859|B|0.988248512|13.0692891|13 / Q4|
|撤回W ab|0.148|W|0.606739396|1.16038121|9 / Q16|
|改W ss|0.862|B|0.993093842|15.9935019|11 / D4|
|Japanese B dd后|0.906|W|0.47779956|-0.219775749|12 / Q4|
|Chinese HA2|0.897|W|0.996534836|18.6123911|30 / C17|
|Japanese HA2|0.897|W|0.996462841|19.0168013|34 / D4|
|HA0 setup|0.117|B|0.676219254|1.92688919|10 / Q4|
|九手劫完整历史|0.889|W|0.0543222399|-7.40621745|9 / K12|
|同盘无之前历史setup|0.163|W|0.0552524569|-7.35418801|7 / K12|
|setup下W hh回提分支|0.858|B|0.0778193208|-6.40102075|8 / K11|

重复原局top PV两次均 `Q4 D16 D4 R16 P17 Q15`；root胜率变化约-0.0231百分点、目差+0.00754，候选数量10→9。
重复白轮分支top PV两次均 `Q16 D3 Q3 D5 R6 O17`；root胜率变化约-0.0903百分点、目差-0.01365。
撤回再次计算时top仍Q16但PV变为 `Q16 Q3 D3 C5 R5 E4`，说明相同输入并不保证PV一致。
这些重复共用同一引擎及缓存，没有清缓存或跨机器/预算比较；不能推导稳定棋理、最强手、整盘延迟或教学有效性。

## 真实运行尝试的诚实区分

- `acceptance-1`：14次真实UI通过，原始响应采集器静默丢失HTTP流体，证据不完整，不能作为最终完整记录。
- `log-red`：原局UI成功，但新增引擎日志存在性检查报ENOENT；随后增加默认只记录诊断的logDir。
- `acceptance-2`：14次UI通过且服务退出0；事后发现Playwright无法读取流式响应body，HTTP响应证据仍缺失。
  当时工具组合命令末尾 `Get-Process katago` 无进程导致退出码1，不是引擎或网页失败。
- `acceptance-3`：14次UI通过，明确报告 Chromium `Network.getResponseBody: No data found`，证据完整性检查失败。
- `acceptance-4`：改为浏览器请求出口 + 操作员显式开启的合成KataGo完整日志；14次UI及证据检查通过，退出0。
  未mock或重新计算任何引擎响应；不把采集器错误伪称业务通过。

独立主代理仍需核对日志/截图、审查代码与整合复测。本记录不替代真人教学验收或野狐兼容验证。
