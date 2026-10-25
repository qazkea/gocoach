# 16 实现记录（交回主代理，未最终验收）

## 范围与约束

- 基线：integration/go-coach，任务给定 HEAD `5d04f87f61b1a9c9bba0e58fe508636a32f47167`。
- 已完整读取 pi-workflow、16-design、16 issue、TDD（含 tests/mocking 引用）与 GLOSSARY；本工作区没有 docs/adr 目录。
- 测试 seam 沿用主代理确认的真实浏览器 → 真实 HTTP → 真实棋规/服务端依据；只使用既有脚本外部引擎、时钟 fixture 与 HTTP 平台交付门控。
- 只改 `src/EnginePanel.tsx`、`src/ReviewEvidence.tsx`、新增 `tests/variation-evidence.spec.ts` 和本记录。未改既有未提交研究/配置/规格文档；未提交、回退或发布。
- 未改服务端协议、棋规、依赖、凭据或布局；未运行真实 KataGo/GPU、远端模型/embedding；测试端口 5199，无占用冲突，未使用/停止 5173。

## 实现

- 保留 AnalyzedResult；面板实例内 Map 以完整 engineInput JSON 身份保存最多 64 个成功结果。相同身份删除再写入；超过上限淘汰最旧成功写入，读取不刷新顺序。
- 只在 active 且未取消的成功路径入缓存；当前结果仍须分析成功，不用缓存替代当前分析。前驱使用当前完整输入恰少最后一手的身份；不按手数或布局猜测。
- cursor > origin 接入 ReviewEvidence；起点只作说明。parent key 含当前完整局面、前后 evidenceId，选择/重分析清空当前结果时旧详情卸载并取消 watch/I/O。
- ReviewEvidence 最小可选 variationOrigin；默认实战文案不变，试下独立入口/region、来源与前后候选文案。明确来源标签来自本地面板，不声称服务核验了原谱/分支身份。

## 实际 RED / GREEN

1. 先写一个非零起点提子/气/Pass/原谱未来隔离的浏览器测试。
2. RED：`$env:GO_COACH_TEST_PORT='5199'; npx.cmd playwright test tests/variation-evidence.spec.ts --workers=1`
   - 1 failed，失败在缺少“当前为试下起点，落子后可查看试下依据”；原代码无试下依据入口。
3. 接入最小完整前后配对和试下文案后同命令 GREEN：1 passed（3.8s）；`npm.cmd run typecheck` 通过。
4. 增补已有实现的回归覆盖（没有声称每个回归测试都有独立 RED）：取消前驱/不同路径、撤回重走改下重分析、同盘不同历史 HTTP 拒绝、64 上限与同身份替换。4 passed（23.8s）。
5. 再增补真实成功/410 响应延迟 × 切分支/换谱/关闭共六种交付门控，以及会话死亡/重启与 TTL。最终同命令：12 passed（41.8s）。门控观察真实响应到达后再切换，在 finally 释放，不使用睡眠推断顺序，不伪造依据响应。

## 最终运行命令与结果

- `$env:GO_COACH_TEST_PORT='5199'; npx.cmd playwright test tests/variation-evidence.spec.ts --workers=1`：12 passed。
- `npm.cmd run build`：通过（tsc --noEmit、Vite、服务端 bundle）。
- `$env:GO_COACH_TEST_PORT='5199'; npx.cmd playwright test tests/evidence.spec.ts tests/engine.spec.ts tests/variations.spec.ts tests/import.spec.ts tests/full-game.spec.ts --workers=2`：90 passed（4.0m）。包括既有实战依据、引擎成功/失败迟到、回放/棋规、整局扫描与变化回归。
- 所有运行使用本地合成棋谱与既有受控外部引擎 fixture；fixture 清理检查通过。

## 覆盖边界 / 尚未完成

- 同盘不同有序历史的精确拒绝由公开 HTTP 覆盖；浏览器另覆盖同手不同路径及被取消前驱不入缓存，没有再复制一个同盘不同历史的完整 UI 场景。
- 新增时序矩阵覆盖的是依据 HTTP 成功/失败；分析流迟到成功由新测试门控覆盖，分析流迟到错误沿用既有 engine.spec 回归，没有新增分析流所有切换方式的笛卡尔积。
- 没有运行桌面打包/人工视觉、真实引擎搜索质量、真实模型教学或全部项目测试；这些不由本切片自动化证明。
- 主代理仍需独立复读、Spec/Standards 审查与最终验收；未置 done。16 不代表 05/08B、RAG、Skill、连续聊天或在线教练完成。
