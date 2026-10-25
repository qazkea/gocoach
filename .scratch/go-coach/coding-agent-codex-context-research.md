# Codex：压缩、恢复与在途输入源码研究

> 后续产品政策更新：本报告写作时Go Coach仍要求逐模型请求确认；用户此后已明确改为本次提问授权必要模型请求/压缩，并选择新问题排队、同谱重导先提示。下文产品建议按写作时前提保留，当前以[上下文设计](coach-context-design.md)为准；不改变所查版本的源码事实，也不授权代理现在真实调用。

## 基线与边界

核心基线为官方发布 `rust-v0.100.0`（2026-02-12），固定提交 **`8272f9a71ee7364d8de992418103628f8a17eb6f`**；[官方 tag 对象](https://api.github.com/repos/openai/codex/git/tags/3b6e74b32888f7c00632e200a347c7cfba6e4ddf)可核对。先探查过 main `970111f6cb62cc02fe36a82ea7d71b37a2889c97`，发现相关模块已大幅拆分，故选择发布快照追完整核心路径，**下文不代表最新版本行为**。只读公开 HTTP 源码和官方文档；未运行项目或推理，未读私人记录，未审计全部 GUI、崩溃恢复和竞态。

## 1. 自动压缩究竟压什么

**事实**：`run_turn → run_pre_sampling_compact → run_auto_compact` 在采样前检查；工具循环中，达到阈值且仍需 follow-up 时也压缩，成功后 `continue`。阈值默认是模型原始 `context_window` 的90%，显式 limit 也被钳制至该值；缺少两者时调用方用整数最大值。另有默认95%的有效窗口字段，不能把两者混为同一阈值。[1][2]

比较量不是累计消费 token：`get_total_token_usage` 使用最后一次 API 的 `total_tokens`，加其后新增项目估算；服务端未计旧 reasoning 时还补估它们。估算基于字节，不是精确 tokenizer，也不是按聊天轮数。[3]

**本地编排分支**：克隆工作历史，追加摘要指令，向当前模型发流式请求；指令要求进展、决定、约束、待办与关键引用。成功后重建为初始上下文＋从新到旧挑选、合计约20,000 token 的用户文本＋摘要（user 角色），再保留 undo 快照。不是“最近若干完整问答”：旧 assistant 和工具调用/结果不逐条回填，只可能经摘要承接；边界用户消息可截短。新问题在采样前压缩之后才正式记录，因此正常路径不被那次摘要吞掉。[1][4]

**远程分支**：OpenAI provider 选择 `compact_remote`。发送工作历史与基础指令；超出有效窗口时先从尾部删除 Codex 生成项目，直到适配或遇到不能删的项目。调用返回 replacement history，过滤旧 developer/上下文包装并重新注入当前初始上下文，另保留 undo 快照。工具配对还受 `for_prompt` 规范化约束；服务端究竟保留多少近期问答、如何编码工具细节，不能由客户端推出。[3][5]

## 2. 手动、额外请求与失败

**事实**：手动 `Op::Compact → CompactTask` 走同一 provider 分流，是独立任务；它本身不继续回答原问题。自动路径则成功后继续原循环；这些调用链没有逐次费用预览/确认关卡。“local”只是客户端组织摘要，不表示离线或免费：它也调用模型；remote 则额外 POST `responses/compact`。[1][4][6]

本地压缩遇 `ContextWindowExceeded` 会移除最老历史项再试（关联调用/结果一起维护）；只剩一项仍失败便报错、将窗口记满。普通错误按 provider 重试次数退避；中断直接返回。远程失败报错并返回，所查路径没有自动回退本地。自动压缩失败会终止本次 `run_turn`；尤其该版预压缩失败发生于新问题正式入历史之前，不能承诺问题已可靠保存。普通回答请求超限只记满并返回错误，不是当场无限压缩重发。[1][3][4][5]

**API 文档与实现分开看**：当前官方文档还介绍 `/responses` 内 `context_management.compact_threshold` 的服务端自动模式，无须独立 compact 调用；这不是上述发布版客户端路径。独立 compact 输入仍须适配窗口，返回可能含保留项和不透明加密项；文档要求作为下一窗口使用，不能据此声称可精确复述全部旧话。[7]

## 3. 存档、显示历史与模型上下文

**事实**：new/fork 生成新 ThreadId；resume 复用存档 ID、路径。fork 重建继承历史并写入新存档；resume 重建旧历史，不等于重放旧请求。rollout 采用追加写入，但有持久化类型过滤和缓冲/flush；压缩追加 `Compacted` 标记，不能仅凭日志存在就断言所有工具原始字节、流式增量或崩溃前内容均保存。[8][9]

恢复模型上下文时逐项读日志：遇 compact 就替换历史，或从摘要重建；之后再加后续项目。界面返回的 `thread.turns` 则经 `build_turns_from_rollout_items` 另行投影。故“历史能显示”不等于“本轮全发给模型”；工作历史本身还会裁工具输出、规范化调用配对。[3][8][10] 本地压缩代码更明确警告多次压缩会降低准确性。[4]

## 4. 输入、取消和运行中恢复

**可证状态机**：空闲输入启动任务；已有任务时 `steer_input` 将输入放入该 active turn 的 pending 队列，循环边界取出后入历史，不会即时改写已经发送的请求，也不会自动 interrupt。显式 `turn/steer` 要求 `expectedTurnId` 匹配，否则拒绝；它不是“保证稍后另开一轮”的队列。[1][10]

取消路径取走 active task、清 pending，取消 token，等待短暂清理后 abort；写中断标记并 flush，再发带旧 turn ID 的 `TurnAborted`。已执行工具可能部分生效，不是事务回滚。注意该版 app-server `turn_interrupt` 实际忽略请求中的 turnId、按 thread 提交 interrupt，不能把文档描述误认成严格防竞态实现。[10][11]

运行中切换界面的行为**未核实**。已查 app-server 的 resume 是读 rollout 后调用 manager 创建运行实例、挂监听，不是重新提交未完问题；manager 最终以 ID 插入线程表。这不足以证明“恢复正在运行的同 ID”可安全接管，或切 thread 会停旧推理；不应照搬成后台续跑承诺。冷恢复还原历史不等于恢复网络流、工具进程或 pending 队列。[10][12]

## 5. 对 Go Coach 的推论，不是实施批准

- 借鉴分离“本机原文存档／可见聊天／模型工作窗口”，摘要带来源与版本；本项目要求完整原文保留，应独立验证，不能拿 Codex 日志作保证。
- 棋谱身份与聊天 thread 身份分开。同盘重导可找到候选聊天，但自动 resume、询问选择或另开会话，是产品决定；Codex 的 resume/fork 不能替围棋定义“同盘”。
- 回答绑定 thread、turn、提问时棋盘/分支快照；切手不应把旧回答冒充新局面答案。显示在原话题并标注来源、后台继续还是取消、是否提示未读，均待用户决定。
- 取消须保留旧 turn 的终态和部分回答归属，迟到事件按身份处理；不要仅凭当前选中棋盘接收流。
- 可借鉴容量阈值与失败显式化，不照搬90%或20,000。费用预算已取消，但逐次付费请求确认未取消：摘要请求、重试和后续回答均须纳入现有授权设计，不能直接照搬 Codex 自动继续。

## 关键来源（均为一手）

以下源码链接统一固定上述发布提交；官方 API 文档为读取时版本，不与发布快照混用。

[1]: https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/codex.rs#L4010-L4350
[2]: https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/protocol/src/openai_models.rs#L239-L270
[3]: https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/context_manager/history.rs#L64-L345
[4]: https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/compact.rs#L31-L420
[5]: https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/compact_remote.rs
[6]: https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/tasks/compact.rs
[7]: https://developers.openai.com/api/docs/guides/compaction
[8]: https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/codex.rs#L2244-L2278
[9]: https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/rollout/recorder.rs#L316-L459
[10]: https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/app-server/src/codex_message_processor.rs
[11]: https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/tasks/mod.rs#L185-L308
[12]: https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/thread_manager.rs#L299-L522

补充核对入口：
- [new/resume 身份](https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/codex.rs#L974-L994)、[初始历史恢复](https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/codex.rs#L1417-L1510)、[steer 校验](https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/codex.rs#L2658-L2691)。
- [摘要提示词](https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/templates/compact/prompt.md)、[真实 compact HTTP 端点](https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/codex-api/src/endpoint/compact.rs#L32-L59)、[持久化过滤](https://github.com/openai/codex/blob/8272f9a71ee7364d8de992418103628f8a17eb6f/codex-rs/core/src/rollout/policy.rs)。
