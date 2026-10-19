import {engineInput} from './engine';
import type {AnalyzedResult} from './evidence';
import type {Replay} from './replay';
export async function analyze(game:Replay,step:number,signal:AbortSignal,onStatus:(s:string)=>void):Promise<AnalyzedResult> {
 const auth=await fetch('/api/token',{signal}).then(r=>r.json());
 const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':auth.token},body:JSON.stringify(engineInput(game,step)),signal});
 if(!response.ok){const data=await response.json();throw Error(data.error??'本机服务失败');}
 const reader=response.body!.getReader();const decoder=new TextDecoder();let buffer='';let result:AnalyzedResult|undefined;
 try {
  while(true){
   const {done,value}=await reader.read();if(done)break;
   buffer+=decoder.decode(value,{stream:true});
   const lines=buffer.split('\n');buffer=lines.pop()!;
   for(const line of lines){
    const data=JSON.parse(line);
    if(data.error)throw Error(data.error);
    if(data.status)onStatus(data.status);
    if(data.result)result=data.result;
   }
  }
 } finally {reader.releaseLock();}
 if(!result)throw Error('本机服务中断，分析未完成');
 return result;
}
