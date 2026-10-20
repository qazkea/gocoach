# 08A 离线本机凭据：实现候选记录

Execution: in-progress（仅实现候选，待独立双审及主验收；08整票不完成）

## 范围与隔离

- 基线 `13c4f8461c2e603c2f3b7a60bf27fc5aba84ad65`。仅在隔离 worktree `C:/Users/789/AppData/Local/Temp/pi-agent-71d4b80a-af74-403-ae9f85ce` 改代码；主源码及旧交付包不写。
- 分支 `implementer/credentials-08A-71d4b80a`。没有push、发布、子代理调度、预算账本、SQLite、账户/推理接口或中文生成。
- 只用测试自建 userData、合成Key、合成operator/外部引擎。未读取真实Key或既有operator，未运行KataGo/GPU模型。不安装依赖；复制已安装node_modules，并显式复用既有Electron44.8.0分发。网页自有5193，启动前查空闲，未操作5173。
- 完整读取本票设计、桌面安全预检、任务、14设计、15验收、工作流及TDD/测试/mock约定。最高入口为真实打包exe→原生菜单→专用密码窗；仅native dialog/safeStorage/Windows ACL/外部引擎/拒绝型本地代理是平台seam，不直接调用产品存储私函数或伪造ipcMain事件。

## 改动

- `desktop/credentials.mjs`集中持有凭据与密码窗生命周期；main仅获状态/菜单和暂停能力，无Key getter。保留原引擎/文件菜单索引及utility ack+exit关闭路径。
- 独立非persist session、sandbox/contextIsolation/webSecurity、无Node的固定file页面；请求仅准入三个明确静态资源。禁导航/重定向/frame/webview/新窗/权限/下载，CSP禁connect/inline/eval/form/frame/object。
- `.cjs` preload只提供固定submitKey/cancel。main核对窗口webContents、当前mainFrame、规范完整URL与活跃生命周期；disposed native frame按denied处理，不透传异常。去首尾空白后只接收1–512可见ASCII，拒绝内部控制/空白，不要求sk前缀、不验证账户或余额。
- Windows ready后异步safeStorage，先available、加密、本机解密round-trip；启动有界读取16KiB、严格版本/schema/规范base64后解密验证，明文只在main短暂存在。shouldReEncrypt选择明确停用重配，不循环。无明文回退。
- 固定userData/go-coach/credentials.json；唯一wx临时文件、writeFile完整写、sync、close、rename；失败清理本次临时文件，旧文件不主动删除。删除只unlink凭据，有默认取消原生确认；未来费用/历史哨兵文件保持不变。rename不被当作预算事务保证。
- 保存、替换、删除有main侧busy门禁。取消/关闭/主退出失效epoch；加密晚到不开始新写；已经开始的写可完成，退出等待在途操作；不能向旧窗报成功。密码窗关闭不结束复盘，主关窗会关闭密码窗并走既有引擎回收。
- `package.json`精确列举desktop产物；不打包源码测试、测试Key或观察adapter。普通主业务窗仍无preload/secretAPI。

## 重要发现：Chromium后台字典下载（真实RED→GREEN）

最初只观测renderer HTTP和utility消息，不能覆盖Chromium后台网络。后续检查自建profile时发现en-US字典文件，因此增加**只拒绝、绝不转发**的本地HTTP CONNECT代理作为外部网络平台seam。

- `network-red.log`：实际exe配置合成Key后，代理记录两次 `CONNECT redirector.gvt1.com:443`，测试真实失败；代理直接502，未向该远端建立连接。
- 第一次修复只设`spellcheck:false`及`setSpellCheckerEnabled(false)`仍失败（`network-green.log`，名字不是通过证明）。
- 默认业务session及新临时密码session同时在创建窗口前`setSpellCheckerLanguages([])`后，`network-green2.log`通过。保留禁用拼写检查；这是移除无关后台下载，不改变复盘/引擎协议。最后完整41桌面及最终复制包9凭据测试均再次通过拒绝型代理测试，记录为空。
- **不能声称此前所有运行零外网**：发现前未对Chromium背景下载作全进程阻断，profile确有字典文件，历史测试可能已发生背景字典下载。没有主动调用账户/AI或发送Key/棋局；renderer/utility观测未发现合成Key。但这些观测不构成对历史背景网络的全面保证。保留全部失败与文件检查证据，提交主代理复核，不能淡化成“全程无网络”。

## TDD与实际失败

1. 第一纵切片先写真实exe保存/恢复/替换/删除测试：`red.log`实际失败，缺少讲解菜单，期望“未配置”得到undefined；同入口`green.log`通过真实Windows safeStorage保存和恢复。
2. 输入、边界和故障补充测试验证同一安全实现，没有声称每个防御分支都曾独立RED。最初批次有测试平台错误：query/hash本身使窗口失效销毁，而不是能等待denied返回；native方法未bind导致延迟adapter返回unavailable；fixture第一窗口可能是密码窗，不能用它代表主窗退出。修正测试的预期/平台调用后保留日志。
3. 其他窗口preload最初取自未暴露的preferences.preload，导致API不存在；改成明确产品路径。about:blank子frame并不执行预期preload；恶意外部BrowserWindow改用非sandbox测试客户端与data子frame，实际发IPC并收到denied，**没有放宽产品窗**。`boundary-first/second/third.log`分别为2/1/1失败；`boundary-fourth.log`通过对应边界。
4. 首次typecheck失败：Electron公开类型没有getLastWebPreferences；平台测试延续已有测试的any cast，产品无变化。
5. `desktop-final2.log`为39通过/1失败：Windows deny-delete ACL同时使测试readFile报EPERM。先恢复该测试ACL再验证文件不变，随后全40通过。产品删除已正确报告不可用。
6. safeStorage重加密提示adapter进一步绑定native方法，并断言实际返回提示一次，防止把adapter自身异常误当提示覆盖；最终全40及后续41通过。
7. `layout-red.log`实际上通过，没有把它当RED。截图中的提示完整可见，未为此改窗口尺寸。
8. 后台字典下载是第二个产品行为的真实RED→GREEN，见上一节。

## 最终执行结果

证据根：`D:/code/tmp/go-coach-notes/credentials-08A/implementer/`。

- `npm.cmd run build`（含tsc、Vite、server bundle）：通过。最后打包前日志`build-network2.log`。
- `electron-builder --win --x64 --dir --publish never --config.electronDist=D:/code/tmp/go-coach-notes/evidence-15/sqlite-preflight/runtime`：通过，`pack-network2.log`。没有下载Electron。
- `playwright test -c playwright.desktop.config.ts`：最终 **41/41通过、0跳过**，`desktop-final6.log`；保留原32测试语义，新增9凭据/网络测试。
- `GO_COACH_TEST_PORT=5193 npm.cmd test -- --workers=4`：**133/133通过、0跳过**，`web-final.log`。与build/pack串行。此后只变更桌面凭据/宿主及桌面测试，网页代码未变；未虚称另跑真实GPU/9依据。
- 最终持久复制包另设`DESKTOP_TEST_EXE`跑credentials：**9/9通过**，`candidate-offline.log`。此前40桌面及8凭据证据是历史阶段，不作为网络修复最终依据。
- `git diff --check`通过。所有最终测试无skip。

### 动态安全证据与限制

- 实际Windows safeStorage保存/重启恢复/替换，没有用fake crypto代替正例。密文副本`candidate-offline/本机合成Key实际OS加密保存_重启恢复_替换与默认取消删除/ciphertext-record.json`；同目录password.png为重开空输入截图。
- 明文扫描：自建profile/测试目录所有持久文件及本次stdout/stderr/截图/密文证据，UTF-8和UTF-16LE两个合成Key无匹配；记录`plaintext-check.json`。不把必要的本次专用renderer输入或JS/OS内存宣称零残留。
- 观察型`desktop-tests/credentials-platform.mjs`只在测试临时复制包替换entry，包装真实utilityProcess.fork/postMessage以记录实际消息，继续导入原main；产品包不含adapter。实际close/closed存在且无合成Key；HTTP观测没有Key或外站业务请求。记录`utility-observations.jsonl`及`secret-window-main-close.json`。
- 实际IPC：恶意另一webContents即使加载同file也denied；外部恶意iframe实际IPC也denied。产品密码窗iframe被CSP阻止；该子frame不能在不改产品安全设置时强行到达senderFrame比较分支，因此**主密码窗自身子frame守卫的独立充分性仍是静态核验**，不把另窗拒绝冒充单独证明frame比较。query/hash会销毁失效窗；取消/旧窗加密晚到及退出保持旧密文；无伪造ipcMain业务event。
- native safeStorage不可用、加密异常、解密异常、一次shouldReEncrypt提示：固定错误且保留旧文件。规范base64但无法DPAPI解密、未知schema字段、超16KiB均启动停用。
- Windows ACL模拟无法创建临时文件及无法删除，验证不毁旧密文/不谎报成功；**未单独故障注入write中途、fsync、rename及已开始写入精确瞬间的关闭**。实现路径有finally及epoch/等待，但这些精确窗口尚无动态证明。
- 恢复shouldReEncrypt、非Windows、OS加密无限不返回、跨Windows账户/机器、断电/主进程强杀、内存抹除、人工粘贴/原生确认/SmartScreen未新增动态保证；safeStorage提示在保存round-trip分支有实际覆盖，启动提示分支静态核验。
- 拒绝型代理覆盖测试期间Chromium通过代理的HTTP(S)后台企图，不是OS级全协议网络抓包；没有宣称任意系统服务流量都被该测试证明。

## 完整候选、退出与交接

最终候选：`D:/code/tmp/go-coach-desktop/candidate-08A-20261020-implementer-71d4b80a-offline/Go Coach.exe`。必须保留整个目录。96文件、386591979字节，复制前后逐文件字节相等及SHA-256见`candidate-manifest-offline.json`。

较早的`...71d4b80a`和`...71d4b80a-final`目录保留、不覆盖，但**不是后台网络修复后的候选**，不要用于最终验收。旧windows-x64-43d955b-main未修改。

每测试记录精确PID/创建时间的所有权及退出；最终完整回归正常退出0，既有故障注入场景明确退出1。fixture回收survivors均空；额外`process-audit-offline.json`汇总历史所有权身份，无存活匹配进程。没有按端口或进程名查杀。fixture自建目录在结束后删除，证据、候选及此worktree保留供审查。5193已释放。

独立审查和主代理验收尚未进行，尤其需要复核上述背景网络发现及精确持久写/关闭边界。没有把本片宣称为预算保护完成、DeepSeek接通或08整票done。
