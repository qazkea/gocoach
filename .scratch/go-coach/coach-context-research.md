# Go Coach：连续会话与棋局解释证据研究

核查：2026-10-23 21:48（本机 UTC+8，未外部授时）。仅查公开一手文档；未启动服务/引擎、读取凭据或私人SGF、调用推理/付费API、安装依赖或启动子代理。本文为研究，不是实施许可。

## 1. 基线与问题

**项目事实**：已读 `GLOSSARY.md`、`PRODUCT.md`、`README.md`、本目录 `08B-design-draft.md`、`08B-deepseek-profile-preflight.md`、`issues/05-evidence-chat.md`。已有完整历史合法性核对、实战回放、独立面板连续试下、本地扫描及逐手事实依据；当前100 visits/2秒低预算、最多10候选、PV最多16着，**没有ownership**。主棋盘任意试下加连续聊天尚未实现；现有棋规不覆盖全部循环/裁判规则，“任意合法”须注明支持范围。

既选 `deepseek-flash`、非思考、`max_tokens=2000`。原08B仅一次按需讲解，排除自由文本、聊天历史、工具调用。左棋盘＋紧凑走势、右侧一盘棋一个连续会话是新目标，不自动授权新增外发字段、自主工具或持久记忆。

**推论**：连续会话不等于Agent。关键是应用保存消息与局面身份、按问题取证；只有让模型决定下一次取什么证据，才引入本文所指的工具辅助Agent。两者均不能保证“真正懂棋”。

## 2. DeepSeek当前协议：能用什么，不能替代什么

**官方事实**：[D1]称Chat Completions为“stateless”，每次须传所需历史。使用 `messages` 的system/user/assistant消息，保留先前问答才能承接追问；会话名称或ID不会自动恢复聊天。应用可选取历史，但遗漏内容就不能假定模型记得。

[D2][D3]当前Flash映射V4.1-Flash-1017，支持JSON及工具；非思考须明确 `thinking:{type:"disabled"}`，2000在合法输出范围内。1M上下文不代表必须上传整盘聊天，也不代表可靠跨手指代。别名会变，本文没有账户实测。

[D4]非思考工具流程：请求携带 `tools:[{type:"function",function:{name,parameters}}]`；模型返回assistant `tool_calls`，**宿主**校验并执行，再追加原assistant消息与 `role:"tool",tool_call_id,content`，再次请求得到答案。模型不执行函数。`tool_choice`可none/auto/required或指定函数；非思考支持强制选择。Chat接口不支持随意插入非模型生成的工具调用历史，固定证据包应作为普通上下文，不能伪造工具轨迹。

结构化分两层：[D2][D5] `response_format:{type:"json_object"}`只保证JSON形式，提示也须要求JSON；`finish_reason=length`可能截断。当前枚举未列最终答案的`json_schema`。工具参数strict是另一机制：[D4]须beta出口、各function设strict=true，object所有属性required且additionalProperties=false；不支持maxItems/maxLength等限制，仍需本地校验。strict约束参数格式，不证明棋理或执行权限，是否采用Beta仍待决定。

**缓存≠记忆**：[D6]默认硬盘缓存复用匹配的完整前缀单元，尽力命中，输出仍重新计算。它不代替应用重发上下文，也不是免费答案缓存或聊天存档。应用聊天记忆负责消息/局面锚点与删除策略；应用精确答案缓存另负责复用旧结果。三者不可混称。

## 3. KataGo v1.18.1能支持哪类理由

**协议事实**：[K1]逐行JSON输入初盘、行棋方、有序moves、规则/贴目及分析回合；输出rootInfo、moveInfos、visits、胜率、scoreLead及PV。视角取决于reportAnalysisWinratesAs，项目固定BLACK。root是搜索访问的汇总，不等于最佳候选；scoreStdev文档明确可能显著偏高，不能包装成校准的置信区间。

| 数据 | 可支持的解释线索 | 不能推出（推论） |
|---|---|---|
| 本地规则复算 | 坐标、棋链、气、实际提子、合法连接 | 两气即活、连接必优、全局死活 |
| winrate/scoreLead/visits | 指定规则、模型和预算下的比较估计 | 掉目就是原因；低预算首选是最优证明 |
| PV | 展示“若双方如此应对”的可复演序列，可为空/短线 | 对方必须照走；覆盖所有反击；长远战略成立 |
| ownership（可选） | 各点[-1,1]预测归属；可请求候选后的归属比较 | 确定实地、眼位/死活证明、逐点变化就是因果贡献 |
| policy/prior（可选/候选先验） | 搜索前网络的着手倾向；policy额外含pass及非法标记 | 胜率、理由、人类难度；不是搜索后的排名 |

[K1] `includeOwnership`会加内存并降低性能；`includeMovesOwnership`可按候选返回。**项目当前无ownership，不把这些写成已有能力**；完整policy也不在08B外发白名单。普通policy不是humanPolicy，后者需要另配human模型。增加热图可能帮助定位争议区域，但仍只是待验证建议，不能让LLM从颜色编造“厚势”“必死”。

## 4. 一次回答与限次Agent的真实取舍

以下均为**产品建议/推论，非实施决定**。

| 维度 | 固定组装可信包→一次回答 | 只读、限次工具Agent |
|---|---|---|
| 连续性/跨手 | 应用选择历史与锚点，行为可预测 | 可按需取旧手，但同样依赖应用身份；可能取错 |
| 合法试下 | 本地先验完整前缀，再为该分支组包；无需Agent | 可提议变化并申请校验；不允许模型判合法 |
| 理由可信度 | 常见事实充分，临时反事实不足就保留结论 | 可补查反击/比较，仍会误选工具、漏分支或编理由 |
| 成本/延迟 | 每问一次LLM，但固定包可能冗余 | 更精准取证，却增加多轮输入/输出及引擎时间；未必便宜 |
| 可审计性 | 外发包、回答对应关系简单 | 须另记录调用、拒绝、预算及证据版本 |

建议先用固定包验证真实教学需要；只有明确出现“缺哪条证据”且限次补查能改善回答，才评估Agent。对“刚才那块”存在多个锚点时，两种方案都应追问澄清，不能按当前棋盘猜。

### 最小证据包（概念）

1. **身份**：本地game/session、实战手或分支ID、根手数、变化序列、行棋方、完整历史摘要、分析条件/版本；摘要用于匹配而非代替棋规历史。消息保留不可变锚点，旧消息可回看，迟到答案只归原锚点。
2. **可复算事实**：规则/贴目/让子、坐标约定、前后盘面、实际手、提子、相关棋链及气；链ID限定局面，跨手需显式映射。
3. **估计与示例**：当前与比较手的证据ID、BLACK估值、实际visits、预算、合法核验过的有限PV；缺少字段明示，不能补造。
4. **对话**：当前问题、明确引用的消息及必要近邻历史；摘要注明来源与未决问题，旧AI结论不升级为事实。自由文本/历史/新事实字段均需重新确认外发范围。输出分“事实引用／估计／解释假说／未知”，不只给一段流畅话术。

### 有限工具职责（概念）

- `get_evidence(anchor)`：只取本会话已验证且仍有效证据，不读任意文件。
- `inspect_variation(anchor,moves)`：从完整本地前缀重放有界序列，返回合法/非法/不支持及链气提子；不改原谱。
- `compare_variation(anchor,moves)`：仅在另获许可时请求有界本地分析，返回同条件估计与PV；只读指不改棋谱，不等于不消耗GPU。

不开放shell、URL、原始SGF、凭据或任意引擎配置。可讨论每问最多一轮取证、两次工具调用、随后一次最终回答；数量、序列长度、超时由宿主硬限，耗尽说明不足。2000是**每次请求**输出上限，不是整个Agent回合上限；每个新付费请求仍须按既定方式确认/预留，禁隐式重试。零工具也可能足够；工具失败不能用旧分支结果填补。

## 5. 验证解释，而非验证漂亮JSON

**建议、尚未执行**：用核验合成局面分别覆盖打吃、连接、有限强制提子、劫/循环边界、双方视角及pass。逐条标注“结论—事实—适用条件—反例”；由独立规则重放和手算核对。有限强制结论须枚举声明深度内全部合法应手（含pass），超限即降格，不用单条PV代替。

构造成对反事实：只改一个相关逃跑点/连接点，或换一条合法防守；检查理由能否相应变化或撤回。加入无关区域改动、旋转坐标、切回旧手、同盘异历史、分支迟到响应，分别检验指代和证据绑定。更高预算/重复引擎分析仅检查估计稳定性，不充当因果真值。

真人棋手盲审：逐句判事实准确、变化可行、遗漏反击、理由与证据相干、是否过度断言；记录分歧而非用措辞相似度。新手再在未见过的近似局面选择并解释，评估迁移理解，不以掉目减少或JSON通过证明教学有效。固定包与Agent用同题、同模型和预算比较，统计无依据断言、错锚点、适当保留、延迟/总token；真实模型实验必须另获授权。

**仍未知**：Flash围棋解释准确率、跨手指代可靠性、工具增益及最佳限额、复杂布局/死活的完备理由、真人学习收益。全部不能由上述协议证明。

**用户决定更新（研究返回后）**：用户已选择本机保存聊天及关联棋局信息、提供删除入口、不做云同步；回看旧聊天不代表分析依据仍有效。用户起初未理解抽象的跨手指代问题，随后通过具体例子确认自然对话体验：翻到新手问“这步”对应当前棋盘，明确提到旧手则接回旧讨论，真正有歧义才澄清；这不等于批准具体上下文组装算法。用户明确要求先研究/讨论上下文设计，再决定文本与历史外发，不能记成已同意“相关片段”方案。

**待用户决定**：会话删除的具体范围与恢复入口；历史截取与摘要是否允许外发；浏览旧消息是否切换提问对象；补查是否允许新增引擎计算及逐次模型请求。界面可以呈现连续会话，但这些隐私、身份和费用决策必须单独收口，不能由布局设计隐含决定。

## 主代理独立复核

研究返回后，主代理重新读取官方多轮对话、工具调用文档及KataGo v1.18.1原始分析协议，确认：DeepSeek Chat Completions是无状态接口，所需历史由应用随请求提供；工具调用由宿主执行并将结果送回模型，样例需要后续模型请求；KataGo的ownership明确是预测，policy明确是搜索前预测，scoreStdev存在显著偏高说明，includeOwnership另有内存/性能成本。上述事实支持区分聊天记录、请求上下文与棋局证据，但不能证明所建议上下文策略的教学效果。未独立重新核验本文所有API参数、模型别名或计价，也未进行真实推理/棋力实验。

## 一手来源与支持段落

以下DeepSeek页面无固定文档版本，均于上述时间窗口读取；KataGo锁定v1.18.1标签。未引用第三方摘要或用不相关论文外推棋理。

- [D1 多轮对话](https://api-docs.deepseek.com/guides/multi_round_chat)：首段“stateless”；“concatenate all previous conversation history”。
- [D2 Chat协议](https://api-docs.deepseek.com/api/create-chat-completion/)：messages、thinking、max_tokens、response_format、tools/tool_choice段；“model may generate JSON inputs”；“partially cut off if finish_reason=length”。
- [D3 模型表](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)：模型细节“DeepSeek-V4.1-Flash-1017”、1M、Json Output/Tool Calls支持；仅用于模型适用性，不重做价格研究。
- [D4 工具调用](https://api-docs.deepseek.com/guides/tool_calls)：Non-thinking示例及流程；“model itself does not execute specific functions”；Mid-Conversation限制；strict Beta及schema类型限制段。
- [D5 JSON输出](https://api-docs.deepseek.com/guides/json_mode)：首段“valid JSON strings”，Flash的json_object示例。
- [D6 上下文缓存](https://api-docs.deepseek.com/zh-cn/guides/kv_cache)：缓存落盘与命中规则；“输出仍然是通过计算推理得到”；其它说明“尽力而为”。
- [K1 分析协议 v1.18.1](https://github.com/lightvector/KataGo/blob/v1.18.1/docs/Analysis_Engine.md)：Queries、Responses及Human SL Analysis Guide。PV“variable length or even empty”；ownership“predicted ownership”；policy“before any search”；scoreStdev“significantly biased high”。原文读取：[固定标签raw](https://raw.githubusercontent.com/lightvector/KataGo/v1.18.1/docs/Analysis_Engine.md)。
