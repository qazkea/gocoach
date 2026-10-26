# 17 单棋盘工作台实施交接记录

Execution: in-progress（实现交回主代理，未独立审查/验收，不关闭任务）

## 接续与提交

唯一写入工作树：`C:/Users/789/AppData/Local/Temp/pi-agent-7ec2fc37-62c9-470-22e31f67`；分支 `implement/17-single-board`。接手 HEAD 为 `80f4de9c43c8d131d880427db5040390713c3546`，24份既有源码/测试改动保留，没有重写、reset或clean。

- `7ba5b44`：先保存上述24份改动的安全WIP checkpoint。
- `7205558`：接续全量回归发现默认720px高窗口棋盘仅340px，既有断言要求至少350px；仅将原谱棋盘高度预算从减380px改为减370px，没有降低断言。
- `48ea3bf`：先提交自身变更，再合入 `integration/go-coach` 的 `3853e082a3d7a9b7a2e000b3d408abbba50baa36`。只带入21资料核查文档，无冲突；随后重跑构建、完整网页及重新打包桌面。

## 实施范围

保留旧代理完成的实现：`src/main.tsx` 明亮棋馆双栏/窄窗页签与独立教练草稿宿主；`EnginePanel.tsx` 单盘回放、同起点S/A、合法独立PV、自由试下与返回；`FullGameReview.tsx` render-children共享只读分析快照，扫描不随页签重挂；`ReviewEvidence.tsx`复用真实HTTP核验hook；`GoBoard.tsx`非落石标记；`TeachingPanel.tsx`独立预设教学入口；`style.css`布局/焦点/状态。

新增 `tests/workspace.spec.ts`、`tests/workspace-ui.ts`、`desktop-tests/workspace.spec.ts`；迁移既有入口/折叠定位器：tests下board-engine-visual、board-visual、engine、evidence、full-game、guided、import、selection、session-watch、variation-evidence、variations及scripted-engine；desktop-tests下config、evidence。未改棋规、引擎协议调度、凭据、CSP或依赖。

## 历史RED/GREEN与本次区别

旧证据原样保留于 `D:/code/tmp/go-coach-notes/17-implementation-80f4de9/implementer/`。核对日志可见：01单盘、02同起点、03 PV、04试下、05页签草稿、06过期拒绝各有失败与后续通过。03-green.log本身仍为3失败，实际后续通过在03-green-final.log。07-red和07-green均失败：旧测试曾错误期待空候选成功，而真实协议拒绝noResults；现测试尊重既有协议，检查失败可见且不造A。不能仅凭文件名称07已经GREEN。

旧desktop-1.log为57 passed；旧web-final未确认最终汇总，不作为本次完整回归证据。白方PV、迟到核验、低矮放大等接手时已写好，本次只实际回归，不能追称本次逐项RED。

本次真实RED为web-1.log：158 passed、1 failed，默认回放棋盘宽340低于既有350断言。最小CSS修复后targeted-green.log为17 passed，测试断言未改。

## 接续实际命令与结果

所有shell先Set-Location到唯一工作树。新证据根目录：`D:/code/tmp/go-coach-notes/17-implementation-80f4de9/recovery/`。

| 命令 | 结果 | 日志 |
| --- | --- | --- |
| npm.cmd run build | exit 0 | build-1.log |
| GO_COACH_TEST_PORT=5199; npm.cmd test -- --workers=2 | exit 1，158通过/1失败 | web-1.log |
| npm.cmd test -- tests/board-visual.spec.ts tests/workspace.spec.ts --workers=2 | exit 0，17通过 | targeted-green.log |
| 合入integration后 npm.cmd run build | exit 0 | build-final.log |
| GO_COACH_TEST_PORT=5199; npm.cmd test -- --workers=2 | exit 0，159通过，0失败/跳过 | web-final.log |
| npm.cmd run test:desktop | exit 0，新构建并打包exe，57通过，0失败/跳过 | desktop-final.log |
| 主目录技能 scripts/impeccable.cmd detect --json <本工作树>/src/ | exit 0，输出[] | detector.json |

网页真实浏览器与HTTP，桌面真实新打包exe；仅既有外部引擎与平台I/O替身，合成谱、隔离userData，凭据回归仅用测试合成Key。未读真实Key/私谱、未真实推理/embedding/GPU；未触碰5173，无push/发布。构建打包可取得既有资源，不宣称全过程零网络。5199启动前无监听，未杀未知进程。

## 截图实际核对

设置WORKSPACE_SCREENSHOTS到recovery/visual-final，完整网页回归生成并逐张打开核对11张：workspace-1440x900、workspace-1280x900、workspace-920x720、workspace-390x844；coach-920x720、coach-390x844；comparison、pv、trial、details-focus、import-error（均.png）。

实际看到：浅灰青工作底、淡砂棋盘、白色教练面；宽窗双栏、窄窗页签；回放与紧凑走势、草稿可达；S/A为落子前标记，PV显示编号、试下显示不同来源；详情焦点环可见，详情在左区内部滚动时棋盘移出可见区，右侧输入位置不动；导入错误置于上方并显示空导入说明，没有假AI回复或假发送。对照主目录daylight.png/html核对了构图，没有照搬示例棋序或假聊天。

另逐张打开新exe的 `recovery/desktop/真实打包工作台单盘对照试下返回与窄窗草稿/` 中 comparison、narrow-coach、narrow-trial、returned：单盘、窄窗保留草稿/试下、返回原谱可见。桌面初始外窗1280×900对应内容截图1264×835，不冒称为网页1280×900内容区。窄窗试下底部可内部滚动，不声称全部详情首屏同显。

这是实现者核对，不是独立视觉验收。detector无发现不证明所有对比度/可访问性或棋理正确。

## 未覆盖与交回

- 独立Spec/Standards、独立视觉审查、主代理整合复测尚未进行，任务保持in-progress。
- DESIGN.md与sidecar按约定留给最终独立视觉验收后的documenter，未预写。
- 本次尺寸/状态截图齐备；低矮1280×600、920×480与20px根字体由真实UI测试覆盖，但未另存截图；不是操作系统DPI/浏览器全倍率缩放矩阵。
- 真正长聊天、消息滚动/队列/持久化与模型输出由18/19等后续票验收，本票只有不保存、不发送的草稿及诚实未启用说明。
- 真实引擎质量、教学棋理、野狐兼容性、真实GPU和真人学习效果未测，不作完成声明。
