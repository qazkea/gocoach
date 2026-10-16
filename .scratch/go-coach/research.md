# 围棋复盘教练：两项事实核查

范围：仅核实野狐 PC 棋谱导出与 KataGo 分析能力；未安装客户端、下载引擎或实际运行分析。结论依据下列一手页面，不以搜索摘要或第三方教程作为确认依据。

## 1. 野狐：自己对局导出 SGF 尚未核实

- [野狐官方文章《这些功能您都用过嘛》](https://www.foxwq.com/news/9166.html)明确介绍的是**保存直播棋谱**。文中先展示“棋谱欣赏 → 直播棋谱／高级讲解棋谱”找不到保存按钮，随后给出的正确路径是：在解说框搜索对局者 → 个人信息框“棋谱” → 棋谱列表双击目标对局 → 出现保存按钮。不能把前一条路径直接描述为可导出路径。
- 该历史文章可证明当时存在直播棋谱保存功能，**不能确认当前 PC 版本导出自己对局为 SGF的操作入口、格式、默认磁盘目录或权限／数量／历史期限限制**。这些均未核实；也不能据此断言不支持。
- [官方热门问题](https://www.foxwq.com/soft/userguide.html?lang=zh)未提供所需导出说明。[官网另一条 SGF 说明](https://www.foxwq.com/news/10555.html)实际属于“腾讯少儿围棋”教师端 AI 挂盘／讲解房的**上传**功能，不能用来证明野狐普通 PC 客户端**导出**。

## 2. KataGo：有结构化分析，无现成教学解释

依据：[官方 Analysis Engine 文档](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)（本次读取 master，非固定发行版）。

- **候选、变化、估值已确认**：[Responses](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md#responses) 的 `moveInfos` 返回被考虑的候选 `move`、排名 `order`、搜索次数 `visits`、主变化 `pv`、`scoreLead`（预估领先目数）与 `winrate`（0–1）。`rootInfo` 是当前局面总体统计。候选不等于全部合法着，PV 长度可变甚至为空；`scoreMean` 是 `scoreLead` 的兼容别名，并非另一种独立估值。
- **试下后重新分析已确认**：[Queries](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md#queries) 接受 JSON `moves`、棋盘大小、`rules`、`komi`，可用 `analyzeTurns` 指定局面；不传则分析序列末尾。因此保留实际历史前缀、换成用户试下分支后重新提交即可分析后续局面。这是接口能力推导，未实测。可用 `initialStones` 提交无历史局面，但官方建议已知历史时使用 `moves`，以正确处理劫／超级劫。该接口吃 JSON，不是直接上传 SGF 的网页服务。
- **估值不是教学依据**：输出视角受 `reportAnalysisWinratesAs` 配置控制，跨前后局面比较必须统一视角、规则与贴目；数值属于模型／搜索估计，不是新手实际胜率、确定结局或“为什么错”的解释。
- 文档所列分析响应**没有自然语言棋理原因或教学难度字段**。[Human SL Analysis Guide](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md#human-sl-analysis-guide)可通过额外人类模型与段级位配置得到 `humanPolicy`／`humanPrior` 等预测；官方把“按水平选择复盘错误”等放在 *Possible metrics that might be interesting* 中作为探索建议，不是已经验证的难度评分。不能把候选排名、掉目、搜索不确定性或人类落子概率直接等同教学价值。

## 仍需真实样本验证

1. 请用户在当前野狐 PC 版本实际导出一盘自己的 19 路棋：记录版本、菜单、保存路径、格式选择及限制，取得真实文件；检查是否为可解析 SGF，以及编码、落子、结果、规则、贴目、让子信息是否完整。默认目录和长期历史可用性不猜测。
2. 取得授权样本后，在选定引擎／模型版本与搜索预算下验证原局及试下分支的合法性、估值视角、变化稳定性和响应时间；本次没有性能实测。
3. 用真实新手复盘检验挑选的 1–3 个局面能否讲清、难度是否合适；官方数值输出本身不证明教学有效。
