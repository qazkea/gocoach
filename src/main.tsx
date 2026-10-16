import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { createRoot } from "react-dom/client";
import { importReplay, MAX_FILE_BYTES, type Replay } from "./replay";
import "./style.css";
import {Course} from "./TeachingPanel";
import {EngineEntry} from "./EnginePanel";

function App() {
  const [game, setGame] = useState<Replay>();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("请选择已结束对局的完整 19 路 SGF");
  const [error, setError] = useState("");
  const request = useRef(0);
  const frame = game?.frames[step];

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // A user may select the same file again after a failure.
    const id = ++request.current;
    setGame(undefined);
    setStep(0);
    setError("");
    setStatus(file ? "正在本地读取…" : "请选择 SGF 文件");
    if (!file) return;
    try {
      if (file.size > MAX_FILE_BYTES) throw Error("文件超过 1 MiB 上限");
      const bytes = await file.arrayBuffer();
      if (id !== request.current) return;
      const result = importReplay(bytes);
      setGame(result);
      setStatus("导入成功");
    } catch (cause) {
      if (id !== request.current) return;
      setStatus("");
      setError("导入失败：" + (cause instanceof Error ? cause.message : "无法读取文件，请重新上传"));
    }
  }

  function navigate(event: KeyboardEvent<HTMLElement>) {
    if (!game) return;
    const destination: Record<string, number> = {
      ArrowLeft: step - 1,
      ArrowRight: step + 1,
      Home: 0,
      End: game.frames.length - 1,
    };
    if (Object.hasOwn(destination, event.key)) {
      event.preventDefault();
      setStep(Math.max(0, Math.min(game.frames.length - 1, destination[event.key])));
    }
  }

  return <main>
    <h1>围棋赛后复盘</h1>
    <p>仅用于已结束对局。文件在本机浏览器读取；仅显式打开真实分析时将必要棋局发送到同机服务，无外发；不提供实时辅助、账号连接或自动同步。</p>
    <p>仅基础回放校验：Chinese / Japanese 的占点、提子、自杀与简单劫；不计分、不裁判终局或长周期争议，不代表完整规则支持。</p>
    <p>支持单谱单线 FF[4]、19 路、明确 RU 与 KM；UTF-8 / GBK / Latin1（无 CA 时为 Latin1）。最多 1 MiB、2000 节点。初始 setup 可用；分支、途中 setup、规则例外及未支持属性会拒绝。尚未验证野狐兼容。</p>
    <label>选择 SGF 文件 <input type="file" accept=".sgf" onChange={upload} /></label>
    <p role="status">{status}</p>
    {error && <p role="alert">{error}</p>}
    {game && <section aria-label="棋谱信息">
      <p>黑方：{game.black}；白方：{game.white}</p>
      <p>规则记录：{game.rules}；贴目：{game.komi}；结果记录：{game.result}；编码：{game.encoding}；让子记录：{game.handicap}</p>
      <p>结果来自文件，不自动判断真实对局是否结束或计算胜负。让子数不自动摆子，初始局面以 setup 记录为准。</p>
    </section>}
    <p>示例分析：预设数据，非真实引擎或在线AI。仅四份合成记录可用，不代表真实棋力评估。</p>
    {game && <Course key={request.current} game={game} step={step} onStep={setStep} />}
    {game && <EngineEntry key={request.current + ':' + step} game={game} step={step} />}
    {game && frame && <section aria-label="棋谱回放" tabIndex={0} onKeyDown={navigate}>
      <p>第 {step} / {game.frames.length - 1} 手：{frame.move}</p>
      <p>黑提子：{frame.blackCaptures}；白提子：{frame.whiteCaptures}</p>
      <p>聚焦回放区域后：左右方向键前后浏览，Home 回起始，End 到末尾。坐标为 SGF 列、行（aa 左上，ss 右下）。</p>
      <nav aria-label="回放导航">
        {([["起始", 0], ["上一手", step - 1], ["下一手", step + 1], ["末尾", game.frames.length - 1]] as const).map(([label, n]) =>
          <button key={label} disabled={n === step || n < 0 || n >= game.frames.length} onClick={() => setStep(n)}>{label}</button>)}
      </nav>
      <div className="board" aria-label="19 路棋盘">
        {frame.board.map((stone, i) => {
          const point = String.fromCharCode(97 + i % 19) + String.fromCharCode(97 + Math.floor(i / 19));
          return <span key={i} role="img" aria-label={point + " " + (stone === "B" ? "黑" : stone === "W" ? "白" : "空")} className={"point " + (stone ?? "")}>
            {stone ? "●" : "+"}
          </span>;
        })}
      </div>
    </section>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
