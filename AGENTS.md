# Gameplay

## Agent 技能

### 任务跟踪

需求规格和任务以本地 Markdown 文件保存在 `.scratch/`。
执行相关技能前读取 `docs/agents/issue-tracker.md`。

### 任务分类标签

使用 Matt 工作流的默认分诊状态和 bug / enhancement 分类。
映射见 `docs/agents/triage-labels.md`。

### 领域文档

采用单领域布局：根目录 `GLOSSARY.md` 和 `docs/adr/`。
探索或记录领域知识前读取 `docs/agents/domain.md`。

## Pi 项目适配（非 Matt 原版）

主代理负责规划和验收；实现委派给 `implementer`，审查委派给 `reviewer`。
使用技能或委派前读取 `docs/agents/pi-workflow.md`，遵循其中的 Pi 调用及分工约定。
