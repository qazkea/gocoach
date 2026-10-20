# 08：本机密钥与预算保护设计

Execution: in-progress（15已验收，先实施分片A离线凭据配置；分片B未派发，整票未完成）

## 已确认与未授权边界

- 用户已授权继续官方DeepSeek集成开发，并选择**独立密码窗口**，而非导入明文文件。此为配置功能开发选择，不是让代理读取现有Key或立即调用API。
- 月度新增服务预算目标为¥50；主业务复盘renderer不能读取已保存的Key。
- 具体模型、外发字段、政策风险接受及真实传输/费用仍待确认。合成Key、隔离userData、外部平台替身测试允许；真实Key不进入聊天/代理工具/日志。
- 研究见[桌面安全预检](08-desktop-security-preflight.md)。主代理另查本地Electron44.8.0类型：encryptStringAsync返回Buffer，decryptStringAsync返回{result,shouldReEncrypt}。主代理已在既有缓存Electron44.8.0的独立main/utility无数据库探针中验证node:sqlite可导入及DatabaseSync存在；产品打包入口、事务/耐久仍未验证，不据版本号或模块存在直接作预算保证。

## 分片A：离线本机凭据配置（下一实施范围）

目标是安全配置入口及诚实的“未启用在线讲解”，不是通过保存Key自动验证账户、充值或生成讲解。依赖15最终验收，已由43d955b及15-main-acceptance.md解除；实施以包含该验收记录的最新整合基线派发。预计文件：desktop/credentials.mjs及明确列举的desktop/credentials/静态页面、脚本、样式和preload.cjs，main菜单/生命周期连接，package.json精确打包白名单，真实exe测试。禁止扩大普通renderer Node/IPC能力。

### 窗口与IPC

- 原生菜单“讲解 → 配置 DeepSeek Key…”打开至多一个专用密码窗；菜单显示“未配置”或“本机已保存，尚未启用在线讲解”。重复打开只聚焦，不重新读取/填充已有Key。菜单另有“删除已保存Key…”默认取消的原生确认。
- 静态中文界面，input type=password，明确“只保存到本机；此操作不发请求、不验证余额”；保存/取消及可见错误。不得显示已存明文或后缀，不增加“显示已有Key”。粘贴由普通OS行为完成，应用不自动读剪贴板。
- 密码窗独立持久化关闭的session分区（非persist），nodeIntegration:false、contextIsolation:true、sandbox:true、webSecurity:true；禁导航/redirect/iframe/新窗口/权限/download/webview。固定本地精确文件URL，不载远程内容。
- CSP default-src 'none'；只允许固定本地脚本/样式；connect-src 'none'、form-action 'none'、frame-src 'none'、object-src 'none'。无inline脚本/eval，无遥测、自动账户探测、远程图标。
- sandbox preload为.cjs，仅桥接固定submitKey(value)、cancel()；无通用invoke/send、无事件对象或已存Key/路径读取接口。保存结果仅固定成功/错误枚举，不能透传异常文本或输入。
- main每次核对确切密码窗webContents、senderFrame为该窗当前mainFrame、规范file URL完全相等（拒query/hash/其他文件）、窗口仍存活且当前epoch有效。业务窗、其他webContents、iframe、旧窗口调用均拒绝。
- main重复验证输入：字符串、去除首尾空白后长度1–512、仅可见ASCII且内部无空白/控制字符。该校验只防格式/请求头注入，不声称验证官方Key有效；不强制未经核验的前缀。密码字段在提交返回/取消时清空；不能保证JS/OS内存可安全抹除。
- 保存期间禁重复提交，main也必须串行化保存/替换/删除；不能只靠按钮disabled。取消/关闭/退出使epoch失效，晚到加密结果不得继续开始写入；已经开始的密文原子替换可能完成，但不能向已销毁窗口报成功或产生未处理Promise拒绝。不得因此破坏14的引擎ack+exit关闭语义。

### 存储与失败

- 只在main、app ready之后使用Windows safeStorage异步API。先确认isAsyncEncryptionAvailable；任何不可用/加解密/持久化失败均停用，不落明文、不退回普通JSON Key。非Windows此片明确不支持。
- 固定app userData/go-coach下保存有版本的密文记录；有界读取≤16KiB、严格schema/base64、默认不存在表示未配置，损坏表示“密钥不可用，请重新配置”，不静默当作新的空账户。来源路径不来自renderer参数。
- 写入只包含safeStorage密文：同目录唯一临时文件wx、完整写入并flush后rename；错误保留旧有效记录、清理本次临时文件。这里不把rename当作将来预算账本的断电事务保证。
- 首次保存或替换前完成加密与本机解密round-trip校验。启动恢复可以在main解密验证后立即丢弃明文引用，不发给utility/renderer、不写日志/环境变量/命令行；异步重加密提示必须处理后才报告可用，或明确停用要求重新配置，不能无限decrypt循环。
- 删除仅清凭据，**不清授权历史/未来预算账本/未知费用**；删除失败仍报失败且不得谎称已删除。重配/损坏/迁移失败均不能重置预算。
- DPAPI不保护同Windows用户运行的恶意程序；无跨用户/跨电脑恢复保证；不声称内存零残留。普通应用页面与utility没有Key，专用密码窗只短暂接触用户本次输入。
- 保存状态不等于同意外发。在本片所有真实推理/账户出口保持不存在或禁用，不新增可绕过15证据校验的解释接口。

### 分片A验收

真实打包exe、合成Key、独立userData：输入→保存→关窗/退出→重启状态→替换/删除；未配置/已配置均能继续本地复盘。检查自己测试目录的持久文件、stdout/stderr与观察到的utility/HTTP出口不含合成明文Key；专用窗口必要的用户输入不算“Key不可进入任何renderer”的错误断言。

只用外部平台适配产生加密不可用/加解密异常/写失败；过滤、IPC授权、存储编排和状态不mock。恶意业务窗/iframe/导航/旧窗口/重复提交负例须走真实IPC边界，不能直接调用存储私有函数或增window测试API。CSP及跨窗隔离、无外发、晚保存/退出竞态、旧桌面引擎关闭语义均需覆盖。真实OS加密round-trip也必须至少一项，不把全套fake safeStorage当真实加密验收。

## 分片B：授权与持久预算（尚待细化，不派发实现）

- 独立main/utility的node:sqlite模块可用性已做无数据库探针；仍须在产品打包运行时验证后，再决定SQLite事务账本并验收事务/恢复；无新原生依赖安装。若不可用，返回设计讨论，不临时改成无事务文件“硬保护”。
- main持凭据、固定官方HTTPS出口和账本；utility只传可信服务端重建的最小证据。无任意host/redirect、联网工具、自动重试；普通业务renderer仅传证据引用/选择，不传可信金额/usage/模型价格或Key。
- 授权必须绑定模型及参数、提示/字段版本、政策提示版本、计价依据与预算范围；默认关闭。第一片仅结构化棋局证据，不发rawSGF/姓名/注释/文件名/自由文本/聊天历史；自由文本仍拒绝且不得宣布整票身份过滤完成。
- 整数金额，事务内预留成功才允许发送。reserved→sent→settled/unknown，发送前必须持久化“可能已发送”；崩溃/超时/缺usage保持未知且不自动退款/重试。同userData单实例仅生命周期防线，预算争用仍由同一事务处理。
- 单实例不能约束不同userData或其他程序；必须明确本地预算范围与篡改/外部账户消费边界。不擅自改用真实用户固定生产目录做测试。
- 不使用字符约等于token作硬上界；以已核验模型context最大输入+明确输出上限及保守价格预留。研究中的Flash价格和1M口径尚非运行时计费保证；价格/上限不明则拒发，价变和月份边界需要单独规格。
- ¥50范围、价格核验/漂移停用、跨月未知余额、幂等并发、取消与费用、落盘失败/崩溃恢复、供应商usage真实性边界、真实调用授权仍须在分片B前提交用户确认。当前用户选择密码窗不能替代这些决定。

## 完成边界

分片A通过只表示本机配置可用，不把08整体done；分片B受控测试通过也不等于真实平台账单或隐私政策保证。05按需中文解释及10真实语义验收独立推进，原自由文本追问/真实Fox适配/学习成效仍未完成。
