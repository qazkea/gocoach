# 09：本地 KataGo 授权前研究

仅查官方网页文本及已有 `nvidia-smi`；未下载引擎/权重、未运行引擎、未付费、未上传棋谱、未调度代理。任务09仍待授权及实测。

## 推荐与依赖

本机已确认 Windows x64、i5-13400F、16逻辑核、16GiB RAM；本次只读查询 `--query-gpu=name,memory.total,driver_version --format=csv,noheader` 返回 RTX5060、8151MiB、610.88。**不采用 Win32 AdapterRAM 推断4GB。**

官方当前稳定版为 **v1.18.2**，但只更新 CUDA；官方明确其他后端最新仍为 **v1.18.1**。[1] 推荐 **v1.18.1 OpenCL＋下表b18**：优先少依赖而非最高速度；需要可用的 OpenCL≥1.2 驱动，首次调优可能数分钟。失败改 **Eigen AVX2＋b10**，不用GPU；AVX2/FMA及系统运行库仍待核验。TensorRT需匹配CUDA、TensorRT运行库，启动较慢，暂不选；包内DLL须保留，缺库即停，不自行安装。[2][3][13]

## 官方文件清单

字节数取官方API；链接仅供核对，未取二进制。[4][5][6]

|用途|准确文件名|字节|
|---|---|---:|
|推荐|`katago-v1.18.1-opencl-windows-x64.zip`|6,004,137|
|CPU后备|`katago-v1.18.1-eigenavx2-windows-x64.zip`|5,899,607|
|无AVX2后备|`katago-v1.18.1-eigen-windows-x64.zip`|5,903,072|
|暂不选|`katago-v1.18.1-trt10.9.0-cuda12.8-windows-x64.zip`|8,375,820|
|最新CUDA示例|`katago-v1.18.2-cuda12.8-cudnn9.8.0-windows-x64.zip`|10,173,580|
|较小常规模型b18 [11]|`kata1-b18c384nbt-s9996604416-d4316597426.bin.gz`|97,898,094|
|更小旧模型b10 [6]|`kata1-b10c128-s1141046784-d204142634.txt.gz`|14,466,254|

引擎主体MIT、附带库各有许可。[12] b18采用官方神经网络许可（MIT式，保留声明），b10元数据注明源于g170，对应CC0例外。b10较弱，仅作低资源后备。[3][6][7] 下载后分别比对发行API的 `digest` 与模型API的 `model_file_sha256`；本次未实际校验文件。[4][5][6][11]

## 接口及低预算提案

授权后命令形态：`katago.exe analysis -config local.cfg -model MODEL -quit-without-waiting`。经本地进程stdin/stdout逐行JSON通信；显式传 `rules/komi/boardXSize/boardYSize`、让子 `initialStones/initialPlayer`，核对 `whiteHandicapBonus`。原局用真实 `moves` 历史，分支为历史前缀＋试下序列，不能只传棋盘丢掉劫历史；缺信息先询问，规则转换警告不得静默接受。[8]

固定 `reportAnalysisWinratesAs=BLACK`，读取 `moveInfos` 的候选、`pv/winrate/scoreLead` 与 `rootInfo`；黑方领先为正。数值不构成自然语言棋理证据，更不证明全局最优；候选非全部合法手，PV非必然结局。[8]

建议单局面：`numAnalysisThreads=1`、`numSearchThreadsPerAnalysisThread=2`、`nnMaxBatchSize=2`、`nnCacheSizePowerOfTwo=18`，GPU `maxVisits=100/maxTime=2`；CPU先32次/5秒，`numEigenThreadsPerModel=2`；关闭ownership。均为试验起点，不保证速度或显存够用。[9] 应用另设就绪后30秒超时，切分支取消旧id并丢弃迟到响应；启动调优单独提示。[8]

## 授权边界

拟仅监听回环地址，不启用contribute或外部服务，零棋谱外发、零服务费用。限定独立目录，配置 `homeDataDir`、日志到该目录；退出关闭stdin，必要时终止子进程，再清理目录。[8][9][10] **待确认**：GPU兼容、驱动OpenCL组件、DLL缺项、耗时及历史/黑方视角样例；实测另需明确授权。

下载授权口径（十进制MB）：CPU+b10 **20,365,861字节（20.37MB）**；推荐OpenCL+b18 **103,902,231字节（103.90MB）**；两套都备 **124,268,092字节（124.27MB）**。范围 **20.37–124.27MB**，不含额外运行库、解压/缓存空间；若缺依赖须重新报价及授权。

## 官方来源

[1]: https://github.com/lightvector/KataGo/releases/tag/v1.18.2
[2]: https://github.com/lightvector/KataGo/releases/tag/v1.18.1
[3]: https://github.com/lightvector/KataGo/blob/v1.18.1/README.md#opencl-vs-cuda-vs-tensorrt-vs-rocm-vs-onnx-vs-eigen
[4]: https://api.github.com/repos/lightvector/KataGo/releases/tags/v1.18.1
[5]: https://api.github.com/repos/lightvector/KataGo/releases/tags/v1.18.2
[6]: https://katagotraining.org/api/networks/kata1-b10c128-s1141046784-d204142634/?format=json
[7]: https://katagotraining.org/network_license/
[8]: https://github.com/lightvector/KataGo/blob/v1.18.1/docs/Analysis_Engine.md
[9]: https://github.com/lightvector/KataGo/blob/v1.18.1/cpp/configs/analysis_example.cfg
[10]: https://github.com/lightvector/KataGo/blob/v1.18.1/cpp/configs/gtp_example.cfg

[11]: https://katagotraining.org/api/networks/kata1-b18c384nbt-s9996604416-d4316597426/?format=json
[12]: https://github.com/lightvector/KataGo/blob/v1.18.1/LICENSE
[13]: https://github.com/lightvector/KataGo/blob/v1.18.1/Compiling.md
