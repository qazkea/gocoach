// External test process: closes only its own real Windows stdin handle.
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using System.Web.Script.Serialization;
using System.Collections.Generic;
class BrokenInput {
 [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr GetStdHandle(int n);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadFile(IntPtr h, byte[] b, uint size, out uint read, IntPtr overlapped);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr h);
 static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
 static string ReadLine(IntPtr input) {
  var bytes = new List<byte>(); var one = new byte[1]; uint read;
  while(ReadFile(input, one, 1, out read, IntPtr.Zero) && read != 0) {
   if(one[0] == 10) return Encoding.UTF8.GetString(bytes.ToArray());
   bytes.Add(one[0]);
  }
  return null;
 }
 static void Main(string[] args) {
  string observe = Environment.GetEnvironmentVariable("ENGINE_OBSERVE");
  int pid = System.Diagnostics.Process.GetCurrentProcess().Id;
  File.AppendAllText(observe + ".pids", pid + "\n");
  if(args.Length == 1 && args[0] == "version") {
   File.AppendAllText(observe, Json.Serialize(new {action="version-held-open",pid=pid}) + "\n");
   Thread.Sleep(Timeout.Infinite); // No fabricated KataGo version success.
  }
  IntPtr input = GetStdHandle(-10);
  Console.Error.WriteLine("Started, ready to begin handling requests");
  string line;
  while((line = ReadLine(input)) != null) {
   File.AppendAllText(observe, line + "\n");
   var q = Json.Deserialize<Dictionary<string,object>>(line);
   if(!File.Exists(observe + ".broken")) {
    File.WriteAllText(observe + ".broken", "1");
    if(!CloseHandle(input)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    File.AppendAllText(observe, Json.Serialize(new {action="held-open",pid=pid}) + "\n");
    Console.WriteLine(Json.Serialize(new {id=q["id"],isDuringSearch=false,noResults=true}));
    Thread.Sleep(Timeout.Infinite);
   }
   // This adapter deliberately accepts only the regression's synthetic empty board.
   Console.WriteLine(Json.Serialize(new {id=q["id"],turnNumber=0,isDuringSearch=false,
    rootInfo=new {currentPlayer="B",visits=101,winrate=0.6,scoreLead=2.5},
    moveInfos=new[]{new {move="D16",visits=100,winrate=0.6,scoreLead=2.5,pv=new[]{"D16","pass"}}}}));
  }
 }
}
