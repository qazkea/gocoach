import {test,expect,upload,processes,ownedProcesses} from './fixture';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';

for(const scenario of ['slow-version','waiting','uncooperative','bad-protocol'])test.describe(scenario,()=>{
 test.use({engineScenario:scenario});
 test(`引擎 ${scenario} 时原生关窗回收自有服务和引擎`,async({desktop})=>{
  const run=await desktop.launch();await desktop.select(run,desktop.operator);await upload(run.page);
  if(scenario==='slow-version')await expect.poll(async()=>(await desktop.observed()).some(q=>q.action==='launch'&&q.args[0]==='version')).toBe(true);
  else await expect.poll(async()=>(await desktop.observed()).filter(q=>q.moves).length).toBe(1);
  if(scenario==='bad-protocol')await expect(run.page.getByRole('region',{name:'整局复盘'})).toContainText('失败，已暂停');
  await run.close();
 });
});

test.describe('分析中换配置',()=>{
 test.use({engineScenario:'uncooperative'});
 test('取消保留正在分析的谱，批准更换回收旧引擎并清空复盘',async({desktop})=>{
  const run=await desktop.launch();await desktop.select(run,desktop.operator);await upload(run.page);
  await expect.poll(async()=>(await desktop.observed()).filter(q=>q.moves).length).toBe(1);
  const before=run.page.url();
  const decline=await desktop.select(run,desktop.operator,0);
  expect(decline.messages[0].detail).toContain('清空当前复盘');
  expect(run.page.url()).toBe(before);
  await expect(run.page.getByRole('region',{name:'棋谱回放'})).toBeVisible();
  const accepted=await desktop.select(run,desktop.operator);
  expect(accepted.messages[0]).toMatchObject({defaultId:0,cancelId:0});
  await expect(run.page.getByRole('region',{name:'棋谱回放'})).toHaveCount(0);
  expect(processes().filter(p=>p.ExecutablePath?.toLowerCase()===desktop.engine.toLowerCase())).toEqual([]);
  await run.close();
 });
});

test.describe('桥故障',()=>{
 test.use({engineScenario:'uncooperative'});
 test('受控杀死本实例 utility 后仍回收自有引擎，并能正常退出',async({desktop})=>{
  const run=await desktop.launch();await desktop.select(run,desktop.operator);await upload(run.page);
  await expect.poll(async()=>(await desktop.observed()).filter(q=>q.moves).length).toBe(1);
  await run.app.evaluate(({dialog})=>{dialog.showErrorBox=()=>{};}); // Acknowledge native error I/O, not lifecycle.
  const owned=ownedProcesses(processes(),run.child.pid!);
  const bridge=owned.find(p=>p.CommandLine?.includes('node.mojom.NodeService'));
  expect(bridge,'fault injection must identify this invocation-owned utility').toBeTruthy();
  await writeFile(join(desktop.evidence,'fault-ownership.json'),JSON.stringify(bridge,null,2));
  process.kill(bridge!.ProcessId,'SIGKILL'); // External OS failure; never a port/name kill.
  await expect.poll(()=>processes().filter(p=>p.ExecutablePath?.toLowerCase()===desktop.engine.toLowerCase()).map(p=>p.ProcessId),{timeout:10000,message:'utility failure must not strand the native engine'}).toEqual([]);
  await run.close();
 });
});
