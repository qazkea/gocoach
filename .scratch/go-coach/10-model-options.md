# 10：中文文字 API 候选（历史比较）

> 后续决定：用户已选择DeepSeek负责中文讲解；下文是此前未选定时的历史比较，不作为当前价格或实际调用授权。具体模型与接入政策须重新核验；最新需求见 [desktop-review-scope.md](desktop-review-scope.md)。

查询时点：**2026-10-16 19:08–19:11，UTC+8**；下列官方 URL 均于此时核查。仅公开文档研究；未调用推理、上传棋谱、付费、安装模型、读取账户/密钥/Pi配置或调度代理。报价不是授权，也不证明围棋教学能力。

## 文档证据与同口径估算

均选实时按量、纯文字、非思考、不启用搜索等收费工具。单价单位为**每百万 token**；免费额度不计保障。示例每次3000输入＋2000输出，缓存未命中、不创建显式缓存，100次/月：`0.3×输入价＋0.2×输出价`。

| 候选 ID／地域／模式 | 输入／输出；缓存与推理 | 示例月费（推算） |
|---|---|---|
| DeepSeek官方 `deepseek-flash`，当前映射V4.1-Flash；中国开放平台，推理落区未核验；Chat Completions，`thinking.type=disabled` [D1] [D2] | CNY：高峰2／8，缓存命中0.04；空闲1／4，命中0.02。高峰为北京时间工作日9–12、14–18，法定节假日除外；示例取高峰。非思考无推理增量；启用思考后的独立计费说明、合计上限未核验 [D1] [D2] | **¥2.20** |
| 百炼 `qwen-plus`，当前等同2025-12-01；北京接入/存储、中国内地推理；Chat Completions，`enable_thinking=false` [Q1] [Q2] [Q3] | CNY：输入≤128K时0.8／2；思考模式输出8（含思维链）。隐式缓存命中输入0.16；显式创建1、命中0.08，仍有费用 [Q1] [Q4] | **¥0.64** |
| OpenAI `gpt-4.1-mini-2025-04-14`；默认全球API，未指定驻留；Responses标准模式，`store=false`，无推理步骤 [O1] [O2] | USD：0.40／1.60；缓存命中0.10；本模型无推理增量 [O1] | **$0.44≈¥3.52**；预算假设1USD=8CNY，非实时汇率 |

以上仅token费算例，不含税、汇兑或另购平台服务；不是50元封顶保证。别名映射、阶梯、价格及可用性须接入前复核。

## 接口、隐私与接入限制

字段均来自文档，**没有真实响应验证**；下列usage字段均相对于`usage`。

| 候选 | 结构与输出限额 | 用量字段 | 数据与接入 |
|---|---|---|---|
| DeepSeek | `json_object`须提示JSON，不保证schema且可能截断。严格工具schema为`/beta`功能，仅支持子集；对象字段全required、`additionalProperties=false`，不支持字符串min/maxLength。用`max_tokens`，不是`max_output_tokens`；思考合计上限未核验 [D2] [D3] | `prompt_tokens`、`completion_tokens`、`total_tokens`；`prompt_cache_hit_tokens`、`prompt_cache_miss_tokens`；`completion_tokens_details.reasoning_tokens` [D2] | 境内运营个人信息境内存；API内容保存期限、训练用途**未核验**，不能套用聊天端退出开关。需开发者认证、API Key及预充值；地域准入清单未核验 [D4] [D5] |
| 百炼 | 此ID非思考支持JSON Object，提示须含JSON；不在严格JSON Schema支持列表。`max_tokens`仅限回答，**不含思维链**，不能当推理总预算；本例关闭思考 [Q2] [Q5] | `prompt_tokens`、`completion_tokens`、`total_tokens`、`prompt_tokens_details.cached_tokens`；本模式推理细分字段未核验 [Q4] | 按量API不用于训练；依法保存调用数据，仅承诺服务必要最短时间，具体天数未知；不外推到Coding/Token个人套餐。需开通/必要实名认证、Key、Workspace；地域Key/域名不可混用 [Q3] [Q6] [Q7] [Q8] |
| OpenAI | 支持严格JSON Schema子集：字段全required、对象禁额外属性；拒绝/截断须另处理。`max_output_tokens`含可见输出与推理token，本模型无推理步骤 [O1] [O3] [O4] | `input_tokens`、`output_tokens`、`total_tokens`；`input_tokens_details.cached_tokens`、`output_tokens_details.reasoning_tokens` [O4] | API默认不训练，主动共享除外；滥用日志通常最多30天，法律/安全例外可延长。`store=false`不等于零留存，缓存亦有保存；ZDR需批准。中国大陆未列支持地区，**大陆使用不适用**；需合规地域API账户/Key，未查用户资格 [O2] [O5] |

## 决策边界

**推断**：三份算例token费低于50元，只说明值得进一步核验，不构成选择建议。无法封顶的推理、平台费用或未知政策必须阻断，不能按此表保证月费。

沿用[08](issues/08-private-budgeted-calls.md)：请求前保守预留，计入并发在途；失败/timeout可能收费，未知账单锁定，不盲目释放；价格变更或费用无法安全估计即停用。

**待用户选择/授权**：服务、地域、保存/训练政策、最小外发字段及身份过滤；08方案通过后，另授权上传、真实调用与付费。**待真人教学试验**：按[10](issues/10-real-ai-teaching.md)及[父规格](spec.md)核对棋子、关系、变化及推荐取舍；估值/棋谚不是原因，缺证据不下结论。中文/JSON能力不证明懂围棋或教学更好。

## 官方来源（统一查询时点见首段）

[D1]: https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
[D2]: https://api-docs.deepseek.com/api/create-chat-completion/
[D3]: https://api-docs.deepseek.com/guides/tool_calls
[D4]: https://cdn.deepseek.com/policies/zh-CN/deepseek-privacy-policy.html
[D5]: https://cdn.deepseek.com/policies/zh-CN/deepseek-open-platform-terms-of-service.html
[Q1]: https://help.aliyun.com/zh/model-studio/model-pricing
[Q2]: https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions
[Q3]: https://help.aliyun.com/zh/model-studio/beijing-access-information
[Q4]: https://help.aliyun.com/zh/model-studio/context-cache
[Q5]: https://help.aliyun.com/zh/model-studio/json-mode
[Q6]: https://help.aliyun.com/zh/model-studio/what-is-model-studio
[Q7]: https://terms.alicdn.com/legal-agreement/terms/common_platform_service/20230728213935489/20230728213935489.html
[Q8]: https://help.aliyun.com/zh/model-studio/first-api-call-to-qwen
[O1]: https://developers.openai.com/api/docs/models/gpt-4.1-mini
[O2]: https://platform.openai.com/docs/guides/your-data
[O3]: https://platform.openai.com/docs/guides/structured-outputs
[O4]: https://platform.openai.com/docs/api-reference/responses/create
[O5]: https://help.openai.com/en/articles/5347006-openai-api-supported-countries-and-territories
