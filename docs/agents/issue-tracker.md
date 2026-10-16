# 任务跟踪：本地 Markdown

本项目不使用远程任务系统。技能提到“发布到任务系统”时，写本地文件，不调用 GitHub/GitLab API。

## 路径约定

- 一个功能一个目录：`.scratch/<feature-slug>/`。
- 规格：`.scratch/<feature-slug>/spec.md`。
- 实施任务：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 01 编号，一个任务一个文件。
- 任务包含 Category（适用时）、Status、Blocked by 和可验证的验收标准。
- 评论与分诊说明追加在文件的 `## Comments` 下。
- 标签映射见 `triage-labels.md`。外部反馈用 triage；to-tickets 生成的任务无需再次分诊。

## 读取与完成

引用任务路径时读取完整文件和评论。编号不明确时先澄清，不猜测。
只有依赖完成的任务才能进入实施；ready-for-agent 不代表所有依赖已解除。

项目本地执行约定（补充 Matt 的分诊状态，不改变其五状态映射）：
使用独立的 `Execution: pending | in-progress | blocked | done` 字段记录执行进度。
主代理在验证和审查完成后设置 Execution: done，并附验证证据。
选择待办时排除 Execution: done；不要再次派发已完成任务。
本地完成不要求创建 PR、推送或操作远程服务。

## Wayfinder

- 地图：`.scratch/<effort>/map.md`。
- 子任务：`.scratch/<effort>/issues/NN-<slug>.md`。
- Type: research / prototype / grilling / task。
- 地图子任务按 wayfinder 约定使用 Status: claimed / resolved；不要与 triage 的分诊状态混用。
- Blocked by 记录依赖；只认领未解决且依赖已解决的任务。
- 解决后把结论与上下文指针追加到地图。
