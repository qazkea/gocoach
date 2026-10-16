# 01 实施记录（进行中，非验收通过）

## 已确认测试 seam
仅 Playwright 浏览器完整用户流程；不调用内部解析方法，不 mock 解析/回放。
环境 Windows，Node v24.15.0 / npm 11.12.1。基线 3745591，
隔离 worktree pi-agent-21ff02ea-065b-48f-e7dcf368，ancestor 检查 exit 0。

## 垂直 TDD 记录
每条先写行为测试、实际运行失败，再实施。
1. `npm.cmd test -- --grep "上传后"`：RED 找不到文件选择入口（浏览器已启动，非安装失败）；GREEN 1 passed。
2. `npm.cmd test -- --grep "损坏语法"`：RED 缺闭括号未报错；严格单线语法 reader 后 GREEN 2 passed（全套）。
3. `npm.cmd test -- --grep "缺少必要"`：RED 没有缺失字段告警；GREEN 3 passed（全套）。
4. `npm.cmd test -- --grep "结果与元"`：RED 没有棋谱信息；字节解码/显示元数据后 GREEN 4 passed（全套）。
5. `npm.cmd test -- --grep "拒绝无法"`：RED 非19路显示成功；结构/元数据验证后 GREEN 5 passed（全套）。

测试样例全为本票合成，不含私人棋谱。simple 的逐步人工核对：
空棋盘 → 黑 dd (左上第4列第4行) → 白 pp (第16列第16行)；
两子不相邻，均无提子；前一手应清除 pp，起始应清除 dd。
RE[B+R] 是合成合法结果标记，不依据两手推断真实结束/胜负。
UTF-8 棋手甲及 Latin1 André 是编码核对值，不证明真实平台兼容。

## 阶段9b0d1bb的历史暂停点（已由下节继续处理）
等待主代理确认 RU profile；当前仅基础切片，不可当完整任务交付。
拟 Japanese = 明示简单劫/禁止自杀回放 profile；其他标签明确拒绝；
不裁定长周期循环/终局争议，不计算胜负。不把标签当完整国家规则。
目前尚未实现提子、自杀、劫、占点、让子/setup、pass、完整属性支持范围校验，
不能据现有测试声明可用棋谱合法性。需继续逐条 RED/GREEN。
待补：GBK/坏编码、转义、缺省 Latin1 区分 Windows1252、PL、HA/AB、
未知 RU、异步旧读取竞争、隐私出口观察、键盘与支持范围说明。
父规格与任务票未修改、未标 done。

## 继续实施：有限 Chinese / Japanese profile

隔离目录 `pi-agent-867a282d-7e4a-4da-4d6e6846`，启动HEAD 3745591；
`git merge-base --is-ancestor 3745591 HEAD`通过，然后fast-forward合入阶段9b0d1bb，未从空白重写。
本worktree执行 `npm.cmd ci`（26包，audit 0漏洞），未增依赖、未装引擎/AI。
完成前合并 `integration/go-coach` 的1be7fd4，合并提交af5055f；任务票的变化仅来自该主集成提交，本代理未编辑票/父spec/词汇/工作流。

### 实际新增 RED → GREEN（按垂直切片依次运行）

各行命令前缀均为 `npm.cmd test -- --grep`。每个切片先添加浏览器行为，实际失败后实现，再运行同命令1 passed；未批量先写全部测试。

| grep | 实际RED | 随后GREEN实现 |
|---|---|---|
| 提子与 | aa未提走，找不到aa空 | 敌链气与提取、双方俘虏随帧 |
| 基础合法 | 占点仍成功，无alert | 占点/自杀/交替行棋、两种明确RU白名单 |
| 初始setup | PL白先失败，无棋盘 | 初始多节点setup/矩形/清空、HA不摆星位、PL |
| 不可靠setup | 交叠仍导入 | setup互斥/越界/方向/HA/PL、无气初始盘、KO拒绝 |
| pass计步 | 立即回提无alert | 简单劫、非立即重复只报不支持、pass计步不误报 |
| 先解码 | 合法GBK最后值81 5C导致无信息区域 | 每种候选先严格解码后parse，仅接受自身CA一致候选；Latin1不走1252 |
| 严格属性 | 非根AP仍成功 | 根属性位置、单值、显式属性白名单、game-info保护 |
| 输入体积 | 超1MiB仍成功 | 读取前大小检查、2000节点上限在生成帧前生效 |
| 界面说明 | 缺少有限范围提示 | 初始范围/本机说明、可聚焦回放区域、键盘导航 |
| 坏数值 | KM[.5]仍成功 | Real完整数字、AP/ST有限格式 |
| FF4拒绝 | AB[aa:aa]仍成功 | 一格压缩矩形、非文本转义、AP字段内冒号拒绝 |

编码试验最初将81后接5D当作坏GBK，这是合法双字节；测试观察到成功后修正为真正非法81 30，并将合法81 5C移至文件最后属性以暴露原始字节预解析故障。记录这一测试样例纠错，不把错误预期包装成产品缺陷。

### 补充回归验证（新增时已GREEN，不虚构RED）

- 迟到File读取成功/失败与隐私出口：阶段request id已有保护；新测试仅模拟浏览器File I/O，不碰内部解析。新代码还在读取后、解析前丢弃过期请求。
- 双子链提取、白提子、在历史空点重下：用手算构型补强已有通用提子实现。
- 三处劫六手重复：手写000→100→110→111→011→001→000核验，证明长循环是支持边界，不是简单劫。
- 完整四手合成结束SGF：固定文件、独立推演及RE原样展示。
- 所有上述补充命令各1 passed。一次使用含竖线的grep在Windows npm转义中被shell拆分，未运行测试；随后拆成两个命令均通过，不计作业务RED。

### 支持与核验依据

范围、未知/缺失数据政策、输入保护和官方规则链接见根README；逐步人工坐标/气/俘虏依据见 `tests/fixtures/README.md`。
中国协会网页未标2002年份，不能宣称已核验2002原版；日本棋院为1989规则。
pass不自动判真实结束，未实现停止后死活确认/终局争议；RU只保留标签，不代表完整国家规则或野狐细则。
SGF解析与产品棋局校验分离；未支持属性/循环明确拒绝，不把SGF允许记录非法着当作产品允许非法着。

### 最终实际验证（合入integration 1be7fd4后）

- `npm.cmd run build`：通过，Vite生产构建成功。
- `npm.cmd run typecheck`：通过。
- `npm.cmd test`：20 passed，Chromium浏览器，约3.7秒；无跳过、无失败。
- `git diff --check`：通过（仅Windows LF/CRLF提示）。

未运行：真实野狐文件、完整中国/日本赛事规则程序、真实引擎/AI、真人教学效果、其他浏览器/移动设备。
尚待主代理独立审查与集成后复测；不勾选验收、不将任务标done、不推送。

## Standards 审查阶段：集中 SGF 属性描述

- 隔离 worktree `pi-agent-dfc79643-9127-4c5-46d10a59`，起始 HEAD 为
  `95d28611527e0e2b9debb0b5afb17b5a5933acbe`；基线祖先检查通过。
- 仅在 `src/replay.ts` 集中私有属性描述表：分类、多值许可、文本转义许可。
  parser 转义判断、game-info 节点识别、根位置、白名单及单值校验均读取该表。
  保留 AP 转义冒号特别拒绝、原有 TM 等属性处理、公开 interface 及错误检查顺序；不扩展格式支持。
- 这是 review 阶段维护重构，不虚构 RED；未修改任何测试或 expected。
  浏览器上传 seam 继续运行真实解析/回放。
- `npm.cmd ci`：通过，26 包，audit 0 漏洞；未改变依赖。
- 重构前 `npm.cmd test`：20 passed（3.8秒），无失败或跳过。
- 完成时 `git merge integration/go-coach`：Already up to date，集成 tip 仍为上述基线。
- 合并检查后 `npm.cmd run typecheck`、`npm.cmd run build`：均通过。
- 合并检查后 `npm.cmd test`：20 passed（3.7秒），无失败或跳过。
- `git diff --check`：通过。

未运行真实平台棋谱、其他浏览器、引擎或 AI；本次没有新增功能或验收状态变更。
待主代理组织独立审查与整合，不推送或发布。
