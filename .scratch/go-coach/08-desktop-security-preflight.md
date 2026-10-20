# 08 桌面安全预检（研究，非实现/真实调用授权）

基线：Windows 11 x64、Electron 44.8.0、内嵌 Node 24.22.0、builder 26.15.3（后者按任务输入）。Electron 版本已核对本地 `node_modules/electron/package.json`；Node 版本与官方 [DEPS](https://github.com/electron/electron/blob/v44.8.0/DEPS) 相符。只读官方资料、类型及 `desktop/main.mjs`，未运行 Electron/数据库、未读取真实 Key、provider/auth 或业务 userData。下列方案待主代理决定；模型、字段、政策、费用仍未授权。

## 1. safeStorage

- Windows 同步/异步均为 DPAPI 保护：防其他用户，不防同用户恶意程序；不是应用独占保险箱。[44.8 文档](https://github.com/electron/electron/blob/v44.8.0/docs/api/safe-storage.md)
- `isEncryptionAvailable()` 应在 ready 后检查；异步应等待 `isAsyncEncryptionAvailable()`。44.8 确有 `encryptString/decryptString` 和 `encryptStringAsync/decryptStringAsync`，`encryptStringAsync` 返回 `Buffer`，`decryptStringAsync` 返回 `{result,shouldReEncrypt}`，不是字符串。官方推荐异步；本地 `node_modules/electron/electron.d.ts:12120–12187` 与[版本源码](https://github.com/electron/electron/blob/v44.8.0/shell/browser/api/electron_api_safe_storage.cc)确认。源码中临时不可用是 Promise rejection，不能假定返回 `isTemporarilyUnavailable` 字段；文档关于重加密后再调用 decrypt 的表述不宜照抄为循环。
- 实施约束：检查失败、加解密异常、密文损坏、持久化失败均停用；不回退明文、不覆盖原有效凭据、不记录 Key。选择异步须设计重加密保存路径。
- 不能承诺复制密文跨 machine/user 恢复。DPAPI 通常要求同登录凭据、同电脑；漫游配置存在例外，不是通用迁移保证。迁移失败应重新配置，而非清空预算。[Microsoft](https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata)

## 2. 输入方案

**建议首片原生菜单→文件导入**：`dialog.showOpenDialog` 仅 main 收到路径；main 有界读取、严格 UTF-8/内容校验，加密保存后不持久化路径或明文、不发给业务 renderer。当前 main 已有原生菜单/dialog，业务窗无 preload，改动面最小。[dialog](https://github.com/electron/electron/blob/v44.8.0/docs/api/dialog.md)；本地 `desktop/main.mjs`。代价：用户先创建明文文件，原文件、编辑器备份/同步副本仍有泄露风险；“不保留路径”仅指本应用，不保证 OS 最近文件记录或内存抹除；应明确提示用户自行处理，不能宣称导入自动安全删除。

**隔离密码窗**：体验更好、不要求明文文件，但新增可接触输入 Key 的专用 renderer。保持 sandbox/contextIsolation、关闭 Node、固定本地页面、禁导航/子窗/外网；用 `.cjs` preload 的 `require('electron')`，sandbox preload 不支持 ESM imports，main `.mjs` 不改变该规则。[ESM](https://github.com/electron/electron/blob/v44.8.0/docs/tutorial/esm.md)

只桥接提交/取消等固定方法，不暴露 `ipcRenderer`、任意 channel、事件对象、读 Key/文件能力。main 同时核对 `event.sender === 密码窗.webContents`、非空 `senderFrame === webContents.mainFrame`、精确允许的文件 URL（规范生成，拒绝 query/hash/其他文件），并验证窗口生命周期及参数；仅比较 `file://` origin 不足。拒绝 iframe/导航后旧调用；销毁窗后撤销入口。普通业务窗只能获配置状态，不能读已存 Key。[IPC 安全](https://github.com/electron/electron/blob/v44.8.0/docs/tutorial/security.md#17-validate-the-sender-of-all-ipc-messages)。官方更推荐自定义协议；若选文件页，精确来源核对是本项目额外限制，不是官方通用认证保证。

## 3. 多实例与预算边界

Electron 锁取 `DIR_USER_DATA`；Windows Chromium 以 profile 路径找窗口并在该目录建锁。不是全机器/全 profile 的应用名锁：不同 `--user-data-dir` 可独立；不同安装路径若指向同一目录可竞争同锁，安装路径本身不是隔离键，路径别名仍须验证。[Electron源码](https://github.com/electron/electron/blob/v44.8.0/shell/browser/api/electron_api_app.cc)、[对应 Chromium](https://github.com/chromium/chromium/blob/152.0.7977.167/chrome/browser/process_singleton_win.cc)

实施约束：固定生产预算位置，不接受参数改变账本；若只用 userData，承诺只能是“同一 userData”，不能写“同 Windows profile”。启动最早取得锁，失败分支不得继续 ready 初始化/utility/请求。`app.quit()`可被取消，Windows 注销不保证 quit 事件；停止请求、持久化并停止自有出口之前不得主动 release。[app](https://github.com/electron/electron/blob/v44.8.0/docs/api/app.md)

同库 SQLite 事务可处理预留竞态，不必再叠 fs 锁；单实例仅作生命周期防线。若选文件账本，需覆盖整个读-算-写周期的独立排他 `open('wx')`，不是 exists→open；不明锁所有者/PID 复用/崩溃残锁一律阻止，不能凭超时删锁。跨 dataDir 必须共享固定锁和账本；本应用仍不能限制外部应用消费或用户篡改。[Node fs](https://nodejs.org/docs/v24.22.0/api/fs.html)

## 4. 持久预留选择

Node 24.22 的 `node:sqlite` 是内置、无需实验开关，稳定度 **1.2 Release candidate**；`DatabaseSync` 全同步，可能阻塞 main。[版本文档](https://github.com/nodejs/node/blob/v24.22.0/doc/api/sqlite.md)。本地 `node_modules/@types/node/sqlite.d.ts` 存在不等于运行时存在。Electron main/utility 有 Node 环境，但这不是每个内置模块的分发保证：[utility](https://github.com/electron/electron/blob/v44.8.0/docs/api/utility-process.md)、[构建补丁中的 node_use_sqlite 条件](https://github.com/electron/electron/blob/v44.8.0/patches/node/build_add_gn_build_files.patch)。**本机 main/utility/打包 exe 可用性均未动态验证**；不得据版本号直接宣布可用。

候选优先 SQLite：`BEGIN IMMEDIATE`→读取预算/幂等状态→预留→`COMMIT` 成功后才允许外发；争用可报 BUSY，任何提交不确定都不得发送。[事务](https://sqlite.org/lang_transaction.html)。WAL+`synchronous=FULL` 每次提交同步；NORMAL 断电可能丢已提交事务。回滚日志 FULL 不等于普遍断电耐久，必要时 EXTRA。[同步语义](https://sqlite.org/pragma.html#pragma_synchronous)。需核验实际 PRAGMA、限定本地盘，保留 WAL；不能仅复制 db 或删 WAL 恢复。保证依赖 OS/存储正确同步，不抗恶意回滚。[WAL](https://sqlite.org/wal.html)

文件替代：排他锁→同目录唯一临时文件→完整写入/fsync→rename；Node 仅承诺 fsync 请求受 OS/设备影响、rename 替换目标，并未保证该组合在 Windows 断电下完成目录项耐久或多步骤事务。须自行设计恢复与不确定状态，复杂度高于 SQLite，不能把 rename 成功等同预算硬保证。[fs](https://nodejs.org/docs/v24.22.0/api/fs.html)

## 最少后续动态验收（本次均未执行）

1. 无写探针：实际 main/utility/打包产物的版本及 `node:sqlite` 导入/`DatabaseSync` 存在；不创建数据库。
2. 获准隔离测试目录后：合成 Key ready 前后、异步 round-trip、不可用/坏密文/写失败；跨用户迁移失败不得重置预算。
3. 双启动：同目录、不同目录、不同安装位置、退出被取消/强杀；同库并发只能有预算允许的预留。
4. 假出口前后崩溃、COMMIT/BUSY/磁盘失败、WAL恢复；unknown 不退款。若选密码窗，另验恶意 iframe、业务窗伪造、导航与重复提交。测试不使用真实 Key/账户/推理，不新增安装或收费。
