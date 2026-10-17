# 14：Windows桌面运行与免安装目录包

**Parent:** 围棋赛后复盘教练；desktop-review-scope.md

**Category:** enhancement

**Status:** ready-for-agent

**Execution:** in-progress

**Blocked by:** 13（已验收完成）；Electron/打包工具项目本地安装许可（已取得）。不依赖真实DeepSeek调用授权。

## What to build

按[14-design.md](../14-design.md)使用Electron44.8.0和electron-builder26.15.3提供Windows x64免安装目录包，用户双击exe即可使用现有整局复盘。原生菜单选择已有KataGo配置，窗口及自有服务/引擎生命周期由应用管理；无需终端、独立Node或重新下载模型。

## Acceptance criteria

- [ ] 精确版本依赖、可复现build/打包scripts及产物白名单；不签名、不发布、不改系统驱动或全局组件。
- [ ] 实际打包exe从非项目cwd及移动后的中文/空格目录启动，生产资源绝对定位，无Vite/外部Node要求。
- [ ] 原生选择/确认配置，取消或无效不损坏现状，userData记录并正确恢复/检查变更，原operator JSON不变；桌面dataDir独立且不收集私人棋谱日志。
- [ ] 真实桌面窗口可导入、默认N+1扫描、逐手查看及使用已有木质棋盘；未接入的中文讲解仍诚实显示未启用。
- [ ] 限制renderer权限、导航/新窗与CSP，保留同源HTTP安全，不暴露任意执行/文件/环境接口。
- [ ] 启动途中退出、分析中关窗、失败/受控桥故障正确清理自有进程；不影响用户5173，未覆盖的硬杀/系统关机限制明确。
- [ ] 桌面真实exe完整流程测试（只控制外部引擎或平台dialog等I/O）、旧110网页回归、typecheck/build、实际截图与清理证据、独立Spec/Standards审查及主代理整合验收。

## Comments

本票不等于DeepSeek讲解、紧凑桌面UI、签名安装器或跨机器通用分发已经完成。完整目录包必须一起保存，不能只移动exe。任何新增系统组件需求需先报告；不得自动读取密钥/证书或进行在线AI调用。
