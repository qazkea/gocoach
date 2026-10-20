# 08A 主代理验收：离线独立密码窗口

Execution: done（仅分片A；08整票和分片B仍未完成）

代码：`a1cd762bceb30d2f11af18ba3d791e50148382b3`。主分支integration/go-coach已快进整合，未push/发布。用户选择独立密码窗口及许可开发，不等于授权代理读取真实Key、外发棋局或收费。

## 完成内容

- 原生“讲解 → 配置 DeepSeek Key…”打开唯一专用密码窗：隐藏输入、不填旧Key，不创建用户明文来源文件；普通复盘窗仍无preload/secret API。
- 专用临时session、sandbox/contextIsolation、固定精确本地资源与CSP；IPC校验当前webContents/mainFrame/URL/生命周期，仅固定提交与取消。无任意文件/通道/网络入口。
- main使用Windows异步safeStorage加密及本机解密round-trip，固定userData/go-coach/credentials.json版本密文；有界读取/规范base64/schema，失败停用，不明文回退、不向utility/日志/HTTP返回Key。
- 默认取消确认的删除只清凭据，不清费用/历史。显示“本机已保存，尚未启用在线讲解”，不验证账户、余额或Key服务端有效性。
- 10秒操作期限、operation/epoch隔离、迟到恢复/加密不能覆盖新状态；在途持久变更保持排他，已派发rename不假称可撤回。主退出立即进入原引擎ack+exit关闭，不等凭据OS或文件IO。
- 禁止无关Chromium拼写字典后台下载。历史运行的网络发现与验证边界保留如下。

## 审查与主代理额外发现

- 原候选0a3359c：Spec e7d24132及Standards d0087de7未确认阻断缺陷；主跑41桌面＋133网页全绿。但主独立外部OS完成门探针发现P2：加密不返回时，退出12.5秒仍停在等待pending，释放OS回调才退出0。证据 `D:/code/tmp/go-coach-notes/credentials-08A/main-hung-encryption/`。主更新规格并要求修复，未把全绿或“未覆盖”当验收。
- 最终Spec `8a3a0cae-1226-450`：原P2静态闭合，无确认缺失/错实现/越界。Standards/安全 `81ec6924-7d26-4a1`：无确认阻断缺陷。两者Astra/Medium，完整候选/依赖/测试静态审查，不冒充动态测试。

## 主代理实际复测

证据根 `D:/code/tmp/go-coach-notes/credentials-08A/`：

- `main-a1cd762-desktop.log`：`npm.cmd run test:desktop`包含typecheck/build/实际pack，**56/56 passed，5.2m，无skip**。原32＋原凭据9＋生命周期15全部保留。
- `main-a1cd762-web.log`：独立自有5194，打包结束后串行 `npm.cmd test -- --workers=4`，**133/133 passed，2.8m，无skip**。未操作5173。
- 真exe/合成Key：实际Windows加密保存/重启恢复/替换/删除，坏输入/密文/平台异常/ACL失败；真实IPC恶意外窗/iframe、产品窗CSP；无旧Key回显/业务窗API；原引擎选择与退出语义。
- 生命周期真实平台门覆盖：永不返回encrypt仍含已启动C#引擎close/closed、exit0；取消旧OS后新保存/旧finally不释放新busy；available/decrypt/read挂起实际10秒后可回放及新保存、释放迟到失败不覆盖；writeFile/sync/rename各取消、超时失败、未释放时退出；旧凭据保留或已派发rename完成时诚实报告不确定。
- `main-a1cd762-exits.json`：55个fixture记录、76次app退出，71次0及5次原有明确故障注入1，survivors为空。直接startup/smoke仍各自验证，不以记录数冒充测试数。
- 主检查实际空密码窗截图；本轮密文副本只有version/ciphertext（v1、52字节密文），正例明文检查75个测试/profile文件与8个证据文件无两个合成Key的UTF-8/UTF-16LE匹配，观察HTTP4次无Key。不是内存抹除证明，也不检查真实用户profile。
- 拒绝型本地代理测试 `denied-background-requests.json` 为[]；仅证明该测试时段经Chromium代理的企图未观察到，非全协议抓包。
- 主读取汇总时一次PowerShell管道将中文路径转成问号导致ENOENT；改按磁盘文件名枚举核查成功。这是证据读取工具编码错误，不是产品失败，也未重写原测试证据。

## 最终完整目录包与独立探针

**`D:/code/tmp/go-coach-desktop/windows-x64-a1cd762-main/Go Coach.exe`**

- 主从自身已测pack复制全目录：**94文件、386482816字节、23个app资源**。`main-a1cd762-package.json`逐文件SHA-256与字节一致；精确desktop白名单，无测试adapter、模型、源码测试、operator或Key。旧15包及所有候选保留。
- 最终复制包再次运行主原故障探针：外部OS加密完成仍保持不释放，原生退出后约118ms已exit0、密码窗关闭，无强制清理。`main-hung-encryption-a1cd762-final/result.json`明确OSCompletionReleased=false。不是只有从源码推断；先一次385ms复测也成功，原字段exitAfterRelease命名不准确，因此最终记录明确是否释放，旧记录保留。
- 最终复制包真实KataGo v1.18.1 OpenCL＋原b18：Chinese提子/pass5局面、Japanese HA2白先4局面，**9局面＋9次逐手依据核对成功**，无读取凭据或AI请求；耗时4.449s/1.866s仅合成短谱，不是性能/教学承诺。
- `main-gpu-a1cd762/`含HTTP/依据交换、配置与所有权检查：app22544/engine29332及记录后代全部正常退出，app0、无强制清理、58998释放、operator哈希不变。使用隔离userData、无外部Node/npm产品PATH、原生dialog适配；真实分析响应仅平台原样缓冲，不是原始引擎协议独立比对。

## 安全披露与未覆盖

- 最初08A测试曾发现en-US字典文件，拒绝代理捕获redirector.gvt1.com CONNECT；单独禁spellcheck仍不够，清默认/密码session字典语言后通过。此前未全面阻断背景网络，不能声称历史全程零外网。没有账户/模型调用或真实Key使用证据；不把局部观测宣称完整历史网络证明。
- DPAPI不能防同Windows用户的恶意程序；不保证JS/OS内存抹除、跨用户/跨机器迁移。不要把单个credentials.json当作可移植密钥备份；恢复失败须重新配置，不能重置未来预算。
- 产品密码窗自身子frame被CSP阻止；恶意外窗iframe首先被sender拒绝，senderFrame守卫独立充分性仍含静态核验，不混淆两者。
- mkdir/open/close/unlink永久挂起、恢复重加密提示、真实内核磁盘死锁/断电/OS关机/主进程强杀、人工密码粘贴/native确认/SmartScreen/跨机器未新增动态保证。保存round-trip的重加密提示停用有平台测试。
- 底层OS Promise不是被真正取消；已发出rename可能完成。正常退出时不返回的文件操作可能留下本次空/密文tmp，不能保证退出后finally运行；不会扫描删除别人的历史文件。
- 此片没有授权/预算账本、DeepSeek网络出口、中文策略生成。¥50保护尚不可用，绝不按本地配置成功暗示已接通或允许付费。

## 后续

08B须先详细确认外发字段、模型/参数、政策风险与计价/预算边界，再做受控授权与持久预留；真实调用另授权。08整体Execution继续in-progress，05/10/06/11/12原未完成边界保持。
