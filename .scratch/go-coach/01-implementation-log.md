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

## 暂停点 / 必须继续
等待主代理确认 RU profile；当前仅基础切片，不可当完整任务交付。
拟 Japanese = 明示简单劫/禁止自杀回放 profile；其他标签明确拒绝；
不裁定长周期循环/终局争议，不计算胜负。不把标签当完整国家规则。
目前尚未实现提子、自杀、劫、占点、让子/setup、pass、完整属性支持范围校验，
不能据现有测试声明可用棋谱合法性。需继续逐条 RED/GREEN。
待补：GBK/坏编码、转义、缺省 Latin1 区分 Windows1252、PL、HA/AB、
未知 RU、异步旧读取竞争、隐私出口观察、键盘与支持范围说明。
父规格与任务票未修改、未标 done。
