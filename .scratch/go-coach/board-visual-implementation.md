# 清爽木质棋盘实施记录

本记录仅交付实现与验证证据，独立审查、整合和视觉最终验收由主代理组织；未改任务完成状态。

## 接续与范围

- 从旧代理中断的原worktree接续，保留全部未提交改动：`C:/Users/789/AppData/Local/Temp/pi-agent-0a7626ad-5cfc-43a-eee9d47c`。
- detached `680c971` 上创建 `implement/wooden-board`；验证前 fast-forward merge `integration/go-coach` 的 `436f924` 设计澄清。
- `src/GoBoard.tsx` 仅呈现Frame、可选落子回调/预览方/教学标记，业务和棋规留在四调用者。
- SVG19横竖连续线、九星、四边SGF a–s坐标；CSS浅木色、圆形渐变石子、最近手小环、空点预览、键盘焦点与框标。
- SVG与HTML点位使用同一21单位方形，交叉点中心1.5…19.5；装饰aria-hidden且不拦点击；回放点仍为img，交互仍为button，不禁用占点。
- 教学previewPlayer固定原教学起点，连续变化/引擎用当前Frame。起始/Pass不显示最近手。
- 630px上限、窄容器保持方形；容器≤450px坐标提高到.6 SVG单位，修复390截图中小字问题。
- 服务器仅browserFiles追加GoBoard.tsx；无协议、参数、棋规、新依赖或外部资源变化。README提示需用户自行重启dev，不触碰其5173。

## 测试事实（实际浏览器最高seam）

- 接续资料记载旧代理回放切片先RED再GREEN；教学原RED为缺少`.preview.B`，其最后CSS编辑后未跑GREEN。本代理不把此阶段描述为已经通过。
- 本代理首次恢复：回放通过，教学焦点断言失败。原因是鼠标模式下程序focus不触发focus-visible；改为真实Tab/Shift+Tab后两条通过，没有为此扩大CSS焦点语义。
- 新补角/中点几何测试最初因点击后页面滚动和错误文本改变布局导致旧位置比较失败；先完成全盘几何比较再点击后通过。这是测试修正，不冒充产品RED。
- 新增可控引擎预览、占点反馈、重复教学试下、桌面宽度和只读点击等首跑通过，记为回归，非全部RED驱动。
- 预览非合法性说明：先测试缺文案RED，增加共享说明后GREEN。
- 390坐标可读性：渲染文字bbox高度7px低于9px门槛RED，窄容器字号增大后GREEN，并实际读图确认。
- 新增共4条：回放/最近手/只读；教学原执棋方重试、目标捕后保留/推荐/气、键盘、连续双方/pass撤回；390方正、四角中心几何与点击；可控引擎黑白预览不请求不改状态、Enter落子、pass撤回重走。
- 完整回归首轮：旧4个文件的隐私测试把5173写死，独立5189服务被误拦；另总命令180秒上限中断长测试。未弱化断言或改旧测试。
- 仅临时复制这4个文件并替换`127.0.0.1:5173`为`127.0.0.1:5189`，原测试文件不变，其余断言逐字不变；配置排除原文件避免重复。全套 **96 passed，2.7m，0 skipped**（旧92＋新增4）。临时副本已删除、不提交。
- 合并436f924后 `npm.cmd run typecheck`、`npm.cmd run build`、`git diff --check`通过。
- 全套后只调整引擎截图前移开鼠标，避免自动滚动让hover预览另落一点；引擎新增测试再跑1 passed，无产品代码变化。

## 复跑（不要停用用户5173）

在待验worktree根目录操作，先确认5189空闲。创建临时 `playwright.visual.config.ts`（不提交）：

```ts
import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,
 testIgnore:['**/import.spec.ts','**/guided.spec.ts','**/selection.spec.ts','**/variations.spec.ts'],
 use:{...config.use,baseURL:'http://127.0.0.1:5189'},
 webServer:{command:'npm.cmd run build:server && node .server/index.js --port 5189',url:'http://127.0.0.1:5189',reuseExistingServer:false}
});
```

生成仅端口不同的临时副本（Node命令，可在PowerShell运行）：

```powershell
node --input-type=module -e "import fs from 'node:fs'; for(const n of ['import','guided','selection','variations']) fs.writeFileSync('tests/'+n+'.visual-port.spec.ts',fs.readFileSync('tests/'+n+'.spec.ts','utf8').replaceAll('127.0.0.1:5173','127.0.0.1:5189'));"
npm.cmd run typecheck
npm.cmd run build
npx.cmd playwright test --config playwright.visual.config.ts --workers=4
# 外层命令超时至少360秒，保留原2000帧测试本身180秒预算
Remove-Item tests/import.visual-port.spec.ts,tests/guided.visual-port.spec.ts,tests/selection.visual-port.spec.ts,tests/variations.visual-port.spec.ts
```

截图可单独跑新增4条，不需旧测试副本：

```powershell
$env:BOARD_SCREENSHOTS='D:/code/tmp/go-coach-notes/board-visual'
npx.cmd playwright test tests/board-visual.spec.ts tests/board-engine-visual.spec.ts --config playwright.visual.config.ts
Remove-Item Env:BOARD_SCREENSHOTS
# 最后删除临时配置
Remove-Item playwright.visual.config.ts
```

服务由Playwright webServer和既有engine-fixture管理自有进程；测试后5189无监听，无该worktree残留Node命令。未手工杀任何其他服务，5173未操作。无真实GPU/KataGo实测。

## 截图与实际观察

目录 `D:/code/tmp/go-coach-notes/board-visual/`，不进Git：

- `replay-desktop.png`：630px浅木色，aa/ss边角石子完整，jj小环。
- `teaching-hint.png`、`teaching-focus-preview.png`：目标白子内小环、红框、气虚线及dd黑色焦点预览可区分。
- `teaching-capture-recommendation.png`：捕后aa空目标框、ab推荐框/黑子/小环同时可见。
- `continuous-preview.png`：dd黑子后，ss白色键盘预览。
- `controlled-engine-B-preview.png`、`controlled-engine-W-preview.png`：显式“可控测试引擎（非真实KataGo）”，分别黑/白预览，不冒充真实引擎验收。
- `narrow-390.png`：390视口内342px棋盘，四角石子无裁切，坐标放大后实看可辨，无棋盘水平溢出。
- `comparison-board-desktop.png`、`comparison-page-desktop.png`：主代理`main-before/case.sgf`同一九着＋pass局面，方便前后对比。

已用read实际查看上述截图，不仅检查CSS值或文件存在。初版窄屏坐标过小、截图自动滚动使鼠标悬停移位的问题均经读图发现并修正。桌面线条连续且较细、棋子明显黑白/中心对齐，框不遮子；小屏坐标仍比桌面小，342px下19路点击格天然约16px，未宣称手机触控体验或跨浏览器无障碍认证。引擎长profile文字的原有溢出不属棋盘布局，本次未顺带改整页。用户最终审美反馈仍待主代理确认。
