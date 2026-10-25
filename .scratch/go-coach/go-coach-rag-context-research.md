# 围棋教练：RAG、会话记忆与可信上下文

核查日期：2026-10-23。仅阅读公开一手文档/源码及指定项目资料；未安装或运行框架、服务、引擎，未调用推理/付费API，未读Key或私人棋谱，未启动子代理。本文是候选机制研究，不是实施决定或新增外发许可。

## 1. 结论与项目边界

**项目事实**：已读 `PRODUCT.md`、`coach-context-research.md`、`08B-design-draft.md`。目标是左棋盘右聊天、一盘一会话本机保存、同盘实战/推荐对照和自由试下。依据本次委托，允许围绕当前问题自动补查少量本地变化；新增付费模型请求仍逐次确认。旧研究中该项“待确认”不能覆盖此次更新。自由文本、历史和摘要的具体外发范围仍未选定；原08B排除这些字段，不能直接套用旧许可。

**产品推论**：可以借鉴RAG，但不要把三类信息混成一个向量库。“记得聊过什么”“知道术语含义”“证明当前变化可行”是不同职责。

| 类别 | 应取什么 | 候选索引 | 能解决/不能解决 |
|---|---|---|---|
| A 本盘聊天原文 | 用户原话、旧回答、纠正及未决问题，均带消息ID和局面锚点 | 会话/手数/分支精确索引＋近期窗口；术语全文检索补充 | 减轻旧问题遗漏；旧AI回答不是棋理事实 |
| B 概念及核验范例 | 定义、适用条件、完整题目/解答来源及核验范围 | 小词典用标签/别名；规模扩大且措辞变化多时考虑关键词＋向量混合 | 找到相关教材，不能证明例题结论适用于眼前棋盘 |
| C 当前局面与变化 | 完整历史支持的规则复算、对应分析条件的估值/PV | 精确棋局/前缀/分支/证据身份；按需重新计算 | 判断支持范围内合法性，比较有限变化；相似文本不能替代计算 |

A、C都不必先有embedding；B也不是必须。RAG能补回被窗口截掉的讨论、定义和反例，却可能漏召、误召或引用错误来源，不能凭“检索到了”证明死活、最佳着或因果解释。

## 2. 三种核实过的机制

### 机制一：SQLite全文检索＋结构化身份

**官方事实**：[S1] FTS5支持 `CREATE VIRTUAL TABLE … USING fts5`、`MATCH`、`ORDER BY rank`、`bm25()`、`snippet()`，无embedding模型要求；源码接口及排序/摘录实现见[S2]。全文表rowid可关联业务消息表；身份过滤仍是应用/SQL职责，不是相关性分数的意义。

中文有实际限制：默认 `unicode61` 不是中文语义分词器；trigram按连续三字符检索，少于三字符的全文查询不匹配。因此“打吃”“厚势”等两字词不能想当然由trigram解决；可用规范术语标签、别名、小规模子串回退，随后以中文样本测漏召。外部内容表还需应用保持原文和索引同步。

**产品推论**：对一盘聊天，先按会话与锚点缩小范围，再全文找“刚才说的征子”，通常比把每条消息嵌入更容易审计。索引命中应返回原文及邻接问答，而不是孤立半句。不联网、无新增模型费；仍有本地存储、迁移、删除一致性和打包可用性成本。08B的SQLite worker仍待预检，不能声称FTS5在当前产物已可用。

**维护/许可事实**：[S3] SQLite交付代码与文档为公有领域，部分构建脚本另有许可；官方更新页此次列出2026-10-16的3.54.1及修复。不是停更示例，也不意味着本项目已使用该版本。

### 机制二：LangGraph按线程保存＋显式键检索＋近期窗口

**官方事实**：[L1] checkpointer按 `thread_id` 保存状态，`trim_messages` 可在调用模型前裁切历史；保存状态与发送上下文是两件事。[L2] `BaseStore.get(namespace,key)` 精确取项，`search(namespace_prefix,query,filter,limit)` 检索，`put(...,index=False)` 可禁用该项向量索引，仍可精确读取。向量检索是可选能力，不是记忆的前提。InMemorySaver/Store不能被当成重启后持久保存。

**产品推论**：借鉴接口而非装框架：一盘对应一个会话命名空间，消息关联不可变的根手/变化路径；近期窗口保留自然对话，明确提及旧手则精确取回该锚点及纠正链。框架不会替应用判断“这步”指当前盘面还是旧讨论，更不会保证证据未过期。持久化和裁切不能删除本机原始聊天作为副作用。

### 机制三：压缩摘要与可选语义记忆

**官方事实**：[L1][L3] `summarize_conversation` 示例把旧摘要与消息交给 `model.invoke(messages)`，再用摘要及剩余消息延续对话；这就是额外模型调用，不是免费数据库压缩。示例没有自动为每个摘要断言生成可靠原文追溯。[L4] 语义Store代码实际调用 `embed_documents` 和 `embed_query`：文档入库与查询都可能需要嵌入。

**产品推论**：摘要会省后续输入，却可能误记执棋方、把疑问变结论、在多次压缩中丢掉撤回。若采用，应逐项存 `sourceMessageIds`、局面锚点、生成版本、纠正/未决状态；摘要只是导航，争议处回原文，不以摘要改写事实。出处字段仍需检验，存在ID不等于摘要忠实。不必每轮摘要，可先用程序提取手数/引用关系和原文短摘；阈值触发模型摘要也须每次确认，不能后台隐式收费。

若embedding适配器调用远程供应商，入库原文及查询文本会形成**解释模型之外的另一条外发链路**；“向量存本机”不代表生成向量时未外发。改成本地embedding可避免这一步网络传输，但增加模型文件、运行时、内存/启动延迟及模型许可证审查，且向量仍按敏感派生数据管理；删除会话应覆盖索引、摘要及缓存。

**共同维护/许可事实**：[L5] LangGraph仓库此次 `archived=false`，公开推送日期为2026-10-23；最新release端点返回的是同仓库SDK的0.4.9，不冒充图运行时版本。仓库MIT许可要求保留版权/许可声明。核查的Python checkpoint包要求Python≥3.10，并依赖 `langchain-core`、`ormsgpack`。在现有Electron/Node项目照搬Python例子会引入新运行时；借鉴机制不需要这么做。JS版本或其他持久化后端须另核验，不作免成本承诺。开源库不要求购买托管服务；若选远程数据库、追踪或模型，则另有费用和数据处理边界。

## 3. 请求身份与“如果我这样下”

**协议事实**：[D1] DeepSeek Chat Completions无状态，客户端每次通过 `messages` 提供需要的历史；本机会话ID不会让供应商自动记起上下文。[D2] 工具样例先返回assistant `tool_calls`，宿主执行，再追加 `role:tool`、`tool_call_id`、结果，发起下一次模型请求；模型本身不执行函数。固定预取证据应当作上下文，不伪造未发生的工具调用。

**产品推论**：`tool_call_id`仅绑定协议调用，不绑定棋盘。宿主还应把 `requestId＋game/session＋根手/完整历史摘要＋分支路径＋规则/贴目＋证据版本/分析条件` 绑定到每次取证及回答。摘要hash用于身份核对，不能代替本地完整历史。用户切手后，迟到结果只能归原锚点；旧答案可回看，不能变成当前有效证据。

“如果我这样下”应先从正确前缀重放试下，核验行棋方、提子、劫/循环和项目支持范围，再在允许的少量本地补查额度内比较对应变化；检索只补充解释概念。若进一步由模型选择工具，再让模型解读结果，后续付费请求仍逐次确认；限制调用数、序列长度、超时、累计费用，并由宿主拒绝越界，不能靠提示词限权。

**规则事实与推论**：[R1] 明确区分简单劫、位置超级劫、情境超级劫及自杀规则；超级劫要比较历史状态。因此同盘面异历史可能合法着不同；贴目/计分规则还会改变比较意义。旋转相似图必须同步变换坐标、整条历史及变化，不能把检索到的D4直接搬过去。局部形状相似也可能因远处征子引子不同而失效。相似度既不是合法性证书，也不是推荐着缓存键。

## 4. 相容的候选流水线（尚未选定）

1. 本机保留原文与不可变锚点；按“这步＝当前盘面、明确旧手＝旧锚点”解析，确有歧义才澄清。
2. A先取近期窗口、显式引用与同锚点问答/纠正；不足时全文补召，不跨其他棋局搜索。摘要若启用，仅作来源导航。
3. B按术语取少量获许可且核验过的资料；不需要概念讲解就不取。C始终独立精确取证，缺失/失效则有界本地重算或说明不足。
4. 明确区分原话、旧AI解释、教材、规则事实和引擎估计；预算不足先缩减无关文本，不能截掉关键规则/身份而假装完整。检索内容是资料，不是工具权限指令。
5. 显示拟外发字段与本次费用，按批准范围过滤、预算预留、逐次确认后才发送。输出带证据引用及未知；保存回答和实际证据版本，费用账本独立保存。

轻量自建需负责表结构、索引、截取、引用追溯、失效及授权；框架主要复用状态保存、裁切、Store和调度接口，不能接管围棋正确性、¥50预算或外发同意。当前规模未证明有引入向量服务/Agent框架的必要。

## 5. 如何验证与待决定项

**评估建议，尚未实测**：使用核验合成棋局和脚本化聊天，构造成对测试：切手说“这步”、明确旧手、同号不同分支、长对话后纠正、迟到工具结果、同盘异历史、旋转与规则变化。给每问标注必需消息/证据ID，分别测锚点正确率、纠正遗忘率、检索Recall@k及误召、摘要断言的原文支持率、逐句无依据解释率和正确保留率。合法性靠重放；策略理由需独立棋手审查，单条PV或LLM自评分不能当真值。

对同一组题比较“近期窗口”“窗口＋精确/全文检索”“再加摘要/向量”，记录每问及整盘总输入/输出token、摘要/嵌入/重试/工具后续请求数、费用、延迟、确认次数与取消后零发送。付费实验须另批准；目前没有“接RAG更准确/更省钱”的实测结论。

**待用户决定**：允许外发哪些原话/历史/摘要；近期窗口与补召的可见方式；是否允许收费摘要及何时提示；B先用哪些自有/获许可素材；是否有足够漏召证据再评估本地或远程embedding；本地补查具体额度和耗尽行为。围棋书籍、题库、注释棋谱的版权、再分发及可用性目前未知，开源框架许可不覆盖资料；不抓取受限或付费内容。

## 主代理独立复核

主代理在研究返回后重新读取SQLite FTS5官方文档、LangGraph Memory官方文档和InMemoryStore源码，确认：unicode61按连续token字符切分而不是中文语义分词；trigram的全文查询不匹配少于三个Unicode字符的子串；FTS5存在bm25/snippet等无embedding查询机制；官方摘要示例明确额外调用`model.invoke(messages)`，并从活动消息状态移除旧消息；语义Store的入库与查询代码分别调用`embed_documents`及`embed_query`。因此“持久保存≠每次全量发送”“摘要/远程embedding可能新增模型调用或外发链路”的区分有一手依据。主代理未重新核验本文全部版本/许可证事实，也未验证本项目Electron产物支持FTS5，未进行中文检索质量或真实模型实验。框架示例的移除消息行为不能直接照搬为删除本机聊天档案。

## 一手来源与关键接口

以下为本次读取的动态页面/main源码，不声称已锁定可部署版本；后续采用须固定提交并复核。

- [S1] [SQLite FTS5官方文档](https://www.sqlite.org/fts5.html)：查询、排序、tokenizer与external-content同步。
- [S2] [FTS5扩展接口头文件](https://github.com/sqlite/sqlite/blob/master/ext/fts5/fts5.h)；[bm25/snippet实现](https://github.com/sqlite/sqlite/blob/master/ext/fts5/fts5_aux.c)。
- [S3] [许可](https://www.sqlite.org/copyright.html)；[维护/发布记录](https://www.sqlite.org/changes.html)。
- [L1] [LangGraph Memory官方文档](https://docs.langchain.com/oss/python/langgraph/add-memory)：thread_id、trim、summary。
- [L2] [BaseStore源码：get/search/put](https://github.com/langchain-ai/langgraph/blob/main/libs/checkpoint/langgraph/store/base/__init__.py)；[BaseCheckpointSaver接口](https://github.com/langchain-ai/langgraph/blob/main/libs/checkpoint/langgraph/checkpoint/base/__init__.py)。
- [L3] [官方文档示例源码：summarize_conversation](https://github.com/langchain-ai/docs/blob/main/src/oss/langgraph/add-memory.mdx)。
- [L4] [InMemoryStore嵌入调用源码](https://github.com/langchain-ai/langgraph/blob/main/libs/checkpoint/langgraph/store/memory/__init__.py)。
- [L5] [仓库元数据](https://api.github.com/repos/langchain-ai/langgraph)；[release端点](https://api.github.com/repos/langchain-ai/langgraph/releases/latest)；[MIT许可](https://github.com/langchain-ai/langgraph/blob/main/LICENSE)；[Python依赖声明](https://github.com/langchain-ai/langgraph/blob/main/libs/checkpoint/pyproject.toml)。
- [D1] [DeepSeek多轮对话](https://api-docs.deepseek.com/guides/multi_round_chat)；[D2] [工具调用与样例代码](https://api-docs.deepseek.com/guides/tool_calls)。
- [R1] [KataGo规则定义源码](https://github.com/lightvector/KataGo/blob/master/docs/rules.html)：Main Phase的状态/重复限制；仅用来核查规则依赖，不研究围棋Agent仓库。
