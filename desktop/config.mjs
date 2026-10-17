import {open, stat, mkdir, mkdtemp, writeFile, rename, rm} from 'node:fs/promises';
import {isAbsolute, join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

// The native chooser selects an executable-bearing operator file, not renderer input.
export async function readOperator(path) {
 if(typeof path!=='string'||!isAbsolute(path)||/[\0\r\n]/.test(path))throw Error('请选择绝对路径的本地 JSON 配置');
 const file=await open(path,'r');
 let raw;
 try {
  if(!(await file.stat()).isFile())throw Error('配置必须是文件');
  const buffer=Buffer.alloc(65537);let size=0;
  while(size<buffer.length){const read=await file.read(buffer,size,buffer.length-size,null);if(!read.bytesRead)break;size+=read.bytesRead;}
  if(size>65536)throw Error('配置不能超过64KiB');
  raw=buffer.subarray(0,size);
 } finally {await file.close();}
 const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('配置必须是 JSON 对象');
 const config={};
 for(const key of ['executable','model','dataDir','homeDataDir']) {
  const path=value[key];
  if(typeof path!=='string'||!isAbsolute(path)||/[\0\r\n]/.test(path))throw Error(`${key} 必须是无换行的绝对路径`);
  const info=await stat(path);
  if(key==='executable'||key==='model') {if(!info.isFile())throw Error(`${key} 必须指向已有文件`);}
  else if(!info.isDirectory())throw Error(`${key} 必须指向已有目录`);
  config[key]=path;
 }
 if(!/\.exe$/i.test(config.executable))throw Error('executable 必须指向 Windows exe');
 return {path,digest:createHash('sha256').update(raw).digest('hex'),config};
}

export async function restoreOperator(userData) {
 const path=join(userData,'go-coach','settings.json');
 let file;
 try {
  file=await open(path,'r');
  const buffer=Buffer.alloc(8193);let size=0;
  while(size<buffer.length){const read=await file.read(buffer,size,buffer.length-size,null);if(!read.bytesRead)break;size+=read.bytesRead;}
  if(size>8192)throw Error('设置文件超限');
  const ref=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,size)));
  if(!ref||typeof ref.path!=='string'||typeof ref.digest!=='string'||!(/^[a-f0-9]{64}$/).test(ref.digest))throw Error('设置文件无效');
  const candidate=await readOperator(ref.path);
  if(candidate.digest!==ref.digest)throw Error('原配置内容已变更');
  return {approved:candidate};
 } catch(error) {
  if(!file&&error.code==='ENOENT')return {};
  return {notice:'配置已变更或失效，请从引擎菜单重新选择并确认'};
 } finally {await file?.close();}
}

export async function rememberOperator(approved,userData) {
 const root=join(userData,'go-coach');await mkdir(root,{recursive:true});
 const temporary=join(root,`settings-${randomUUID()}.tmp`);
 try {
  await writeFile(temporary,JSON.stringify({path:approved.path,digest:approved.digest}),{flag:'wx'});
  await rename(temporary,join(root,'settings.json'));
 } finally {await rm(temporary,{force:true});}
}

export async function prepareOperator(approved,userData) {
 const root=join(userData,'go-coach','runs');
 await mkdir(root,{recursive:true});
 const dataDir=await mkdtemp(join(root,'engine-'));
 const path=join(dataDir,'operator.json');
 // Whitelist fields: never copy recordSyntheticEvidence or other untrusted settings.
 await writeFile(path,JSON.stringify({executable:approved.config.executable,model:approved.config.model,homeDataDir:approved.config.homeDataDir,dataDir,recordSyntheticEvidence:false}));
 return path;
}
