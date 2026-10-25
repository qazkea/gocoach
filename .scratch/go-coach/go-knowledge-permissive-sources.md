# 首批文字 RAG：宽松权利来源有界核查

## 结论

本轮上限三个新候选，实际只核查 **Arthur Smith《The Game of Go》（1908）一个**，不凑数、不作穷尽搜索。结论为**条件候选，优先继续核验，但不能据此解除21阻塞**：原文公版路径比现有 AdamR 的 CC BY-NC 4.0 更有希望兼容商业分发及模型上下文使用；主代理随后已通过LoC该书书目补上作者年份的一手佐证，地域适用、原文/中文内容及完整首包仍待核验。未核实到可直接批准的 CC0 或现代第一方宽松教程，也未获得覆盖四项概念的合格首包。

已读项目工作流、领域说明、GLOSSARY、旧候选、21及 spec 的资料/方法边界。仅研究公开书目、相关章节短段及条款；未下载整书/整仓、安装执行项目、启动代理、提交或接入业务，未访问 Key、私谱、聊天，未调用产品模型、embedding、GPU。只写本报告；引用不是批准教材或专家审校。

## 候选证据与权利范围

**版本。** [扉页转录及扫描入口](https://en.wikisource.org/w/index.php?title=Page:Smith_-_The_game_of_go.djvu/11&oldid=11826650)署 Arthur Smith、New York、Moffat, Yard & Company、1908；[版权页](https://en.wikisource.org/w/index.php?title=Page:Smith_-_The_game_of_go.djvu/12&oldid=12453900)记“Copyright, 1908 / BY ARTHUR SMITH”“Published, July, 1908”。这是美国出版证据，不能仅由此断言无同期海外出版或确定条约原籍国。此次读取的是逐页转录，尚未逐字目视核对扫描。

**身份。** [Gutenberg书目66632](https://www.gutenberg.org/ebooks/66632)列“Smith, Arthur, 1870-1929”、美国公版、电子版2021-10-30发布及2024-10-18更新；不是传教士等同名者的死亡日期自动套用。[Wikidata资料项](https://www.wikidata.org/wiki/Q16943893?oldid=2516947865)把1929死亡年指向[OCLC实体](https://id.oclc.org/worldcat/entity/E39PBJfWVh44HMTjhhqMTJTfv3)，但本轮OCLC正文无法提取，[LoC姓名规范记录](https://id.loc.gov/authorities/names/n89620486)返回403。这是代理初查时的缺口。主代理随后沿Gutenberg给出的LoC书号取得[美国国会图书馆该书JSON](https://www.loc.gov/item/08021547/?fo=json)，其`contributor_names`明确为“Smith, Arthur, 1870-1929.”，同时列出本书标题及1908纽约出版信息，补上同一本书与该作者年份的一手书目关联；不是借同名音乐家或传教士的信息。

**地域。** Gutenberg只明确“Public domain in the USA”。中国[现行著作权法](https://www.ncac.gov.cn/xxfb/flfg/flfg_532/202103/t20210309_50530.html)第2条规定外国作品保护依据，第23条为“作者终生及其死亡后五十年”，第22条明确署名、修改、保护作品完整权“不受限制”。若1929死亡及单一作者成立，通常经济权利期限推算至1979年底；这不是对条约、历史过渡或第三方内容的完整法律判断。英国[CDPA第12(2)条](https://www.legislation.gov.uk/ukpga/1988/48/section/12)通常为死后70年，同一前提下至1999年底。其他发行地、服务处理地须另核；不能写“全球公版”。

**数字版本。** [Gutenberg权限说明](https://www.gutenberg.org/policy/permission)“Most permissions not needed”明确美国公版可商业使用及制作衍生作品；“US only”同时警告地域差异。其“No sweat of the brow”不主张排版、拼写现代化等版权，但不替别国裁判。[许可1.C、1.E](https://www.gutenberg.org/policy/license)另涉及集合与商标、保留名称时的分发条件；单纯来源署名与借商标销售不可混同。Wikisource网页的BY-SA标识也不意味着古籍原文重新变成SA，但新增编校/注释不可一并视为公版。建议回到原版小段自行核对转录；所有图片、棋图、SGF、代码、现代译文、注释及重印版新增内容均排除。

## 小量正文及中文适用限定

定位基准为[第三章 Rules of Play，页面修订2255340](https://en.wikisource.org/w/index.php?title=The_Game_of_Go/Chapter_III&oldid=2255340)，不是整章批准：

- **提子：[印刷页27](https://en.wikisource.org/wiki/Page:Smith_-_The_game_of_go.djvu/53)，第二段**：“When it is taken it is removed from the board.” 前文讲四个正方向包围，下一段补边角。只能作为提子后移除的候选依据，必须保持边角/整串限定；不能把四邻包围孤子等同所有提子情况。
- **连接：[印刷页28](https://en.wikisource.org/wiki/Page:Smith_-_The_game_of_go.djvu/54)，‘It follows…’段**：“stones which are on the same diagonal line are not connected”。其正向句只说同一平行线，离开图容易误读为隔空相连。中文必须明确同色、纵横相邻直接连接或由此组成连续链；这是待审校的澄清，不冒称原文已精确定义。
- **气：暂不提议独立原段。** 已读短段没有现代“相邻空交叉点”的清晰定义；不能把翻译者补写伪装为书中引文。
- **打吃：拒绝采用该书相应段。** 第三章‘It is a rule…’段称“give warning”，还容许未警告时悔棋。这是历史礼仪叙述，不是合格的一气定义；不能摘出“Atari”便当现代规则教材。

仅讨论项目19路Chinese/Japanese基础合法性：须先由程序确认落子合法，再解释填掉对方整串最后一气后的提子。原文不足以独立证明该完整判断顺序。排除计分、劫/全局同形、征子、死活与终局移除结论。

## 与NC材料比较及接入门槛

若原文在相关地区确属公版，翻译、商业复制和再分发不受该原文经济权利限制，比NC路径更适合；但中文新译文权属与署名/完整性仍须记录。按已披露前提，DeepSeek条款不保证不训练：发送上下文并非纯本机使用，服务方留存、训练和下游利用不能靠“个人学习”解释掉。NC可能与商业下游冲突；ND妨碍译文分发；SA要求改编分享条件，亦不能假定模型下游自动履行。根MIT不解决第三方转载权属。

主代理已补核作者/本书的一手书目关联，但仍须核对原籍/目标地域、逐页原文及新增编辑边界，选定极小片段并保存版本/获取日期，审校中文及合法性限定，确认服务条款与所需下游权利兼容后才批准。不能将本报告当作法律保证、正文包、四概念齐备或21已解阻的证据。

## 主代理独立复核与补充

主代理读取报告后，独立获取Gutenberg 66632书目、固定版本第三章及国家版权局现行法页面，核对了作者年份、美国公版标注、移除被提棋子/斜线不直接连接/历史Atari警告段，以及第22、23条。没有采用Gutenberg的自动生成简介作为教学资料。

随后通过书目给出的LCCN `08021547`获取上述LoC第一方JSON：除作者及出版信息外，该条`rights`明确写“The books in this collection are in the public domain and are free to use and reuse.”，并列出来源标注“Library of Congress”。这加强其馆藏原书公版候选依据，但不自动覆盖全球所有地域、新增译注、图片/SGF或服务方下游用途；未下载JSON列出的整书PDF或逐页图像。

结论仍为条件候选：本轮没有批准正文、译文或资产入包，未完成气/打吃四概念合格首包，21继续blocked。该阻塞不影响17工作台、18存档、19聊天与其他可控功能开发。
