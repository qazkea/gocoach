// External engine adapter for synthetic desktop tests only; never ships in the package.
using System;
using System.IO;
using System.Threading;
using System.Collections;
using System.Collections.Generic;
using System.Web.Script.Serialization;
class DesktopEngine {
 static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
 static string Observe = Environment.GetEnvironmentVariable("ENGINE_OBSERVE");
 static void Record(object value) { File.AppendAllText(Observe, Json.Serialize(value) + "\n"); }
 static void Main(string[] args) {
  Console.InputEncoding = System.Text.Encoding.UTF8;
  Console.OutputEncoding = new System.Text.UTF8Encoding(false);
  int pid = System.Diagnostics.Process.GetCurrentProcess().Id;
  File.AppendAllText(Observe + ".pids", pid + "\n");
  string scenario = Environment.GetEnvironmentVariable("ENGINE_SCENARIO");
  Record(new {action="launch",pid=pid,args=args});
  if(args.Length == 1 && args[0] == "version") {
   if(scenario == "slow-version") Thread.Sleep(Timeout.Infinite);
   Console.WriteLine("KataGo v1.18.1\nUsing OpenCL backend"); return;
  }
  for(int i=0;i+1<args.Length;i++) if(args[i]=="-config") Record(new {action="config",path=args[i+1],text=File.ReadAllText(args[i+1])});
  Console.Error.WriteLine("Started, ready to begin handling requests");
  string line;
  while((line=Console.ReadLine())!=null) {
   var q=Json.Deserialize<Dictionary<string,object>>(line);
   Record(q);
   if(q.ContainsKey("action")) { Console.WriteLine(line); continue; }
   if(scenario=="waiting" || scenario=="uncooperative" || scenario=="shutdown-gate") continue;
   if(scenario=="bad-protocol") { Console.WriteLine("not-json"); continue; }
   int turns=((IList)q["moves"]).Count;
   string player=(string)q["initialPlayer"];
   if(turns%2==1) player=player=="B"?"W":"B";
   // Independent fixed example: ba/aa/ab/pass leaves D16 empty at all five positions.
   Console.WriteLine(Json.Serialize(new {id=q["id"],turnNumber=turns,isDuringSearch=false,
    rootInfo=new {currentPlayer=player,visits=101,winrate=0.6,scoreLead=2.5},
    moveInfos=new[]{new {move="D16",visits=100,winrate=0.6,scoreLead=2.5,pv=new[]{"D16","pass"}}}}));
  }
  if(scenario=="shutdown-gate") {
   Record(new {action="stdin-closed",pid=pid});
   while(!File.Exists(Observe + ".release")) Thread.Sleep(20);
  }
  if(scenario=="uncooperative") Thread.Sleep(Timeout.Infinite);
 }
}
