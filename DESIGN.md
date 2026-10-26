---
name: Go Coach
description: 明亮棋馆中的中文赛后复盘工具
colors:
  accent: "#23756c"
  workspace: "#e9efed"
  reading: "#fff"
  ink: "#263b3d"
  muted: "#526765"
  line: "#cbd7d3"
  board-surround: "#dfe7e3"
  sand-board: "#d8c7a6"
  quiet-surface: "#fafcfb"
  hover: "#edf5f2"
  pressed: "#d5e8df"
  selected: "#e2f0eb"
  selected-ink: "#195b53"
typography:
  body:
    fontFamily: '"Microsoft YaHei UI","Microsoft YaHei","Segoe UI",sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  title:
    fontFamily: '"Microsoft YaHei UI","Microsoft YaHei","Segoe UI",sans-serif'
    fontSize: "1.3rem"
    fontWeight: 700
    lineHeight: 1.4
  section-title:
    fontFamily: '"Microsoft YaHei UI","Microsoft YaHei","Segoe UI",sans-serif'
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 1.4
  subheading:
    fontFamily: '"Microsoft YaHei UI","Microsoft YaHei","Segoe UI",sans-serif'
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.4
  label:
    fontFamily: '"Microsoft YaHei UI","Microsoft YaHei","Segoe UI",sans-serif'
    fontSize: ".85rem"
    lineHeight: 1.6
rounded:
  control: "4px"
spacing:
  compact: "4px"
  small: "8px"
  control: "12px"
  section: "16px"
  column: "24px"
components:
  button:
    backgroundColor: "{colors.reading}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "5px 12px"
    typography: "{typography.body}"
  button-hover:
    backgroundColor: "{colors.hover}"
  button-active:
    backgroundColor: "{colors.pressed}"
  button-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.selected-ink}"
  draft-input:
    backgroundColor: "{colors.reading}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px"
    height: "76px"
    width: "100%"
  context-tag:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.accent}"
    padding: "2px 8px"
    typography: "{typography.label}"
  reading-panel:
    backgroundColor: "{colors.reading}"
  details-panel:
    backgroundColor: "{colors.quiet-surface}"
---

# Design System: Go Coach

## Overview

**Creative North Star: "明亮棋馆"**

浅灰青工作底承接淡砂棋盘与白色阅读面，青绿标明选中、上下文与键盘焦点。中文系统字体、紧凑轻控件和扁平层次服务赛后核对，不以厚木纹、大卡片或营销装饰制造气氛。

这是 Windows Electron 所承载 Web 界面的实际视觉记录，不是原生移动设计，也不是未来聊天功能的提案。正文和标题都是实用工具排版，没有营销 display 字体角色。当前阅读面明确显示在线教练尚未启用，底部为草稿，不把静态消息当成已交付 AI 对话。

**Key Characteristics:**
- 浅灰青、淡砂、白与青绿组成日光下的工作界面。
- 小圆角控件、直角面板和细分隔线形成克制层次。
- 紧凑操作区与宽松阅读区并置，局面上下文始终可辨。

记录依据：提交 `1d778f89ff9e46bdab81958ef07b764e0ed22392` 的 `src/style.css`、`src/main.tsx`、`src/GoBoard.tsx`、`src/FullGameReview.tsx`、`src/EnginePanel.tsx`；抽样读取实际网页宽屏、窄屏未知状态及打包桌面窄窗草稿截图。产品仅采纳 `PRODUCT.md` 中中文、赛后学习及 Go Coach 品牌事实；surface brief 的后续会话、聊天和资料功能不作为实现证据。

主代理提供的独立视觉最终 verdict 为 `bbd14351-0e70-4a1`：补读未知状态图后 remaining clear、disposition ship。本记录不复述为全站 QUALITY BAR、教学安全或完整业务验收；桌面整包回归由主代理另行验收。

## Colors

主色青绿强调可操作状态；中性色保留棋盘材料与阅读面之间的温度差。规范数值只在 frontmatter 定义；下列名称对应其键。

### Primary
- **青绿（accent）**：选中边线、键盘焦点、走势线和当前原谱定位标记。
- **轻青绿（hover / pressed / selected）**：分别承接悬停、按下、语义选中；selected-ink 承接选中文字及空点标记。

### Neutral
- **浅灰青（workspace / board-surround）**：应用工作底与盘外托底。
- **淡砂（sand-board）**：纯色棋盘，不叠木纹图。
- **白阅读面（reading）与淡白辅面（quiet-surface）**：操作条、阅读主体、输入及详情/草稿背景。
- **深灰青（ink）与次级灰青（muted）**：正文与解释说明；line 用于边框和分隔。

**The 状态可辨 Rule.** 选中、悬停与按下不是同一个状态；青绿状态配合文字、ARIA 状态或定位形状，而不单靠颜色传意。

## Typography

字体使用 frontmatter 的中文系统栈。body 是根字号；标题按根字号计算为 18.2 / 16.1 / 14.7px，没有人为补齐的等比营销字阶。主标题在最窄断点降到 1.1rem，整局复盘标题覆盖为 1rem。

辅助标签多用 .85rem；局面/回放说明可用 .9rem。正文默认行高 1.6，阅读面段落行高 1.9、最大宽度 70ch、段间垂直 margin 18px。走势当前值采用 tabular-nums，图表标签行高 1.5。SVG 棋盘坐标独立使用 system-ui，不是另一套品牌字体。

**The 工具正文 Rule.** 标题靠字号与字重建立层级，系统字体用于中文工具的 body/title，不新增 display、装饰等宽或字形图标角色。

## Layout

现有工作台使用 `100dvh` 高度、360px 最小高度的纵向外壳；宽屏外边距为左右 24px、底部 16px。页头最小高 64px，状态条最小高 34px。主工作区采用 `minmax(0,3fr) minmax(340px,2fr)`，栏间距 24px；左区可滚动，右区为独立 flex 阅读面，阅读内容滚动而草稿停留在面板底部。

在 `max-width:1099px` 切换为棋盘/教练标签，一次显示一个工作区，不把当前工作台改成上下长页；外壳左右及底部缩为 12px。在 `max-width:520px` 导入控件另起行，操作与回放 padding 收到 6px、盘外 padding 收到 4px。它们是当前工作台断点，不是所有未来页面的强制布局。

棋盘为正方形、居中、按容器宽和可用视高收缩。常规宽度为 `min(100%,max(280px,calc(100dvh - 370px)),600px)`；对照模式减去 440px，试下模式减去 500px 且上限 580px；窄屏基础规则减去 390px 且上限 580px。容器宽不超过 450px 时提高 SVG 坐标字号。

操作条常用 8px 12px padding，按钮间距 8px；阅读区使用 30px 24px padding，窄窗为 24px 20px。紧凑走势高 46px，最小宽 160px（最窄断点 120px）；详情按需展开，逐手列表最高 220px 后滚动。

## Elevation & Depth

默认扁平，以底色变化和 1px 边线分层，不给每个面板加阴影。仅信息浮层使用柔和投影 `0 8px 24px #263b3d20`，棋子使用 `0 1px 2px #263b3d40` 帮助从盘面辨认；预览棋子去掉阴影。棋盘焦点的白色外圈是对比辅助，不是装饰光晕。

**The 扁平工作面 Rule.** 面板用色面和细线组织，只有真实浮层与棋子采用现有柔影，不把浮层阴影复制成大卡片语言。

没有作者定义的动画或 transition；状态即时变化。reduced-motion 规则将 scroll-behavior 设为 auto，不据此虚构入场动画。

## Shapes

按钮和草稿输入共享小圆角；面板、操作条、盘面均为直角。棋子、末手环和棋盘字母/编号注记为圆形，属于棋盘表达，不扩张为通用胶囊样式。边线为轻量结构线，文字标签是带细边的矩形，不是可点击 chip 的假象。

## Components

### Buttons

轻控件而非实心主 CTA。白底细边、小圆角、5px 12px padding；hover 和 active 使用各自浅青底。禁用态使用 `#64716e` 文字、`#edf0ee` 底和默认光标。语义选中使用 accent 边线及 selected 色面。全局焦点为 2px accent outline、3px offset。透明教学/场景入口是轻量次级按钮，不新增独立实心按钮体系。

### Chips

当前上下文标签用 accent 字色、hover 底色、`#c5dcd5` 细边、2px 8px padding。它是原谱手数/未导入状态的静态标签，没有虚构点击、hover 或 selected 交互。

### Cards / Containers

白阅读面以细边围合；标题区 padding 18px 22px、下边线与内容分开。详情使用 quiet-surface 与上边线；summary 为 600 字重、7px 10px padding，悬停浅青、键盘焦点沿用全局规则，展开后增加下边线。没有嵌套装饰卡片体系。

### Inputs / Fields

草稿为白底，边线 `#a6b9b3`，10px padding，小圆角；高 76px、最小 52px、最大 180px，可纵向 resize。placeholder 使用 muted，caret 使用 accent，键盘 focus-visible 沿用全局 outline。没有源代码定义的 hover 色变，不补造。草稿容器 padding 16px 20px，最窄窗口为 12px；辅助说明不冒充发送按钮。

### Navigation

回放是文字按钮组，当前不可执行的首尾动作禁用。窄窗工作区标签均分宽度、间隔 8px，通过 aria-selected 显示选中；逐手定位使用 aria-current=step 的同一状态语言。标签、回放与详情焦点均有明确 outline。

### Board & Trend

React / SVG / CSS 绘制 19 路棋盘，无 shipping raster。网格、星位与四边坐标来自同一个 21 单位方形；棋子占交叉点单元的 88%。试下 hover/focus 预览透明度 .42，实际落子合法性不由预览保证。S/A 或编号注记与相应文字互定位；有注记时隐藏末手环，避免叠印。这些是棋盘专属语义，不是全局页面编号规则。

走势在常驻区域显示“黑方胜率”、当前原谱手数与值；未知值明确写“未知”，未知段不连线。当前位置为三角形加竖向虚线，而非伪造一个估值点。面板错误使用 role=alert 的浅红底和深红文字；等待、失败、未启用等说明保留实义，不以装饰替代内容。

## Do's and Don'ts

### Do:
- **Do** 使用青绿状态、细边与文字共同表达当前上下文。
- **Do** 保留紧凑操作与宽松阅读的密度差，扩展时复用现有控件状态。
- **Do** 从实际 React/SVG/CSS 取材，保持未知、失败与未启用状态可辨。

### Don't:
- **Don't** 回到厚木纹、大阴影卡片或营销 display 排版。
- **Don't** 把棋盘步骤语义、当前聊天未启用或本工作台双栏写成全局产品禁令。
- **Don't** 把审查截图、静态提案或 sidecar 派生色阶作为生产资产或新增色 token。

本次未发现需新增 canonize 的视觉缺陷；原生文件选择与 checkbox 的平台外观是现存未统一细节，不升级为品牌组件规范。sidecar 色阶仅是预览派生元数据，primitives 仅由本 frontmatter 持有；sidecar 不属于客户端 bundle。本记录不改任务状态、不宣称完整业务验收。
