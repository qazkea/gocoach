// Test-only OS scheduling fault adapter. Acts only on an explicitly verified identity.
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
class OwnedProcessControl {
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr handle,uint code);
 [DllImport("ntdll.dll")] static extern int NtSuspendProcess(IntPtr handle);
 [DllImport("ntdll.dll")] static extern int NtResumeProcess(IntPtr handle);
 static void Main(string[] args) {
  var target=Process.GetProcessById(Int32.Parse(args[1]));
  long created=(target.StartTime.ToUniversalTime().Ticks-621355968000000000L)/10000;
  if(created!=Int64.Parse(args[2]) || !String.Equals(target.MainModule.FileName,args[3],StringComparison.OrdinalIgnoreCase)) throw new Exception("Target identity changed");
  IntPtr handle=OpenProcess(0x1801,false,target.Id);
  if(handle==IntPtr.Zero) throw new Exception("Cannot open owned utility: "+Marshal.GetLastWin32Error());
  try {
   int result=args[0]=="suspend"?NtSuspendProcess(handle):args[0]=="resume"?NtResumeProcess(handle):args[0]=="exit-zero"&&TerminateProcess(handle,0)?0:-1;
   if(result!=0) throw new Exception("OS scheduling fault failed: "+result);
   Console.WriteLine(args[0]+" "+target.Id+" "+created);
  } finally {CloseHandle(handle);}
 }
}
