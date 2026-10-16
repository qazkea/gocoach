# 任务02实施记录（待主代理独立审查验收）

## 工作边界

在隔离 worktree `C:/Users/789/AppData/Local/Temp/pi-agent-decea513-3d45-439-b35059a1` 实施。
基线 `1a2c42c455ad8834b7f7718bead2b7cad1166fbd` 为 HEAD/祖先；未 reset、未改主工作区、未推送。
完整读取02任务含Comments、02-design、父spec、GLOSSARY、工作流、README、01代码/测试/fixtures；
技能从主工作区绝对路径只读，未复制技能。测试 seam 为获批的 Playwright 完整浏览器流程。

## 实现

- replay 的私有落子计算由导入和一手试下共用；Frame 明确 nextPlayer，试下复制盘面与俘虏，携带截至当前帧的全部历史。
  保留占点、自杀、先提敌、简单劫、长循环不支持以及输入/编码保护。导入继续缓存历史键和 Set，不逐手重新编码全部历史。
- teaching module 精确匹配空初盘/初始行棋方、规则、贴目、让子及完整落子序列；名字/描述不参与。
  同源静态 adapter 仅读取公开示例ID；响应 position、候选、白目标链、唯一气、实际被提点及俘虏变化全部核对。
  固定课程只接受已独立核验的 ab/rs 局部性质，不信任响应中的任意棋理。
- 独立教学区域提供先试下、提示、答案、实战/两类推荐比较和失败重试；每次均从指定原局面重新试一手。
  目标/气/推荐有颜色框及可见坐标；每点按钮可用键盘，名称含坐标和黑/白/空。过期请求在卸载后不更新。
- A/B同异推荐、手算来源、非真实引擎/AI、排序不证明更优等边界在界面和README说明。
  新B完整SGF及独立核验见 `tests/fixtures/guided-positions.md`。

## 实际 RED → GREEN

逐条新增行为测试，再运行对应测试确认真实失败，随后实现该切片并运行已累计教学测试。
命令形式：`npx.cmd playwright test tests/guided.spec.ts -g <用例关键字> --workers=1`；
GREEN累计使用 `npx.cmd playwright test tests/guided.spec.ts --workers=1`。

| 顺序 | 行为 | 实际RED | 实现后的GREEN累计 |
|---|---|---|---|
| 1 | A等待后试下提子、原谱不变 | 找不到进入教学按钮 | 1 passed |
| 2 | 提示继续、占点、其他合法手、键盘 | 找不到请求提示按钮 | 2 passed |
| 3 | A直接答案/两推荐相同 | 找不到直接答案按钮 | 3 passed |
| 4 | B两种推荐提子结果/实战切换 | B找不到进入教学按钮 | 4 passed |
| 5 | 缺失/错误位置/非法或不支持候选/错目标/错气/错提子/空响应 | 缺证据响应仍显示准备就绪 | 5 passed |
| 6 | 非匹配规则/贴目/初盘/初始行棋方/完整序列仅回放 | 没有无对应分析提示 | 6 passed |
| 7 | B右下比较标记及手算来源 | 没有合成样例B来源说明 | 7 passed |
| 8 | 外部503失败和重试恢复 | 找不到重试分析按钮 | 8 passed |
| 9 | 答案后非法试下不改证据、合法另试不冒充推荐 | 非法试下把模式改成试下结果 | 11 passed（含下述补充回归） |

两条补充浏览器回归（迟到成功/失败隔离；隐私出口与描述忽略匹配）利用此前已实现的保护，
首次即GREEN：累计10 passed。**不宣称这两条也经历功能缺失RED**；未为造RED删除正确代码。
它们不是内部单测，不调用window中的业务函数；只通过外部HTTP adapter控制和浏览器动作观察。

中间构建问题如实记录：第一轮实现曾因Windows模块文件Teaching/teaching仅大小写不同导致加载失败，
改名TeachingPanel后通过；第三轮曾遗漏JSX闭合，累计运行超时90秒，修正后3条通过。
这些不是业务RED证据，表中RED均在实现前独立观察到对应功能缺失/错误。

## 最终运行

- `npm.cmd ci`：成功，0 vulnerabilities；未新增依赖。
- `npx.cmd playwright test tests/import.spec.ts --workers=2`：原20条全部通过；未修改这些用例。
- 提交前 `git rev-parse integration/go-coach` 仍为 `1a2c42c...`；`git merge integration/go-coach`：Already up to date。
- `npm.cmd run typecheck`：通过。
- `npm.cmd run build`：通过，Vite 31 modules。
- `npm.cmd test`：**31 passed**（原20 + 新11），无失败/跳过。
- `git diff --check`：通过。

没有运行真实引擎、在线AI、付费服务或私人棋谱；没有教学效果/学习迁移、野狐兼容、生产性能证明。
未实现03多手变化、整盘精选、文字追问、练习、学习记录、后台。任务状态与checkbox未改，完成由主代理决定。
