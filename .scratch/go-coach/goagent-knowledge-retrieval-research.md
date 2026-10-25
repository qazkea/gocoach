# GoAgent 知识检索：规则选择教材，不是动态技能执行

静态核查固定提交 `edc6efa15a9a08499b5d42c8342a15a26a10fdc6`。先读前份架构报告；仅访问公开源码，未克隆、安装、执行或调用模型/引擎。子研究止于检索函数返回；主代理随后独立读取knowledge.ts、matchEngine.ts的关键控制流与实际MD索引/正文，并补入第5节已核验的teacherAgent工具接入链。

## 1. 两个入口并非两个独立库

`searchKnowledgeMatches` 委托 matchEngine：加载 `data/knowledge/training-catalog.json` 的定式、死活、手筋记录，再合入 `pattern-cards.json` 匹配前4项。`searchKnowledge` 则混合五路：index 指向的 Markdown、p0 卡、pattern 卡、上述 Matches（内部请求6项、排除 weak、分数加5），以及独立 shapeRecognitionEngine 的棋形包；最后统一排序。因此不能把前者叫“只搜题库”、后者叫“只搜文档”。[1][2][3][4]

开发时数据根为 cwd/data，打包时为 resources/data。MD 首次加载就整读 index 列出的现存正文，非命中后才读全文。MD、training、pattern、shape 按根路径缓存整个集合，无 mtime/TTL；**p0 例外：只判断缓存是否存在，不核对根路径**。缺文件通常缓存空库；training 的 JSON 解析没有其他加载器那样的 catch。未见查询结果缓存。[1—4]

## 2. 真实资料是什么样

`index.json` 的 `joseki-star-approach` 指向 `joseki/star-point.md`，元数据有 category=joseki、phase=opening、levels=intermediate/advanced/dan、corner 区域及星位/挂角等 tags。正文是标题、变化、条件、风险、参考链接，不是技能操作协议。[5][6]

训练目录首条 `joseki_star_33_basic_line`，题名“星位点三三：简明主线”，有 family、阶段、棋力、`sourceKind=common-pattern`、tags；`relativeSequence=[Q16,R17,R16,Q17]`，另存 normalizedFeatures、branches（sequence/whenToChoose/warning）、decisionRules、commonMistakes、katagoEraJudgement、trainingFocus、patternCardIds。这是人工组织的教学记录；sourcePolicy 声明常见型原创重构，不等于本研究认证棋理。[7]

## 3. 真正的筛选、评分与截断

**MD 不只是字串计分，实际上连 query.text 都不查。**先硬过滤无正文和棋力不符，随后按元数据：阶段吻合+4/any+1，区域+3/any+1，contextTags 精确相同每项+2，再加损失、误着、阶段类别奖励；正分入选。p0 用阶段、标签、errorTypes 包含关系等加分，亦不搜自由问题正文。[1]

阶段硬编码：手数≤40或进度≤20%算布局，≤72%算中盘。MD 区域看最近5手，距两边均≤4算角；matchEngine 却汇总实战点、候选前3、PV前5及 recentMoves，角阈值≤5，不能当同一算法。[1][2]

pattern 卡不硬排除棋力或阶段：棋力+2、阶段+4、区域+5；实战/近期点特征+5、候选+6、PV+3，文字命中每查询 token +4，另有触发条件奖励。≥8入选，≥10 medium、≥18 high。这是“落点特征/文本规则”，不是完整棋盘几何模板验证。[3]

训练匹配的关键项：[2]
- 定式：棋力+2、阶段+5、角部+5、显式定式意图+10、文本/特征每项+4；坐标重叠每项+5（非布局且无定式意图时+2），候选包含序列第二点+5；≤70手+2。非布局且无定式意图扣10，明确战术问题扣22，置信度最高 partial。
- 死活/手筋：区域+5、显式类别意图+12、具体文字命中+6、文本每项+4、答案坐标重叠每项+12；答案在实战/候选/PV再加5/7/5；另加损失、眼形、接触关系和几何分。
- 两者分数<8淘汰；≥12 partial、≥21 strong；满足 exactish 且≥28才 exact。排序键为置信等级×1000＋分数＋显式意图8/坐标证据4/几何6，后两项依赖已截为8条的 reason 中是否仍有标记。默认返回8项。

`searchKnowledge` 最后却按各路原始 score 降序、同分标题排序，默认4项，不沿用上述置信排序；无跨路ID去重，同一 pattern 可能从两路进入。调用者可改 maxResults。[1]

## 4. “关键词”“棋形”“exact”的边界

文字按标点/空白等切开并小写，再做双向 includes；不是中文语义分词。同义词覆盖依赖手填 tags/aliases/意图词表，短词如“断”“扑”也能触发类别。[2][3]

训练题几何以实战点、候选前6、PV前4及窗口 anchor 对齐答案前2点，要求 anchor 为空；半径4内比较有色相对棋子，枚举8种旋转/反射和换色，结合邻接空点、边界、组数、最小气数。至少匹配3子、混合比例≥0.55、气形分≥3才成立；比例由棋子覆盖76%＋气形24%组成，换色乘0.92。≥0.72可成为 exactish。它不是读棋：额外棋子没有完整逐点排除，窗口外关系不全，且未据 toPlay/playerColor 验证轮谁走。[2]

`sequenceOverlap` 只数原样坐标是否在集合中；集合甚至包含盘面全部棋子、窗口棋子和 anchor，不核对顺序、颜色、合法性，也不把定式序列旋转归一化。定式重叠≥3、布局或明确定式问题且无战术意图，即可 exactish；训练题也可仅凭答案重叠＋具体文字＋意图/分数达到 exactish，不必几何成立。故 exact 是启发式标签，不是同型证明。**机制示例、非运行结果**：Q16/R17/R16 出现在快照中也算三点重叠，未必刚按该定式下过。[2]

另一路 shapeRecognitionEngine 读取 `shape-pattern-cards-v1.json`、调用 localPatternMatcher 和 KataGo 特征提取；不能把上述训练题算法概括成其全部算法。本文只核对其入口、缓存与输出，未审下游匹配细节。[4]

## 5. 主代理核验：工具怎样把材料放入上下文

两个对模型暴露的工具`knowledge.searchLocal`与`knowledge.matchPosition`都进入`knowledgeBundleForState`，不是分别启用两套技能。模型可以提供text、手数、落点、候选、PV及数量；程序还会读取当前棋谱、已有分析与学生画像。有analysis时，实战点、候选与PV优先取analysis，不是全听模型参数。[8]

bundle用原谱落子前前缀重建棋盘，取近期最多40手；围绕实战点、前6候选、前2候选各前4手PV建立局部窗口。传给检索器的PV则拼接前3候选各前8手，不是独立完整分支证据。已有研究指出，此处棋盘重建未应用trialBranch，故试下检索仍有主线快照问题。[8]

返回包同时含knowledge、knowledgeMatches、recommendedProblems和teachingPacing：Matches强制上限8；普通knowledge由参数夹在1–8，searchLocal默认4、matchPosition默认6；推荐题最多3。因此maxResults不是整个工具返回对象的总条数上限。[8]

`executeAgentToolCall`将对象序列化/脱敏，经`compactToolResult`限制为18,000字符，超长直接截尾；随后作为带tool_call_id的tool消息加入本轮messages，才继续请求模型。不是修改system提示、注册新工具、更新模型权重或自动形成跨轮聊天记忆。只读检索本身没有额外embedding请求，但选中的资料仍作为模型输入，不能据本地检索声称零token费或不外发。[8]

system提示要求当前手等分析取得知识工具结果，要求强匹配才明确命名、相似匹配降级。这是使用约束，不是对匹配器正确性的独立验证。本文只说明已读链，不把资料里“来自KataGo分析”等文字当作有可核验引擎记录的证明。

## 6. 返回内容、引用与 Skill 类比

MD 返回 id/title/category/phase/tags/score、约180字符摘要和最多900字符开头正文（优先换行截断）；并非按问题抽取相关段落。原文件路径不返回，尾部参考链接可能被截掉。训练 Match 保留 id、reason、confidence、applicability、结构化 teachingPayload 和 relatedProblems，但不是整题：初始摆子、完整分支序列不返回；sourceKind 是来源类型，不是原文URL。转普通 Packet 的格式化正文也不保留所有字段。shape 包则明确带 sourceRefs。引用能力必须按分支区分。[1][2][4]

**类比与推论：**它像 Skill 的地方仅是“按情境选择少量资料给模型”；不像先展示技能目录、命中后加载操作说明：这里是进程缓存整库、确定性评分、返回教学内容，不注册或执行新能力。已读检索链没有自动学习写回、聊天历史召回、embedding 请求或远程向量库；不能外推整个产品无画像/聊天存档。

**优劣推论：**规则便于解释、离线运行、针对坐标及气形设约束；代价是维护词表/权重，别名和表述变化易漏召回，异路分数难校准，坐标巧合易误召回。语义向量可补自然语言改述召回，但也增加索引/模型依赖和相似度解释成本；文本向量本身不验证棋形、手顺或棋理，不能说“更懂棋”。

## 固定提交证据

以下均为该提交；函数名见正文，未杜撰行号。

[1]: https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/knowledge.ts
[2]: https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/knowledge/matchEngine.ts
[3]: https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/knowledge/patterns.ts
[4]: https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/knowledge/shapeRecognitionEngine.ts
[5]: https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/data/knowledge/index.json
[6]: https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/data/knowledge/joseki/star-point.md
[7]: https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/data/knowledge/training-catalog.json
[8]: https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/teacherAgent.ts

训练加载/类型与验证函数：[training.ts](https://github.com/wimi321/GoAgent/blob/edc6efa15a9a08499b5d42c8342a15a26a10fdc6/src/main/services/knowledge/training.ts)。验证函数存在，但 loader 未调用它；本文不将其当运行时内容质量保证。
