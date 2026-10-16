# 围棋赛后复盘（任务01开发中）

仅电脑浏览器本地手动读取 SGF；没有后端、AI 或引擎，不上传棋谱。
尚未完成合法性验证，不可作为已验收播放器使用；没有验证野狐兼容。

## 运行
需要 Node 24 和 npm。
```sh
npm install
npx playwright install chromium
npm run dev
npm test
npm run typecheck
npm run build
```
Windows PowerShell 可用 npm.cmd / npx.cmd 避免脚本策略影响。

## 当前切片范围
单谱单线 FF4、19路、UTF-8/GBK/严格 Latin1（CA 缺省 Latin1）读取，
元数据展示、基础落子导航、损坏语法及必要 RU/KM 缺失反馈与恢复。
分支、多谱、非19路、非FF4、途中setup拒绝。
**尚未完成提子/劫/自杀/让子等，不要将导入成功理解成合法棋局保证。**
实施及待决规则 profile 见 `.scratch/go-coach/01-implementation-log.md`。
