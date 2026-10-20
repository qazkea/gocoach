# 15：服务端讲解依据与桌面本地核对

Execution: in-progress

基线945bb7d（14已验收）。依据desktop-review-scope.md与deepseek-integration-plan.md。用户同意继续接入官方DeepSeek；本票为必要的本地可信证据切片，不读Key、不发送在线请求、不生成AI策略、不计真实费用，不冒充05/08/10全部完成。

## 用户可见纵切片

- 在整局复盘区域新增明确的 **查看本手讲解依据** 按钮及按需详情。只有初盘的当前分析，或第k手的前/后两帧分析齐全且兼容时才可查询；缺失时解释尚未齐全。不因打开详情自动补跑GPU或在线AI。
- k=0：初盘、当前轮次、初始棋子数量及当前手后下一方候选，没有实际上一手/前后变化。
- k>0：显示实际执棋方与落点/pass、实际提掉的棋子坐标/数量、非pass时新落子所属己链在落子后的实际气（坐标列表/数量）。用既有replay/groupAt复算，不添加围棋规则或战略判断。
- 分开显示 **实战落子前的候选（本手执棋方）** 与 **实战落子后的候选（下一方）**，对应P[k−1]/P[k]。估值始终BLACK，实际执棋方的下降保留正负，不叫最优手损失或必然原因。
- 估值/事实和“中文策略尚未接入、没有发给DeepSeek”分别标明；无ownership、PV假设、两气不等于活棋等限制保持。
- 点击后切手/换谱/引擎会话变化必须清除旧详情、取消本请求并隔离迟到响应；返回同手可以再次查询本地依据，不额外运行引擎。明确显示加载/错误。会话失效通过下述本地推送获知，收到失效/断线后立即清除；不声称网络阻塞时能在物理引擎变化的同一瞬间知晓。
- 139fc4f审查确认P2：不能只靠FullGameReview的新结果/失败/切手key刷新来发现引擎死亡。用户留在同一手查看依据，或另一个手动分析面板重启引擎时，也必须收到本地失效事件。实施日志披露缺推送不替代该需求。
- 引用失效/淘汰/重启时不回退用客户端估值拼依据，不默默调用GPU；首片明确提示“讲解依据已过期，请重新导入棋谱分析”。不声称已提供单手重新取证UX，后续讲解切片再实现。

## 可信身份与模块

- 新增server/evidence.ts深模块，服务成功分析后issue(已校验Position, EngineResult)，按需resolve/buildReview。只接既有position()/result()校验后的结果；失败、取消或已失效generation不签发。
- 不把证据字段强塞入底层KataGo输出类型：可定义AnalyzedResult = EngineResult + evidenceId。/api/analyze的成功result增加evidenceId（randomBytes(32).hex）；底层结果校验、100visits/2秒、候选/PV合法性不变。src/analyze及两个消费者继续正常工作，FullGameReview保留引用。
- 证据绑定：规范化完整初始棋子/初始方/全部有序历史（含pass）/RU/KM/HA；engineSession（服务UUID＋实际generation）、engine/model/profile/komi/bonus、固定预算/版本；root、通过核验的前10候选/PV与候选总数。只保存服务端构造的内容，客户端数值、坐标结论、伪造模型/版本不得成为依据。
- 规范化由已有合法replay还原字段/固定序列化顺序实现；初始棋子按棋盘顺序，历史不排序，HA未记录和0不随意合并。不以盘面相同代替完整历史相同。
- 不保存整个Replay的所有棋盘帧（长谱乘以所有局面会平方放大）。保存必要完整input与有界结果的序列化数据，读取时只重建当前请求需要的Replay/最后两帧；不保存原SGF、名字、注释、文件名、源路径等。
- 每次成功签发新的不可猜ID；重复同局面重分析不是同一证据。首片不做跨谱/跨标签分析去重。
- 记录容量 **2000条且总序列化UTF-8内容≤64MiB**，LRU淘汰；过期时间 **签发后2小时**，读取不延期。明确统计序列化payload，不宣称JS进程总RSS为64MiB。元数据额外有2000条上界；不持久化。平台时钟回退不能续命（优先单调时钟）。单条超限不签发成功。
- server/katago.ts最小增加当前session有效性只读查询（ready且非closing且generation身份一致），或等价失效通知；证据查询必须即时判断，不等新成功才失效。引擎死后旧ID在新引擎尚未启动时也拒绝。close清证据；进程重启自然无旧ID。保留原关闭/取消/墓碑/版本进程回收语义。

## 公开HTTP契约

- 增加POST /api/review-evidence，保留精确Host/Origin/JSON/CSRF/64KiB/无CORS/生产CSP。同源查询也必须有CSRF；无GET读取/枚举全部证据的接口，响应no-store。
- body仅允许 `{position: EngineInput, afterId: string, beforeId?: string}`。position是当前客户端选择的期望上下文，不是权威棋盘；重新合法性校验且与after记录的规范化完整身份完全匹配。ID必须64小写十六进制，未知字段包括root/PV等均拒绝。
- k=0不得带beforeId；k>0必须有beforeId，且before完整input恰好是after去掉最后一手的前缀，初盘/规则/贴目/让子相同，两条engineSession/model/profile/komi/bonus/预算版本兼容。错手数/错前缀/同盘不同历史/混合会话不得拼接。
- 返回版本化ReviewEvidence DTO：当前手号与下一方、实际落子/事实（初盘标null）、前后引擎估值及前10候选/总数/分析条件、约束说明。DTO由服务端构造；不返私有文件路径/未截断原结果/全量记录。
- 成功200，输入/关联不匹配400，引用缺失/过期/会话失效410（统一中文过期提示）；安全错误403/方法404遵循旧约定。无任何错误触发引擎、AI、文件读取或自动重试。
- 增加只观察的POST /api/engine-session-watch：相同Host/Origin/CSRF/JSON/64KiB校验，body严格空对象；application/x-ndjson/no-store。连接建立即返回当前有效engineSession（未就绪/失效为null），KataGo失效与ready变迁推送新状态。不启动/重启引擎，不发AI、不读配置，不开放test/执行入口。最多16个在途观察连接，超过明确429；res关闭解除listener，server close终结观察。会话观察不是新增GPU查询，也不是轮询。
- UI只在用户点击查看依据后开启观察，必须收到与前后引用一致的首个session后才发review-evidence请求；在详情显示期间保持观察。失效/不同session/连接中断/协议错误立即清详情并取消取证请求，保留可见过期/失联原因；切手/换谱卸载结束观察。同一生命周期中收到旧HTTP结果也须复核观察状态/请求epoch，不依赖响应到达顺序。默认扫描及未打开详情时不得自动开启该连接。请求按钮仍可显式重试但不自动重启任何引擎。
- KataGo以最小公开观察接口通知真实ready/fail/close/generation变迁，首订阅同步当前状态，监听器不窥探pending/children私有状态。主进程/server退出仍先失效后清理；底层版本/子进程回收语义保持。
- /api/analyze仍是唯一GPU分析入口；没有新增HTTP路径指定执行程序/配置/测试adapter。

## 文件范围与测试

预期新server/evidence.ts、src/evidence.ts（共享DTO/请求不混secret）、src/ReviewEvidence.tsx；小改server/index.ts（路由/issue/close/开发精确模块白名单）、katago.ts（只读有效性）、src/engine.ts/analyze.ts/FullGameReview.tsx。EnginePanel如仅类型兼容不强制加入新详情。桌面入口/配置/打包/权限不重做；新增共享文件须遵守公开白名单。

沿用批准seam：真实浏览器/真实打包exe完整流程，外部JSONL引擎仅提供可手算数值/合法候选；不mock证据模块、规则或session。安全负例在公开HTTP入口提交篡改body/引用并观察响应，UI成功流程必须真实点击。容量/TTL测试可以通过公开API批量合法分析和**外部平台单调时钟adapter**推进时间；不得调用私有store/改其entries、缩小生产上限来冒充边界覆盖、修改机器时钟或添加业务测试接口。

至少验证：
1. 合成ba/aa/ab/pass第3手实际黑ab提aa，落子前属于黑、落子后属于白，手算气与候选数值来自各自帧；第4手白pass无新己链/无提子，初盘无前手。
2. Japanese HA2/白先、双规则贴目不混；同盘不同完整历史(pass前缀等)不能冒用引用。
3. 无效/额外字段/错期望position/错误before/随机引用/跨origin-CSRF拒绝；取消/无效引擎结果无可用ID；未配置仍可回放。
4. 引擎fail/restart立即使旧证据不可用，新一代两帧才可拼接；新服务实例不接受旧ID。
5. 2000条容量与64MiB淘汰（不同上限分别说明实际动态覆盖）；TTL平台时间、读取不延期；不漏删引用、不将淘汰错误变成客户端fallback。
6. 换谱/切手迟到响应不覆盖、回看不发GPU、已有整局队列/走势/手动变化不回归。
7. 真实打包exe上至少合成前后两方/事实、失效提示、无外发、正常关闭；新截图/自有进程清理证据。
8. 同手已显示详情时杀死外部引擎必须清除（不得以切手替代）；真实成功HTTP已生成但延迟交付时，watch先失效后放行旧响应不能复活；另一个手动面板重启后旧refs仍不得恢复。网页与真实exe均覆盖。
9. watch首条null不发取证；坏帧、未完成尾行、连接断开及10秒首条期限可见失败；浏览器offline事件到达时清除已显示详情，不假设idle reader会立即reject。严格字段/Host/Origin/CSRF/大小/方法、16名额/释放及serverclose在公开HTTP验证。默认扫描无watch，回看不增加引擎分析。

TDD逐片RED→GREEN；完整原110网页＋30桌面及新增、typecheck/build/diff-check，独立两轴审查和主代理复测。真实GPU仅主代理后续授权合成最小复测；实现者不运行真实GPU、不读取实际operator/Key、不外发/安装/付费、不操作5173、不push。未动态覆盖的上限/时间分支必须披露，不能把静态推断记成测试通过。
