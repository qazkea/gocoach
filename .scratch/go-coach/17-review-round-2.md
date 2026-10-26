# 17：修复复核与视觉最终 verdict

冻结源码：`1d778f89ff9e46bdab81958ef07b764e0ed22392`。修复基点 `589c88c1182f1c02118a562dbdf2a2bef5cb9fd0`，7文件、两提交：`0ddf117`修复，`1d778f8`补充日志。原始25文件审查见[第一轮](17-review-round-1.md)。

## Standards

reviewer `d12fe5fd-043d-4c4`：硬规则问题0，判断型smell 0。核验hook的一次DTO回调、集中epoch/abort/超时/reader清理、具有真实调用需要的cancel；两入口共用新核验，旧缓存语义未改。真实HTTP响应门控和外部时钟符合测试seam，原断言未删除/放宽。仅静态复核，没有把实现者171/57当作自己执行。

## Spec

reviewer `2b58bc98-56a4-40e`：前轮TTL问题resolved，新material问题0。文字按钮与棋盘A都经新的真实HTTP核验，构建变化读取本次回调DTO；不await长连接结束。10秒截止延续至查询交付，回谱/对照/试下同步取消，切手/换谱挂载身份隔离迟到。已展开合法棋序明确作为历史假设保留，失效不冒充当前依据；16完整身份、有界cache、当前after实际成功不回退。走势读取原谱step/results，未知不造值、不串试下估值。静态结论不替代执行或教学质量验证。

## Visual

- `3ca6a13e-7381-407`重新读取15张canonical图：可见黑方胜率/原谱手数/数值和三角＋竖虚线定位均resolved，布局无新回归；因缺未知状态图，整体partial/disposition fix。
- 主代理从同一源码build后，用5200生产HTTP与真实Chromium公开UI关闭自动扫描、导入合成谱，捕获初盘及第1手的1440、920、390宽度未知状态。页面只有3个同源GET、0分析和0页面外部请求；只关闭自己启动的服务。脚本、元数据与4张图在 `D:/code/tmp/go-coach-notes/17-main-acceptance/` 的 `capture-unknown.cjs`、`unknown-capture.json`、`unknown/`。
- `bbd14351-0e70-4a1`逐读4图：未知明确、没有0%或伪有效胜率；原谱定位清楚、窄窗紧凑，无本次可见回归。最终 `remaining: clear`，`disposition: ship`，仅覆盖已评分修复。
- 本轮没有独立QUALITY BAR卡，沿用已选世界/方向契约和craft floor；不虚构全站认证。15张d793旧图仍在 `D:/code/tmp/go-coach-notes/17-review-round1-d7931c1/`，没有丢弃初轮失败证据。

## 实际设计记录

documenter `f36b9f82-5c18-421`从已完成代码和真实图写根 `DESIGN.md`、`.impeccable/design.json`。主代理完整读取并核对CSS，解析YAML/JSON、检查token引用、7个组件片段与13组8阶预览派生色阶。没有新生产token/素材或UI修改；原生文件选择/checkbox平台外观不升格为品牌规范。文档不进入客户端包，不把未来聊天/存档当已实现。

## 最终门槛

主代理整合build、171网页及新打包57桌面均已独立执行通过；准确命令、指纹、AC与限制见[主验收](17-main-acceptance.md)。这些实跑结果与本文件的静态/视觉审查分开，不将受控引擎或合成数据夸大成真实教学效果。
