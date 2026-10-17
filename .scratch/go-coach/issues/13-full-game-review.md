# 13：整局扫描与逐手本地分析

**Parent:** 围棋赛后复盘教练；新范围见 [desktop-review-scope.md](../desktop-review-scope.md)

**Category:** enhancement

**Status:** ready-for-agent

**Execution:** done

**Blocked by:** 01与09（均已验收完成）；不依赖未授权的真实DeepSeek调用。

## What to build

按[13-design.md](../13-design.md)实施：默认导入后自动分析所有N+1局面，展示完整/部分进度、走势、双方逐手估值变化及当前局面候选。当前手可优先补齐，支持暂停/继续和失败重试，换谱取消与引擎代次隔离。保留已有教学和手动变化功能。

## Acceptance criteria

- [x] 任意支持且满足引擎条件的SGF默认自动扫描，不限合成示例；N+1初末局面齐全，发送内容仅必要棋局，无身份/评论/原SGF。
- [x] 固定BLACK曲线与逐手入口可定位回放；黑白估值变化符号和百分点正确，未分析/失败不伪造，不把波动称严格失误损失。
- [x] 回看已有手不重算，切手只调整下一任务；暂停、失败重试、换谱乱序和引擎重启正确隔离，队列/结果有界。
- [x] 显示当前局面候选/假设变化及分析条件；未接入的中文讲解明确标为尚未启用，不制造假的DeepSeek回答。
- [x] 原96条回归保留；用真实UI选择关闭自动扫描验证旧手动路径，精确适配能力GET与动态测试origin，不弱化隐私检查。
- [x] 实际浏览器TDD、typecheck/build、完整回归；独立Spec/Standards审查；主代理整合复测、查看截图并做授权合成谱真实GPU核验。
- [x] 测试不操作用户5173服务，仅清理自有进程；未调用在线AI、读取密钥、付费或推送。

## Comments

主代理已验收最终代码ed10ae9：独立Spec/Standards及复核通过，整合后110条浏览器回归全部通过，真实KataGo三份合成短谱共13个局面全部核对。证据及未覆盖项见[13-main-acceptance.md](../13-main-acceptance.md)。用户已要求继续。主代理确定首个纵切片，代码委派implementer。Electron依赖本地安装已另获准，但桌面壳不混入本票；05/08/10按新范围继续规划，不把本票当作中文教练交付完成。
