# 17：主代理整合验收

## 结论与范围

**通过，17 Execution: done。** 验收源码 `1d778f89ff9e46bdab81958ef07b764e0ed22392` 已整合到 `integration/go-coach`。本记录、设计文档及产品/任务状态收口不改变该源码；未push/发布。18的17依赖解除，但18尚未实现，仍须固定存储、身份与恢复设计。19才接入真实连续聊天；05/08、20–22及真实教学票未因此关闭。

交付明亮棋馆本地工作台：单主盘回放、落子前同方S/A、独立合法PV、自由试下/Pass/撤回改下/返回原谱、紧凑BLACK走势及按需详情。宽屏双栏，窄窗页签，右侧只提供诚实的未启用说明及本窗口草稿，不伪造发送或AI回复。

## 代码与审查链

- 17首轮交付 `d7931c1` 基于 `80f4de9` 并包含 `3853e08`，实际25文件diff；安全checkpoint及原始RED/GREEN/失败记录保留，详见[实施日志](17-implementation-log.md)。
- 初轮Standards `c4e72738-2bd5-4cc` 无material问题；Spec `0f51d22f-4179-47f`发现“先显示A再跨TTL仍展开”；视觉 `4242240b-0702-4be`要求走势可见语义和当前定位。主代理读源码/图后确认，见[第一轮](17-review-round-1.md)。
- implementer `4c779b0c-bb76-4de`最小修复 `0ddf117`，补日志 `1d778f8`；两入口重新HTTP核验，只交付本次仍有效DTO，模式切换主动取消，10秒核验截止；不补跑引擎或改服务端TTL。走势新增可见黑方胜率/原谱手/未知与三角虚线定位。
- 独立复核Standards `d12fe5fd-043d-4c4` 0，Spec `2b58bc98-56a4-40e`原问题resolved、新material 0。视觉补未知实际图后 `bbd14351-0e70-4a1`最终ship；完整边界见[第二轮](17-review-round-2.md)。
- documenter从实际构建记录 `DESIGN.md` 与sidecar；主代理完整读取、对照CSS并解析/核对token引用。没有shipping raster资产；审查图与静态草图不是产品素材。

## 主代理独立执行

证据根：`D:/code/tmp/go-coach-notes/17-main-acceptance/`。以下都在整合后的主目录执行，不借用实施者159/57、171/57或旧16的145/56结果。

| 验证 | 命令/边界 | 实际结果 |
| --- | --- | --- |
| build | `npm.cmd run build` | exit 0，`build.log` |
| 全网页 | `GO_COACH_TEST_PORT=5200`，`playwright.cmd test --workers=2` | **171 passed**，0失败/跳过，4.7m，exit 0，`web.log` |
| 新包桌面 | `DESKTOP_EVIDENCE_DIR=.../desktop`，`npm.cmd run test:desktop` | 先重新build/pack，再**57 passed**，0失败/跳过，5.4m，exit 0，`desktop.log` |
| 未知状态真实渲染 | 生产HTTP＋Chromium公开UI，`capture-unknown.cjs` | 4图，0引擎请求、0页面外部请求，exit 0 |
| 工件/设计检查 | `fingerprints.json`、`artifact-check.log` | 87个源码/测试/配置文件指纹；YAML/JSON可解析、引用存在；包无契约标记/设计/任务文档，exit 0 |

网页仍走真实HTTP/业务，完整棋规/依据/缓存/授权边界未mock；只替外部引擎与平台I/O。桌面使用真实新打包exe、隔离userData和合成凭据/棋谱。先确认5200无人监听，不复用或停止5173；捕获只回收自己的服务。打包获取了既有Electron开发资源，不能称全过程零网络；asar关闭/未签名提醒不是测试失败或安全认证。

### 验收标准映射

1. 1440/1280双栏、920/390页签、矮窗/放大文字、独立输入及草稿保留：workspace网页路径与真实桌面主路径通过。
2. 单盘、P[k]回放与P[k−1]同方对照、黑白PV不混实战/未来、试下完整前缀：workspace、engine、variation-evidence及原教学回归通过。
3. 同点S/A、Pass、缺候选/缺PV、初盘/未知/失败/失效有诚实状态；已有A跨TTL的两展开入口、迟到成功/失败切换矩阵、超时无复活/无补算通过。
4. 撤回/改下/Pass/返回、前驱配对、当前after实际成功、64身份cache与服务会话/TTL保护：既有16及相关回归保留。
5. 浏览/详情/页签不生成聊天；草稿和教练区域不绑当前手面板重挂。这里只验收17本地边界，未宣称未来真实聊天生命周期已完成。
6. 导入有限棋规、自动扫描可关闭、BLACK视角、引擎状态、错误及独立预设教学入口均保留，旧语义断言未削弱。
7. 171网页包含26项工作台用例；57桌面包含1条新增工作台综合路径及原56回归，不声称26项网页矩阵全部分别移植到桌面。
8. 独立两轴、真实截图视觉verdict、实际设计记录和主代理整合复测齐备，才将17置done。

### 图像复核

主代理本轮网页截图在 `web/`（11张），真实桌面在 `desktop/真实打包工作台单盘对照试下返回与窄窗草稿/`（4张），未知补图在 `unknown/`（4张）。主代理实际打开未知1440/390、网页PV、打包桌面对照和窄窗试下；独立视觉代理另完整读取15张同源码canonical图和4张补图。没有把静态daylight提案当生产截图。桌面外窗与内容区尺寸差来自原生边框，未冒称截图内容区等于外窗。

## 工件指纹

完整明细：证据根 `fingerprints.json`。87文件有序路径→原始字节SHA-256映射的JSON摘要为 `5d9a1994c7f0dab621506aa2ad07bf2bcf2dc95945d5fedb2e05b296c3c47433`。

| 工件（主目录相对路径） | SHA-256 |
| --- | --- |
| `desktop-release/win-unpacked/Go Coach.exe` | `35e415b035c9b1e68a390e3162afcfda8e4b4c4262b4824b5aa58f050f233572` |
| `resources/app/dist/assets/index-BAA1fa4j.css`（相对win-unpacked） | `ea8b4909ee379b27d4ca8c08712117d1944a2fce5718c061d6cc3b2253a80ac9` |
| `resources/app/dist/assets/index-DoQQ7n-0.js` | `5d2358aa99a8541daceddae7f17ec740655c57cd730e451497ba13e404ef3d4b` |
| `resources/app/.server/index.js` | `ca80f33b80fb35ef7c0c043cadde5bf51ca254837a28e519cc58aed91a2ca23b` |

exe是同版本Electron宿主，hash与旧16相同不代表业务内容相同；识别本次产品须结合resources/app指纹。整目录一起保留，不能只拷exe；后续打包可能覆盖该开发目录。旧 `windows-x64-a1cd762-main` 留档没有替换。

## 未验证与授权边界

- 没有本轮真实GPU/搜索强度、真实Key、私谱/聊天外发、真实DeepSeek推理、embedding或教学/学习迁移测试；合成数据与受控模型不能证明这些。
- 存档、恢复/删除、会话/消息注册、发送授权与排队、上下文压缩、RAG/教学方法及有限工具环仍属18–22，不以工作台或草稿顶替。
- 真实长聊天滚动、聊天恢复、压缩后追问留给对应片；没有全面屏幕阅读器、跨机器/系统/断电灾难或SmartScreen手动认证。无独立QUALITY BAR卡的视觉限制保留。
- 旧09专项真实引擎手动脚本未在本轮重跑/适配新入口，不当作本轮通过证据；下一次获真实GPU授权时需先核入口。
- 无月度预算、金额预留或费用账本；不恢复已撤销前置。取消预算不等于免费或无限调用。
- Git合并前后5个受保护文件hash一致，用户原有`.gitignore`、`AGENTS.md`、`GLOSSARY.md`、`docs/agents/pi-workflow.md`改动及未跟踪参考/适配文件未夹带提交。
