# Go Coach · 围棋复盘教练

面向 Windows 的本地赛后复盘工作台：读入 SGF，在同一棋盘回放、对照推荐与自由试下。
目标是围绕棋盘连续中文交流；目前在线教练和会话存档尚未接入，草稿不保存、不发送，无需真实 Key。

## 当前能做什么

- **19 路 SGF 回放**：逐手浏览棋盘、提子与原谱信息。
- **本地 KataGo 分析**：整盘扫描、黑方胜率走势、候选与本手讲解依据。
- **同起点对照**：单盘标记实战 S / 推荐 A，独立展开经合法性核验的推荐变化（PV）。
- **自由试下**：从当前显示局面继续行棋，支持 Pass、撤回改下与返回原谱。
- **适应窗口大小**：宽屏双栏，窄窗通过“棋盘 / 教练”标签切换。

候选、估值与推荐变化需自行配置本地引擎；未配置也能回放。
另有四份合成棋谱的预设教学示例，不是真实 AI 教学。

## 快速开始

### Windows 桌面（推荐）

目前提供源码，尚无已发布的预构建下载包。构建需要 Git、Node 24 / npm 11：

```powershell
git clone https://github.com/qazkea/gocoach.git
cd gocoach
npm.cmd ci
npm.cmd run desktop:pack
```

打包完成后，双击 `desktop-release/win-unpacked/Go Coach.exe`。
**整个 `win-unpacked` 目录必须一起保留或移动，不能只拷贝 exe。**
运行该目录包无需另外安装 Node；包未签名，可能出现 SmartScreen / 安全软件提示，不建议关闭安全保护。

打开后选择 [`tests/fixtures/manual-finished.sgf`](tests/fixtures/manual-finished.sgf) 快速体验回放。
需要分析时，按[使用指南](docs/usage.md)配置本地 KataGo；应用不会自动下载引擎或模型。

### 浏览器预览

完成上述依赖安装后，在项目目录运行：

```powershell
npm.cmd run dev
```

访问 <http://127.0.0.1:5173>。若端口已占用，选择空闲端口，例如：

```powershell
npm.cmd run dev -- --port 5174
```

随后访问对应端口；不要停止他人已有服务。浏览器引擎配置见[使用指南](docs/usage.md)。

## 开发与测试

启动应用不需要安装 Playwright 浏览器。自动化测试请用未设置真实引擎配置的终端，并准备 Chromium：

```powershell
npx.cmd playwright install chromium
npm.cmd run typecheck
npm.cmd run build
# 先确认 5200 端口空闲；浏览器测试不会复用现有服务
$env:GO_COACH_TEST_PORT='5200'
npm.cmd test
npm.cmd run test:desktop
```

`test:desktop` 会先重建 Windows 目录包，再运行桌面测试。
Windows 测试另需系统已有的 .NET Framework 编译器，见[开发测试说明](docs/usage.md#7-开发测试)。

## 使用边界

仅用于已结束对局，不提供实时辅助。棋规校验是有限子集，不是完整裁判，也未核验野狐导出兼容。
引擎估值不是棋理原因，PV 不是必然结局；当前不向在线模型发送内容。

## 更多文档

- [使用、引擎配置与 SGF 限制](docs/usage.md)
- [界面设计规范](DESIGN.md)
- [实施规划](.scratch/go-coach/implementation-plan.md) · [当前工作台验收记录](.scratch/go-coach/17-main-acceptance.md)
