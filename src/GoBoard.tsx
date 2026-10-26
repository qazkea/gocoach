import type {Frame} from './replay';

type Mark = '目标' | '气' | '推荐' | undefined;
type Props = {
 frame: Frame;
 label: string;
 onPlay?: (point: string) => void;
 previewPlayer?: 'B' | 'W';
 mark?: (point: string) => Mark;
 annotations?: Record<string,string>;
 onAnnotation?: (point:string)=>void;
};
const axes = Array.from({length:19}, (_, i) => i);

// SVG units and HTML cells share the same 21-unit square: centers 1.5…19.5.
// Rules, analysis and history stay with callers; this module only presents a frame.
export function GoBoard({frame, label, onPlay, previewPlayer = frame.nextPlayer, mark, annotations, onAnnotation}: Props) {
 const latest = /^[BW] ([a-s]{2})$/.exec(frame.move)?.[1];
 return <>
  {onPlay && <p>半透明棋子仅为试下预览，不代表合法落子；点击或按 Enter / 空格试下。</p>}
  <div className="board" aria-label={label}>
  <svg viewBox="0 0 21 21" aria-hidden="true" className="board-grid">
   <g className="grid-lines">{axes.map(i => <g key={i}>
    <line x1="1.5" y1={i+1.5} x2="19.5" y2={i+1.5}/>
    <line x1={i+1.5} y1="1.5" x2={i+1.5} y2="19.5"/>
   </g>)}</g>
   <g className="star-points">{[3,9,15].flatMap(y => [3,9,15].map(x => <circle key={`${x},${y}`} cx={x+1.5} cy={y+1.5} r=".085"/>))}</g>
   <g className="board-coordinates">{axes.map(i => <g key={i}>
    <text x={i+1.5} y=".58">{String.fromCharCode(97+i)}</text>
    <text x={i+1.5} y="20.5">{String.fromCharCode(97+i)}</text>
    <text x=".52" y={i+1.5}>{String.fromCharCode(97+i)}</text>
    <text x="20.48" y={i+1.5}>{String.fromCharCode(97+i)}</text>
   </g>)}</g>
  </svg>
  <div className="board-points">{frame.board.map((stone, i) => {
   const point = String.fromCharCode(97+i%19)+String.fromCharCode(97+Math.floor(i/19));
   const last = !!stone && point === latest;
   const props = {className:'point '+(stone ?? ''), 'aria-label':point+' '+(stone === 'B' ? '黑' : stone === 'W' ? '白' : '空'), 'data-coordinate':point, 'data-mark':mark?.(point), 'data-last-move':last ? '' : undefined, title:point};
   const annotation=annotations?.[point];
   const action=annotation?.includes('A')?onAnnotation:undefined;
   const contents = <>{annotation&&<span className="board-annotation">{annotation}</span>}{!stone && onPlay && <span aria-hidden="true" className={'stone preview '+previewPlayer}/>}{stone && <span aria-hidden="true" className={'stone '+stone}/>}{last && <span aria-hidden="true" className="last-move"/>}</>;
   if(action)return <button key={point} type="button" {...props} aria-label={props['aria-label']+' · '+annotation+' 推荐'} onClick={()=>action(point)}>{contents}</button>;
   return onPlay ? <button key={point} type="button" {...props} onClick={() => onPlay(point)}>{contents}</button> : <span key={point} role="img" {...props}>{contents}</span>;
  })}</div>
 </div></>;
}
