# Claude Code 上下文与会话：一手资料研究

> 后续产品政策更新：本报告写作时Go Coach仍要求逐模型请求确认；研究呈现后用户明确改为发送后自动处理本次问题的必要请求/压缩。下文相关权限建议保留为当时前提，当前以[上下文设计](coach-context-design.md)为准；外部产品事实不因此改变，代理真实调用仍未授权。

访问日期：2026-10-25。仅阅读公开官方文档；未安装、运行研究项目，未查看个人会话、配置或凭据，未发模型/embedding请求。下述是文档契约，不是源码或端到端验证；在线文档会更新，版本差异不能抹平。Code产品、Messages API与SDK辅助循环分别标注。

## 1. 何时压缩、留下什么

**Code**接近上下文上限自动压缩；先清理旧工具输出，再按需摘要。手动可用`/compact [instructions]`；可在CLAUDE.md写“Compact Instructions”。文档称保留请求与关键代码片段，但早期详细指令可能丢失，不是无损记忆。[1] 阈值随模型/配置变化，可用`/autocompact`调整，不能概括成固定百分比。[2]

恢复压缩过的会话时，工作上下文是“最后摘要＋该次未摘要消息＋之后消息”，不是全部历史。[4] 文档没有给出统一的“总保留最近N轮”算法；摘要取舍及工具结果精确淘汰排序仍未知。明确保留后段原文的操作是`/rewind`→“Summarize up to here”；原消息仍在transcript，摘要不改磁盘文件。[5] 压缩后根CLAUDE.md等重注入，文件最多重读五个，超过5,000 tokens的文件只以路径引用返回；这也不等于所有工具结果永久留在模型上下文。[2]

**API/SDK**另有服务端按需压缩、阈值压缩；按需方案由调用方决定摘要及历史替换，SDK tool runner可代发请求；保留近期原文需要相应组织历史。[8] 不能据此断言Code内部使用同一API或同一算法。

## 2. 推理、用量与确认

**Code**文档明确：`/compact`读取被摘要对话，本身就是大请求；摘要请求还继承会话thinking配置。[2][3] 因而不是免费本地裁剪，应算模型用量；订阅用量与API账单不能混称。[3]

**API**阈值压缩需要“additional sampling step”，计入限流和账单；按需摘要同样计费，并在`usage.iterations`报告。[8][9] 一个HTTP请求也可能含额外推理步骤。

已读文档未给出Code“每次压缩前必经发送预览/费用确认”的通用承诺，也不能据沉默推断“绝不提示”。API的`pause_after_compaction`是摘要生成后的程序暂停点，不是生成前的人类授权。[9] Go Coach原有逐次付费请求预览确认仍有效，取消金额预算不等于允许自动收费摘要。

## 3. 失败或压完仍满

**Code**已明确一种情形：摘要成功后，大文件/工具输出连续把窗口重新填满，会停止重试并报`Autocompact is thrashing…`，避免浪费API调用；官方建议分块读取、定向`/compact`、隔离大任务或`/clear`。[6] 网络故障、摘要生成失败、超大单条输入的完整恢复状态机及统一重试次数，本次资料不足，不能承诺自动续聊或绝不丢内容。

**API**按需摘要可能HTTP 200但`content`为空，应检查`stop_reason`；仍可能计费，文档示例保留原历史稍后再试。输入仍须装进窗口，不能靠发送超限原文来解救。[8] 阈值方案工具干扰摘要时可能返回`content:null`。[9] 这是API行为，不能替代Code失败行为证据。

## 4. 保存、重启与恢复

**Code CLI**持续把消息、工具调用和结果保存到`~/.claude/projects/`的JSONL；大工具输出可另存。默认有30天清理政策，并非永久档案。[1][7]

普通新会话没有上一会话历史；同目录本身不意味着自动续接。`claude --continue`选当前目录最近会话，`--resume`打开选择器，名字/ID可定位会话；默认选择范围与当前worktree有关。resume继续原ID，`--fork-session`或`/branch`复制历史到新ID，原会话不变。[1][4]

恢复聊天≠还原工作区：切Git分支后仍保留对话，但读取当前分支文件；恢复代码是独立checkpoint操作。[1][5] 恢复也≠模型重新读全量原文，压缩前已摘要消息不会再次加载。[4] 上次进程中断的工具不会因resume自动执行完或重跑；模型被告知核查它是否已生效。[4]

## 5. 生成中输入与旧工作

**Code终端**生成中按Enter是排队，不直接中断。工具执行时排入的普通消息，在这些工具完成后可于同一turn交给模型；回合末仍有队列则按序自动发送。命令/shell命令一般等回合结束。Up可撤回队列编辑。[10]

Esc中断当前回复/工具，保留已完成工作，不提交输入框草稿；已有队列仍立即发送，所以“按Esc”不等于取消所有后续工作。[1][10] Ctrl+Enter立即送队列：v2.1.281起，可后台化的工作继续在后台，新消息在同一turn读取；不能后台化则中断后发送。此前语义不同，终端键支持也有差异。[10]

双Esc在空输入框打开rewind，不等于自动回滚；聊天回退、代码回退和摘要是不同选择。[5] 因此新输入不会天然使旧副作用消失，也没有证据能将上述行为直接类比为“棋盘切手后旧分析作废”。

## Go Coach：建议而非已批准方案

**可借鉴三点**：①本机原文与发给模型的工作上下文分层；②接近容量先摘要，保留近期原文、决定与引用并允许指导；③清楚显示排队、取消、压缩失败及恢复状态，解释下一次实际发送什么。

**不能照搬三点**：①不能把自动压缩当免确认收费授权；②不能照搬Code默认清理周期，或把resume当恢复棋局/有效证据；③不能把继续后台工作与消息队列当棋盘一致性规则，迟到分析仍须另行设计局面绑定和有效性核验。开发继续暂停，本报告不构成选型或实施批准。

## 一手来源与定位

以下均为Anthropic官方；标题后的章节可在页面定位。

|编号|标题、URL与定位段落|
|---|---|
|[1]|[How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)：“Work with sessions”“Work across branches”“When context fills up”“Interrupt and steer”。|
|[2]|[Explore the context window](https://code.claude.com/docs/en/context-window)：“What survives compaction”“When your context fills up”，包含重注入表与摘要thinking说明。|
|[3]|[Manage costs effectively](https://code.claude.com/docs/en/costs)：定位“Compaction: /compact reads the conversation it summarizes”条目；勿把“Background token usage”的resume摘要费用当compact单价。|
|[4]|[Manage sessions](https://code.claude.com/docs/en/sessions)：“Resume a session”“What a resumed session restores”“Use the session picker”“Branch a session”。|
|[5]|[Checkpointing](https://code.claude.com/docs/en/checkpointing)：“Rewind and summarize”“Guide a summary”“Limitations”。|
|[6]|[Troubleshooting](https://code.claude.com/docs/en/troubleshooting#auto-compaction-stops-with-a-thrashing-error)：“Auto-compaction stops with a thrashing error”。|
|[7]|[Explore the .claude directory](https://code.claude.com/docs/en/claude-directory#application-data)：“Cleaned up automatically”“Plaintext storage”，路径表含transcript和tool-results。|
|[8]|[How on-demand compaction works](https://platform.claude.com/docs/en/build-with-claude/compaction-on-demand)：“Request a summary”“Compact in a loop”“Handle a missing summary or an error”“Count compaction usage”；另见[Compaction overview](https://platform.claude.com/docs/en/build-with-claude/compaction)的方案比较表。属于API及SDK示例，不是Code产品说明。|
|[9]|[How compaction works（threshold）](https://platform.claude.com/docs/en/build-with-claude/compaction-threshold)：“Pausing after compaction”“Understanding usage”“Current limitations”。属于API。|
|[10]|[Interactive mode](https://code.claude.com/docs/en/interactive-mode#queue-messages-while-claude-works)：“Queue messages while Claude works”“When Claude Code sends what you queued”“Take back what you queued”“General controls”。|
