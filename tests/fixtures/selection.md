# 04：精选样例与候选输入

来源为 `.scratch/go-coach/04-design.md` 的独立手算。主代理在实施期间通知：C/D经过独立Spec核验，可以使用。预期不由应用规则算法生成。均19路、Chinese、7.5、UTF-8、合成赛后记录，不是野狐/真人棋谱。

## C `manual-mixed.sgf`

setup黑ba/gh/gj/lm/nm/ml/qs/rr/sq，白aa/mm/ss，白先。
完整实战 W ab、B gi、W dd、B mn、W ee、B rs、W ff、B sr、W pp。

- step0白aa唯一气ab；W ab后白aa/ab两气bb/ac。不是已经活棋。
- step1黑gh/gj分离。B gi连接后八气fh/hh/gg/fi/hi/fj/hj/gk。
- step3白mm仅气mn（lm/nm/ml均黑）。B mn提mm，新增黑俘虏1。
- step5白ss两气rs/sr。B rs后剩sr；W sr自杀，堵截黑链有至少两气，一手不能移除；其余合法白着及pass后B sr提ss。应用仍完整枚举，不依据这段文案跳过任何合法应手。
- 资源故意先列三手强制证明，再连接、吃子、危险棋子。真实排序选救棋、吃子、连接（三手证明复杂性在后）。测试将三手候选设为最大模拟损失，仍不能挤掉三项一手基础事实。

## D `manual-force.sgf`

setup黑ca/bb/ac、白aa、黑先；完整 B ba、W ss、B ab、W rr。
B ba后目标aa仅气ab；黑ba/ca/bb有外围气，黑ac只有bc/ad两气，**不是三气**。
W ab自杀；其他合法白应手无法一手提黑堵截链，固定B ab提aa。
对称首手B ab时，黑ca仅da/cb两气；固定第三手B ba也成立。
真实文件默认教学ba、模拟引擎ab，分别核验全部应手，首手盘仍保留白aa。

## 反例与补充手算

- C step0 W bb、B pass、W ca确能提ba，但B ca可延伸到da/cb，固定W ca此时占点。因此单条pass变化不是强制证明；该候选不能入选。
- D去掉黑ac：W ab可逃。这个修改后的完整文件不再匹配D公开源，应用明确无示例分析，不套原D题。
- C step1另有B ll可连接黑lm/ml，连接后气kl/lk/km/ln/nl/mk。但若同题另一推荐B gi涉及gh/gj，合计四条原链，超过每题两链，拒绝。
- 错气、错提子点、重复同一链伪称两链、无法解除一气、错目标或第三手等均不能入选。

## 外部候选格式

C/D `public/analysis/*.json` 为受控adapter输入，不是最终选择：

- `context`: `source`、`rules`、数值`komi`/`handicap`、`initialPlayer`、setup `black`/`white`坐标集合、完整顺序`moves`（例如`W ab`）。HA未记录与0同作无让子，姓名/结果文字/评论不参与。
- `candidates`: 最多32项；`id`（稳定排序）、`step`（必须有实战下一手）、`player`、`kind`（rescue/connect/capture/force）、`teaching`/`engine`、`evidence`。
- 每个不同推荐恰一条证据：`move`、`targets`（每条原链的完整`stones`与`liberties`）、`captured`。
  rescue/connect还须`afterLiberties`精确匹配真实后盘；force的`captured`为要提净的原目标，并须`third`固定第三手。
- 一气提子验证实际移除与俘虏增量；救棋/连接验证所有原目标子仍属于同一己链且至少两气。
- force首手须尚未提子；每个对方合法着及pass后，第三手合法且原目标全部消失。全盘合法应手由真实棋规和原局前缀判断，不接收服务提供的应手列表或结论文字。
- 两类推荐的原目标并集最多2链/6子。预算4096按本次分析所有三手证明累计首手、应手、第三手的落子验证。耗尽保留已经核验的课程，同时明确部分候选未完整核验。

A/B旧格式只用于adapter兼容固定公开源，不能绕过真实候选证据验证。所有课程最终使用相同Lesson/教学/变化路径。浏览器测试只替换这些HTTP输入，不mock最终课程、棋规或校验。
