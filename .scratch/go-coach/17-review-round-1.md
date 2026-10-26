# 17：第一轮独立审查

状态：需修复，未验收。冻结提交 `d7931c1e09152dcdbadb5588597c8c913f596cf6`；基点 `3853e082a3d7a9b7a2e000b3d408abbba50baa36`，25文件。审查工作树 `D:/code/tmp/go-coach-review-17`。实现已经fast-forward整合，但整合不代表通过验收，18仍未解锁。

## Standards

reviewer `c4e72738-2bd5-4cc`：有依据的规范违反0，有实质影响的判断型smell 0。已检查全部diff及核心源码、新测试；仅静态审查，没有执行测试。

## Spec

reviewer `0f51d22f-4179-47f`：1项P2。扫描完成后进入对照、A已显示，保持原手及引擎会话不变直到引用超过TTL，点击展开推荐仍使用旧verification.data。EnginePanel的follow未重新核验；useReviewEvidence的会话watch不能代替服务端TTL核验。当前TTL测试只覆盖先过期再进入对照。

主代理已读取实际hook、follow及server/evidence.ts，确认该路径有缺口。修复必须在两个展开入口使用新核验成功的结果；不补跑引擎、不改服务端协议，不让迟到核验把用户从新局面/自由试下拉回旧PV。hook的load包含长连接循环，不能直接await它来获取一次查询结果并因此永远等待。

## Visual

finish reviewer `4242240b-0702-4be`：`disposition: fix`。15张具名网页/桌面截图有效；单盘、双栏、窄窗、浅灰青/淡砂/白面、诚实未启用与稳定输入均符合契约。1项material fix：紧凑走势图仅有不可见aria-label，缺可见的“黑方胜率”说明及当前原谱手定位，未知值需明确。增加文字与非仅颜色的定位标记，保持紧凑，不增加常驻详情栏。

本轮没有独立QUALITY BAR卡，评估依据为已确认Operate世界、方向契约及daylight critique-reference；不是comp-led像素复刻。主代理已实际查看1440×900渲染确认可见语义缺口。新世界DESIGN.md按约定在视觉收口后从实际代码记录。

## 修复与验证门槛

- 两项均交implementer，以真实UI/HTTP逐行为RED→GREEN，保留旧断言；新增在对照打开后推进外部时钟的用例，并覆盖重新核验迟到时的模式切换。
- 原始d7931c1截图保留在 `D:/code/tmp/go-coach-notes/17-review-round1-d7931c1/`，修复后在原canonical截图路径重新捕获，供原finish reviewer按同一路径作verdict；新测试日志另存，避免混淆旧结果。
- 修复后复核Spec/Standards及视觉verdict，安排本地整合和主代理重新build、全套网页及新打包桌面回归。上述静态审查和实现代理159/57记录均不替代主代理整合验收。
