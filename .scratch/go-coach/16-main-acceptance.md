# 16：试下前后可信依据 — 主代理验收

Execution: done（限定为本地试下依据切片；05、08B、连续聊天、RAG和Skill未因此完成）

## 基线与实际变更

基线：`5d04f87f61b1a9c9bba0e58fe508636a32f47167`，分支`integration/go-coach`。本轮无新提交；原有配置、工作流和研究文档改动保留。

主代理已复读实际源码diff及新增测试全文，而非仅采用实现代理的完成声明：

- `src/EnginePanel.tsx`：保留分析引用，使用完整规范输入配对直接前驱，64条面板内成功结果上限；当前结果仍须新分析成功。起点不误标试下，变化接入依据查看。
- `src/ReviewEvidence.tsx`：最小可选试下来源，原谱起点/变化手数和试下措辞；默认实战显示未改语义。已有会话观察/过期/取消逻辑继续复用。
- `tests/variation-evidence.spec.ts`：12项完整浏览器/真实HTTP验收，覆盖提子、气、Pass、前缀、取消、换分支、失效及缓存上界。

代码仅修改上述2个产品文件并新增1个测试文件；未更改服务端证据协议、棋规、凭据、依赖、预算或整体视觉。实现过程及首个真实RED→GREEN记录见[实施日志](16-implementation-log.md)。其余回归测试没有被虚称为都经历了独立RED。

## 主代理独立运行

1. `npm.cmd run build`：通过（TypeScript检查、Vite生产构建、服务端bundle）。
2. 确认独立端口5200未占用后：`$env:GO_COACH_TEST_PORT='5200'; .\node_modules\.bin\playwright.cmd test --workers=2`：**145 passed，约5分钟**。包括原133项及新增12项；未复用或停止用户5173。
3. `$env:DESKTOP_EVIDENCE_DIR='D:/code/tmp/go-coach-notes/16-main-desktop'; npm.cmd run test:desktop`：重新打包真实Windows exe，**56 passed，约5.5分钟**。覆盖既有宿主、配置、凭据隔离、依据、关闭和安全回归；新增试下行为矩阵由浏览器套件覆盖，未宣称桌面套件新增了同一矩阵。
4. `git diff --check`及新测试文件的`git diff --no-index --check`通过；LF/CRLF提醒不属于空白错误。辅助`Get-FileHash`在当前PowerShell不可用，随后改用Node crypto逐文件成功计算下述SHA-256。

测试仅使用合成棋谱、隔离userData、脚本/临时原生测试引擎和合成凭据，不运行真实KataGo/GPU，不读取用户真实Key或私谱，不请求真实模型/embedding或产生模型费用。公开资料研究和打包工具获取资源不等于“整轮没有网络”；这里的零外发结论限定为未外发用户棋局/聊天与未调用真实模型。

## Standards 独立审查

审查代理`dede28b0-73fc-4c7`：**无material findings**。

按指定基线检查两个源码diff，全文读取新测试；沿用既有代码格式，复用依据/失效机制，无私有测试接口或推测性抽象。真实UI/HTTP业务路径未mock；外部引擎请求计数用于验证“不补跑分析”约束，而不是内部协作者调用次数。未发现值得本片重构的重大smell。

边界：只读静态审查，不独立执行测试；测试结果由主代理上述复跑支持。

## Spec 独立审查

审查代理`026742c0-f459-4a0`：**无material findings**。

未发现本片必需行为缺失、越界或已确认错误。完整输入配对、仅有效成功写入、64条上界与当前结果不由缓存冒充符合16设计；来源明确不冒充服务端认证，默认实战保持；选择/引用key与卸载取消隔离旧详情，服务完整历史与条件核验、watch/TTL拒绝路径未放宽。

边界：同盘不同有序历史由公开HTTP覆盖，未再重复完整浏览器路径；分析迟到错误沿用既有回归，新测试未穷举分析流全部切换组合。不是由“无问题”推断完整聊天/RAG或真实教学合格。

**两轴汇总：Standards重大问题0，Spec重大问题0；无未解决阻塞项。**

## 当前构建与指纹

开发构建：`desktop-release/win-unpacked/Go Coach.exe`。必须保留整个目录；旧的`D:/code/tmp/go-coach-desktop/windows-x64-a1cd762-main/`留档未被替换。本轮没有复制新留档、发布或提交；后续重新构建会覆盖当前开发构建。

| 文件 | SHA-256 |
| --- | --- |
| `src/EnginePanel.tsx` | `94f7a0c3124f5b05300c8f6207e36c5f03c85d06137000f7ea4cb410b6dace4f` |
| `src/ReviewEvidence.tsx` | `7d3c522b476752aa1b9440865b0a1d0489ce4c3591ac284d23615fbb41a5050b` |
| `tests/variation-evidence.spec.ts` | `5f817a599aee273eb92b0ccabfa8483475be65067360c4a57b3e3298bb464bfd` |
| `desktop-release/win-unpacked/Go Coach.exe` | `35e415b035c9b1e68a390e3162afcfda8e4b4c4262b4824b5aa58f050f233572` |
| `resources/app/dist/assets/index-Coph2tkw.js`（包内） | `43075fc3e15c80246f37c35a1a11b434d75d753d8c375a528a6131f826832637` |
| `resources/app/.server/index.js`（包内） | `ca80f33b80fb35ef7c0c043cadde5bf51ca254837a28e519cc58aed91a2ca23b` |

## 完成边界与下一步

本片已让当前试下取得正确本地前后依据，缺少前驱时明确不可用且不自动补跑；不是中文策略讲解。尚未实现连续聊天、聊天存档、RAG检索、Skill加载、模型工具循环或08B预算保护。

本轮用户进一步确认了开发字段范围和逐次预览、历史超限先暂停，以及首批资料采用许可明确的公开小集。这些是后续开发方案，不是现在真实发送/消费的授权；具体schema、工具硬限、存储与预算设计仍须完成。教材候选许可核查见[来源候选](go-knowledge-source-candidates.md)，尚未导入或完成教学审校。
