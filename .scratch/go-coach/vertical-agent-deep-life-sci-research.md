# deep-life-sci：对话主体怎样调用领域方法与证据

固定默认分支 `main` 提交：`f66109fc41e974dbc141520ecc3b9c921fd7af5c`（GitHub API 返回）。这是有聊天前后端的**研究助手示例应用**，不是医疗产品认证，也不只是框架。本文检查12个机制文件、2个测试文件及许可证；只读公开源码，未安装、运行、请求模型或启动沙箱。下列链接均固定此提交。

## 1. 领域知识不是一包塞进 system 的教材

知识分三层：

- **常驻规则**：[system.py 的 `build_system_prompt`][system] 设置研究助手角色、当天日期、检索纪律、引用格式及 JS/Python 分工。这是角色与操作提示，不是按需 Skill。
- **任务方法**：[pubmed/SKILL.md][pubskill] 教字段标签、MeSH与关键词漏检差异、撤稿提示、摘要→章节→图表的升级路线；[clinical-trials/SKILL.md][trialskill] 教注册计划与实测结果的区别、NCT与PMID互查。它们是包内真实文件，不是动态生成的“专家人格”。
- **事实证据**：来自在线 PubMed/PMC/试验注册记录及用户上传，摘要由 [`fetch_abstracts`][pubmed] 缓存到主机磁盘；没有在所查链路发现 embedding 或本地向量库。这里是工具检索增强，不是“向量库替代聊天”。

[`build_agent`][agent] 的关键装配是：

```python
root_backend = CompositeBackend(default=backend, routes={
    "/skills/": FilesystemBackend(root_dir=SKILLS_DIR, virtual_mode=True)
})
create_deep_agent(
    model=root, system_prompt=build_system_prompt(),
    backend=root_backend, skills=[("/skills/", "Research")],
    # 另有领域工具、子代理和 middleware
)
```

它还给 `/skills/**` 配置禁止写入。system要求首次使用某来源前读对应Skill：不是每轮注入两份全文，也不是代码强制的固定检索流水线。**证据边界**：项目接入真实Skills机制、解析测试均可见；目录摘要如何注入、读取结果的精确消息封装委托 `deepagents`，本次未追依赖源码。因此按需加载是实现意图与框架接入证据，不是实测每次必读。

## 2. 第一问与下一问实际送什么

[`Thread.handleSubmit`][ui] 构造 `type: "human"`，内容是文本加附件块，提交：

```ts
stream.submit({ messages: [...toolMessages, newHumanMessage], context }, ...)
```

`toolMessages`来自补齐未响应工具调用的辅助函数；不是整段历史。旧消息拼接出现在 `optimisticValues`，那是UI乐观显示，不能当模型记忆证据。

首轮在框架边界是：**system**＝上述常驻提示及框架附加指令；**user**＝这一问；新thread无旧历史；**tools**＝`eval`编排入口、文件/任务等框架能力。PubMed等九个来源函数注册进 `CodeInterpreterMiddleware.ptc`，主模型写 `tools.pubmedSearch(...)`，不应想象为九份资料直接进入消息。最终模型API的完整tool schema未抓取。

[`StreamSession`][stream] 用URL中的 `threadId` 调 `useStream`，配置 `fetchStateHistory: true`，新建后把返回ID写回URL。下一问沿同一thread提交增量。服务端 [`make_graph`][graph] 读取 `configurable.thread_id`，返回构建的agent；**旧消息恢复、与新消息合并、再传给模型，依赖LangGraph服务端状态/checkpoint及deepagents调用链**。本仓没有手写“读聊天文件再拼messages”，本次未核验SDK内部及服务端存储实现，不能声称已端到端证明跨重启记忆或完整历史永不压缩。

同一函数按thread复用沙箱、续期thread TTL，但沙箱文件不是消息历史；容器消失后普通工作文件会丢。system写“变量跨轮保留”也属于对解释器的约定，不能由沙箱复用反推其持久性。

附件另有明确注入代码：[UploadMiddleware][uploads] 在模型调用前把上传载荷改成标记；`awrap_model_call`将文件清单追加到system，正文仍需读取，不把base64一直带进对话。

## 3. 一条真实可追的研究链

以下是源码已有工具与提示范式的缩写，不是本次运行结果：

```js
const probe = await tools.pubmedSearch({term, retmax: 0});
// 检查 count / warnings / query_translation，先收敛范围
const hit = await tools.pubmedSearch({term, retmax: probe.count});
const {records} = await tools.fetchAbstracts({
  pmids: hit.records.map(r => r.pmid)
});
const answers = await Promise.all(Object.values(records)
  .filter(r => r.abstract).map(async r => ({
    pmid: r.pmid,
    answer: await task({subagentType: "abstract-analyst",
      description: `Question: ${question}\nPMID: ${r.pmid}\n${r.abstract}`})
  })));
await tools.writeFile({file_path: "/workspace/answers.json",
  content: JSON.stringify(answers)});
answers; // 实际应只返回综合回答需要的字段
```

真实调用链：`eval`→[`pubmed_search`][pubmed]→NCBI esearch/esummary→`fetch_abstracts`的批量efetch/缓存→`task`→[摘要分析员提示][leaves]→根模型综合。证据文本进入子代理**任务描述**，读后答案经eval工具结果回根模型；不是自动全文灌入root。PMID随答案保留，最终按system生成链接引用，但没有由此证明每项结论都被引用支持。

摘要不足时，[`pmc_locate` / `fetch_full_text`][pmc] 提供章节目录、选定正文和 `fell_back` 标志；正文进入全文分析员任务，要求逐字引用关键句并标章节。不是所有长资料都先落文件：论文可直接传子代理；相反，[`trial_files._prepare`][files] 对超过24KB的试验记录确实写完整JSON、章节及索引，仅返回manifest，让分析员按需读文件。

专业分工也明确：LLM判断文章是否回答问题、说明局限；Python负责计数、分组、统计和绘图。子代理代码配置只读文件能力（试验分析员另有grep），没有来源检索和shell；根代理可执行沙箱Python。它不是像KataGo那样自带领域求解器，而是通用计算库加外部证据。

**纯机制示意问答**：

> 用户：找研究问题Q的证据，说明研究类型。
>
> 助手：先查范围，再读摘要；需要时读方法部分，按PMID列证据与不足。
>
> 用户：只看随机对照研究。
>
> 助手：沿同一thread理解Q，结合已有 `publication_types`，必要时用 `randomized controlled trial[pt]`重查并核对方法；说明剔除了哪些类别。

这是预期行为而非录制实测；新追问不能只依赖之前文件“还在”，必须恢复消息且把所需证据重新读入可见上下文。

## 4. 约束、测试与风险

硬代码可见：PMID校验、retmax上限9999、章节缺失回退标记、24KB转文件、解释器900秒/40000字符/512工具调用上限、递归200步。提示要求的“先探测、始终引用、最多300摘要/10全文并发、别编造”不是同等强制保证。尤其Skill说返回全部匹配，而 `pubmed_search`默认只取50条；必须核对 `count`与`returned`，不能照抄提示就保证穷尽。

[测试][tests] 使用假模型与mock HTTP，包含真实编译agent→QuickJS→来源工具→ToolMessage，以及大试验文件索引读取链；[不变量测试][invariants] 检查工具提示覆盖及两份Skill可解析。它们不证明真实模型筛选准确、引用可靠或多轮历史恢复；本次也没有运行测试。

代码装配依赖托管沙箱、远程模型；根模型、分析子模型及Web搜索摘要可能形成多次计费调用。未核算价格、验证服务可用性或审查所有依赖。原文核验根[LICENSE][license]为MIT、2026 LangChain；[前端LICENSE][fl]为MIT、2025 Brace Sproul：复用需保留声明，且无担保。论文/图片许可独立，Skill中的再分发提醒不是法律授权或自动合规检查。

## 能借鉴什么 / 不能由此保证什么

可借鉴：连续聊天为主线，工具拿事实，Skill教任务方法，长材料隔离读取，小证据包带来源返回，确定性计算与解释分开。

不能保证：自动拥有专家知识、完整召回、医学正确性、持久记忆或成本可控；也不据此替Go Coach选框架。

[agent]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/deep_life_sci/agent.py
[system]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/deep_life_sci/prompts/system.py
[pubskill]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/deep_life_sci/skills/pubmed/SKILL.md
[trialskill]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/deep_life_sci/skills/clinical-trials/SKILL.md
[pubmed]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/deep_life_sci/sources/pubmed.py#L364-L438
[pmc]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/deep_life_sci/sources/pmc.py#L594-L752
[leaves]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/deep_life_sci/prompts/subagents.py
[files]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/deep_life_sci/sources/trial_files.py#L78-L135
[ui]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/frontend/src/components/thread/index.tsx#L154-L192
[stream]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/frontend/src/providers/Stream.tsx#L93-L131
[graph]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/deep_life_sci/graph.py
[uploads]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/deep_life_sci/middleware/uploads.py#L772-L787
[tests]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/tests/test_runtime.py#L272-L399
[invariants]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/tests/test_invariants.py#L274-L294
[license]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/LICENSE
[fl]: https://github.com/langchain-samples/deep-life-sci/blob/f66109fc41e974dbc141520ecc3b9c921fd7af5c/frontend/LICENSE
