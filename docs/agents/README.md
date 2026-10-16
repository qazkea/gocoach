# Gameplay AI 工作流

**第一次使用请先看：[中文上手指南](./中文上手指南.md)**。按真实开发顺序说明每一步输入什么、AI 会做什么，以及何时需要你确认。

## 开始使用

在此目录启动新的 Pi 会话：

```powershell
cd D:\code\tmp\gameplay
pi
```

按需授予项目配置信任，让项目技能和设置生效。
在 `/agents` 的 Agent types 中确认 implementer 和 reviewer；
主模型应为 openai-codex/gpt-6-astra，high，子代理均为 medium。

当前配置只安装技能与角色，不包含游戏代码，不初始化 Git。

## 常用命令

```text
/skill:grill-with-docs 我想做一个……，先讨论需求，不要实现。
/skill:to-spec
/skill:to-tickets
/skill:implement .scratch/<功能名>/issues/01-xxx.md
/skill:retro
```

需求澄清、规格和任务在主会话进行；具体编码与审查由主代理按 pi-workflow.md 委派。
首次使用不用再运行 setup：本地任务系统、默认标签和单领域约定已落地；
以后切换任务系统时才按需运行 `/skill:setup-matt-pocock-skills`。

## 来源

- 上游：https://github.com/mattpocock/skills
- 版本：49dd158d1076134a641b33efb035946536778336
- 安装内容：engineering 与 productivity 下的 27 个技能，连同各自的引用和支持文件。
- 安装方式：实际目录复制，不使用符号链接；未运行技能附带脚本。
- 许可证：`.pi/skills/MATT-POCOCK-LICENSE.txt`。
- 不复制上游仓库的 AGENTS.md/CLAUDE.md；它们用于开发技能仓库本身。
- 上游 SKILL.md 未修改；本项目适配集中在 pi-workflow.md、agent 定义及配置文档中。
- 更新时用审核过的新版本替换技能目录，并核验依赖与项目适配；本副本不自动更新。
