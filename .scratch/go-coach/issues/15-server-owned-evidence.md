# 15：服务端讲解依据与桌面核对

**Parent:** desktop-review-scope.md；deepseek-integration-plan.md

**Category:** enhancement

**Status:** ready-for-agent

**Execution:** done

**Blocked by:** 09、13、14（均已完成）。不依赖真实DeepSeek外发/费用授权。

## What to build

按照[15-design.md](../15-design.md)，让已校验的真实引擎分析获得服务端持有的不透明证据引用，桌面按需查询当前实战手的前后估值与可复算棋盘事实。为后续中文解释提供可信来源，不接受客户端估值充当事实。

## Acceptance criteria

- [x] /api/analyze仅在校验成功且会话有效时签发引用，绑定完整历史/规则/贴目/让子/实际generation与分析条件。
- [x] 证据内存有数量、序列化字节和时间上限，取消/失败不签发，失效/淘汰明确拒绝，不保存平方数量的Replay帧。
- [x] 同源POST公开查询严验期望上下文及前后完整前缀，拒绝伪造数值、错手、同盘不同历史、混合会话、过期引用和跨域请求。
- [x] 真实桌面UI按需展示初盘/实际手/提子/己链气等本地事实，落子前候选属于本手方、落子后属于下一方；区别估值/事实/未知，不冒充中文AI解释。
- [x] 切手/换谱/会话变化清旧结果并隔离迟到，查询不启动GPU/AI或自动重试；过期明确要求重新分析，不用浏览器数据降级伪造。
- [x] 真实浏览器和打包exe全流程RED→GREEN、原110网页/30桌面与新增回归、类型/构建、独立Spec/Standards及主代理整合复测有证据；未覆盖的边界单列。

## Comments

主代理已验收43d955b：双审无确认缺陷，主跑133网页/32真实桌面全绿，最终复制包9个真实GPU局面及9次依据核对成功。完成范围及64MiB等未动态覆盖边界见[15-main-acceptance](../15-main-acceptance.md)。新包 `D:/code/tmp/go-coach-desktop/windows-x64-43d955b-main/`，旧包保留。本地事实/估值不是中文策略讲解。

用户已同意继续官方DeepSeek接入开发，但此票仅本地证据基础，不能标05/08/10完成。未授权读取Key、外发棋局、真实推理/付费；月50元安全门和密钥配置将按后续08设计实施。不停止用户5173、不push/发布，不新增系统或引擎依赖。
