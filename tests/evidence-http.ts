import type {APIRequestContext} from '@playwright/test';
import type {EngineInput} from '../src/engine';
export const initial:EngineInput={initialStones:[],initialPlayer:'B',RU:'Chinese',KM:7.5,moves:[]};
export async function evidenceClient(request:APIRequestContext,url:string){
 const {token}=await (await request.get(url+'/api/token')).json();
 const headers={Origin:url,'Content-Type':'application/json','X-CSRF-Token':token};
 const post=(path:string,data:unknown,extra:Record<string,string>={})=>request.post(url+path,{headers:{...headers,...extra},data});
 return {post,resolve:(data:unknown)=>post('/api/review-evidence',data),analyze:async(position:EngineInput)=>{
  const r=await post('/api/analyze',position);
  if(r.status()!==200)throw Error(await r.text());
  return (await r.text()).trim().split('\n').map(l=>JSON.parse(l)).at(-1);
 }};
}
