# 08B / 最小05：DeepSeek 公开参数历史预检

> 后续政策覆盖：本文记录当时查询，不是现行预算或授权要求。用户已选择deepseek-flash非思考/max_tokens=2000、接受已披露的政策不确定性，并批准当前问题/本盘对话等扩展字段；费用预算/预留/账本和逐请求确认已撤销。未来软件发送一次授权本问范围内的必要请求。原“禁止全部tools”的最小05限制不约束后续已批准的有限本地工具；仍不启用供应商Search/Fetch或任意工具。现按spec.md与19/20/22设计实施，本文不能授权真实Key、外发或收费。价格/context/接口均为查询时点依据，不是运行时保证。

查询窗口：本机 `2026-10-20T15:22:20+08:00`—`15:23:17+08:00`，未验证外部授时。已读 pi-workflow、research 技能、历史10预检及08-design最新决定。只查询公开文档；未读Key/auth/provider配置、真实operator或用户棋谱，未调用账户/余额/模型列表/推理API，未运行应用、安装、调度或提交；唯一项目写入为本文件。

08A已验收a1cd762；¥50是用户已接受的**本应用保守预算**，不是供应商硬限额，不覆盖其他程序消费。本文不授权模型、字段、政策接受或收费。与10月16日历史不同：官方10月17日已更新Flash版本；价格未变。[1][4]

## A. 可硬编码的候选 profile（仍须审批）

“便宜文本讲解”是本项目选择理由，不是官方围棋质量背书。官方推荐调用名、当前映射及参数如下。

| 项目 | 当前一手依据及候选值 |
|---|---|
| 出口/模型 | `https://api.deepseek.com/chat/completions`；`model:"deepseek-flash"`。当前映射 **DeepSeek-V4.1-Flash-1017**；旧 `deepseek-v4-flash` / `deepseek-v4-flash-vision-exp` 路由到它，不是锁定快照。[1][2][4] |
| 关闭思考 | 原始JSON `thinking:{"type":"disabled"}`；默认enabled，不能省略。SDK才使用extra_body包装。不要另传可能冲突的reasoning_effort；不启用思考。[2][5] |
| 非流式/输出 | `stream:false`，不传stream_options；`max_tokens:2000`合法，文档范围1–393216，非思考未设置默认8K。[2] |
| JSON/工具 | `response_format:{"type":"json_object"}`；system/user明确要求JSON。不发送tools、不启用Search/Fetch；无tools默认tool_choice=none。[2][6] |
| context精确整数 | 价格页仅写1M；**模型列表官方文档的Example**为Flash列`context_window:1048576`、`max_output_tokens:393216`，schema定义context为输入＋输出总容量；官方Codex集成示例亦列1048576。因此1,048,576有一手根据，不必猜1,000,000，但属于文档示例证据，非账户实测/不变合同。[3][7] |
| max_tokens与思考 | Chat说明为生成token上限，usage将reasoning列为completion细分，但未逐字明确上限包含思维链；不能借Responses的表述冒充Chat明确承诺。保持非思考；以后开启须重核。[2] |

**context取舍：**[3]显示名仍为V4.1-Flash、不带1017；当前版本采用[1]与10月17日更新日志[4]，不把显示名差异解释为锁定旧版本。[3][7]支持1048576作为条件预留依据，但不能证明超长拒绝必定零收费。超限/错误/超时缺少可靠usage时仍占用预算。

## B. 价格与预留（不是实际账单）

| 人民币元 / **1,000,000 token** | 输入未命中 | 输入命中 | 输出 |
|---|---:|---:|---:|
| Flash高峰（本片统一采用） | 2 | 0.04 | 8 |
| Flash空闲 | 1 | 0.02 | 4 |
| Pro高峰（不在候选profile内） | 9 | 0.30 | 27 |

来源[1]。高峰：北京时间周一至周五（不含中国法定节假日）09–12、14–18；其余半价。统一高峰免依赖跨时段归属。价格可变；税费是否已含、其他支付附费口径未核实，不自行加税或宣称全包。

条件：一次纯文本非思考请求，价格维持上述值；全部输入按未命中，输出≤2000，无重试/工具/额外请求。

- 最大context输入＋输出预留：`1048576×2/1000000 + 2000×8/1000000 = ¥2.113152`。context本来包含输出，此式故意重复留出输出空间，是宽松预留，**不是可同时使用的输入/输出配额**。整数微元为2,113,152；若账本用分则向上取整为¥2.12，不能向下舍入。
- 一般算例：3000总输入＋2000输出=`¥0.006+¥0.016=¥0.022/次`，100次¥2.20。输入须包含全部系统提示和证据，不是只算盘面。

[1][2]未另列思考或普通function-call固定服务费；reasoning作为completion细分按输出计算，不重复加算，也不免费。工具循环增加token。Search/Fetch各¥5/1000次成功请求；[1]另说明Harness等服务端工具调用目前未计费、11月1日起收费，不将该限定豁免推广至所有调用。本片禁用这些功能。缓存默认构建且不保证命中，“全未命中计价”不等于关闭缓存。[8]

## C. 非流式响应与保守对账

以下读取[2]公开原始HTML的 **200 (No streaming)** schema；普通正文抽取遗漏响应段，未以遗漏推断不存在。

| 字段 | schema required标记及语义 |
|---|---|
| `usage` | **未标required**；不能假设每次必有 |
| `usage.prompt_tokens` / `completion_tokens` / `total_tokens` | 均required（在usage存在时）；输入/生成/二者之和 |
| `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` | 均required；二者之和=prompt_tokens |
| `prompt_tokens_details` / `.cached_tokens` | 对象required，cached_tokens未标required；等于cache_hit，不重复累加 |
| `completion_tokens_details` / `.reasoning_tokens` | 均未标required；reasoning是completion细分 |
| `choices[].finish_reason` | required：stop、length、content_filter、tool_calls、insufficient_system_resource、aborted |
| `model` / `system_fingerprint` | required；仅描述“所用模型”/“后端配置指纹”，不是价格或快照证明 |

建议：可靠非负整数prompt/completion/total且总和一致时，可忽略缓存折扣，全按`prompt×2 + completion×8`（除百万）估算；这是**本地保守结算，不是供应商实际扣款**。缓存分项缺失可不用于算价，但属于与schema不符须由设计明确处理；主计数缺失、矛盾或越预留，不得凭猜测释放预算。即使内容失败，已发生token仍可能收费。

JSON mode只管JSON语法，不保证业务schema或围棋事实；length可能截断，无JSON提示可能输出空白到上限。[2][6] 建议仅stop＋非空＋本地schema/棋局校验通过才显示成功；其他finish_reason不自动重试。

[2]当前非流式Example返回`model:"deepseek-flash"`（不是历史chat示例），但**未承诺等于请求ID，也未承诺返回1017快照**。不得靠model字符串证明价格未变或别名未漂移。搜索并检查[1][2][9]后，**未核实服务端max-cost、单价锁定、逐请求报价机制**；不能声称不存在，更不能编造。

## D. 政策与待同意UI

本次可见版本仍为开放平台协议2026-04-22更新/04-29生效[9]，用户协议2025-09-05[10]，隐私政策2026-02-10[11]。相较历史未发现相关承诺改变，不表示全文法律审计。

[9]具体适用API并引用通用协议/隐私政策；[10]§1.1覆盖API、§4.3允许在所述加密去标识条件下用输入输出训练/优化。[11]退出路径仍是产品设置“数据用于优化体验”；**没有核实API专属豁免或该开关覆盖API的承诺，不能宣传默认不训练**。

[11]§五仅承诺境内运营产生的个人信息境内存储，不等于所有API推理节点/处理方地域保证；保存按必要期限，日志不少于六个月是例外示例，不是API正文固定删除期限。[8]缓存一般几小时到几天，不涵盖日志、备份或训练副本。API完整留存、删除、退出及实际处理地区仍未知。

**拟UI摘要（不是用户已接受）：**
> 在线讲解将把选定的结构化棋局证据发送给DeepSeek，产生费用。即使不含姓名，盘面与着手组合仍可能关联到具体棋谱或个人，不能视为匿名。官方条款允许在所述条件下将输入输出用于训练/优化；尚未核实API专属退出、不训练、完整留存期限及处理地区保证。讲解可能有错。¥50仅为本应用保守预算，不是官方账户硬限额。请阅读[开放平台协议][9]、[用户协议][10]和[隐私政策][11]后决定。

## E. 不能直接启用真实收费的未知 / 用户决定

**设计待解：**价格核验有效期与变化停用；别名漂移识别；无报价锁定时费用上界成立条件；错误/中断计费；usage真实性及缺失；跨月未知占用。主代理须独立复核价格/context，本文不是运行时账单保证；上界不明按08-design停用。

**用户待决定：**候选模型/参数、政策风险接受、外发字段及真实费用授权。此片字段候选仅：结构化19路盘面/初盘、规则/贴目/让子、选中步/实际手/棋盘事实、前后各最多10合法候选及PV、BLACK估值和预算标签；无rawSGF、姓名、注释、文件名、自由文本。组合仍可识别；本报告不批准字段或隐私，不重新讨论已接受的预算范围或充值操作。

## 主代理复核

主代理另取官方价格页、模型列表文档及用户协议：确认Flash当前映射1017、高峰未命中¥2/百万与输出¥8/百万、价格可能调整；模型列表原始HTML Example中的context_window=1048576（readable提取遗漏示例，不能据此判断没有）；协议§4.3的训练/优化条款。¥2.113152预留算例与整数微元换算复算一致。只访问公开文档，未调用真实/models或账户/推理接口、未读Key。其余接口字段仍以研究来源为依据，不声称全部独立逐项实测。

## 一手来源（本次均查原文）

[1]: https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
[2]: https://api-docs.deepseek.com/api/create-chat-completion/
[3]: https://api-docs.deepseek.com/api/list-models/
[4]: https://api-docs.deepseek.com/zh-cn/updates
[5]: https://api-docs.deepseek.com/guides/thinking_mode/
[6]: https://api-docs.deepseek.com/guides/json_mode/
[7]: https://api-docs.deepseek.com/quick_start/agent_integrations/codex/
[8]: https://api-docs.deepseek.com/zh-cn/guides/kv_cache
[9]: https://cdn.deepseek.com/policies/zh-CN/deepseek-open-platform-terms-of-service.html
[10]: https://cdn.deepseek.com/policies/zh-CN/deepseek-terms-of-use.html
[11]: https://cdn.deepseek.com/policies/zh-CN/deepseek-privacy-policy.html
