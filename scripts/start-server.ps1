$ErrorActionPreference = 'Stop'
$serverRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $serverRoot
$env:NODE_OPTIONS = '--use-system-ca'
# Windows closes this job handle when Task Scheduler ends the launcher, which
# terminates the supervisor AND its descendants. A plain shell leaves orphans.
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class ServerJob {
  [StructLayout(LayoutKind.Sequential)] public struct BasicLimits {
    public long ProcessTime, JobTime;
    public uint Flags;
    public UIntPtr MinWorkingSet, MaxWorkingSet;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint PriorityClass, SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)] public struct IoCounters {
    public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes;
  }
  [StructLayout(LayoutKind.Sequential)] public struct ExtendedLimits {
    public BasicLimits Basic;
    public IoCounters Io;
    public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool SetInformationJobObject(IntPtr job, int kind, IntPtr info, uint size);
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll")]
  public static extern bool CloseHandle(IntPtr handle);
}
"@
$serverJobHandle = [ServerJob]::CreateJobObject([IntPtr]::Zero, $null)
if ($serverJobHandle -eq [IntPtr]::Zero) { throw 'Cannot create server process job' }
try {
    $limits = New-Object ServerJob+ExtendedLimits
    $basicLimits = New-Object ServerJob+BasicLimits
    $basicLimits.Flags = 0x2000 # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    $limits.Basic = $basicLimits
    $size = [Runtime.InteropServices.Marshal]::SizeOf($limits)
    $nativeLimits = [Runtime.InteropServices.Marshal]::AllocHGlobal($size)
    try {
        [Runtime.InteropServices.Marshal]::StructureToPtr($limits, $nativeLimits, $false)
        if (-not [ServerJob]::SetInformationJobObject($serverJobHandle, 9, $nativeLimits, $size)) {
            throw ('Cannot configure server process job: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error())
        }
    } finally { [Runtime.InteropServices.Marshal]::FreeHGlobal($nativeLimits) }
    $launchStamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $watchdogProcess = Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList ('"' + (Join-Path $PSScriptRoot 'watchdog.js') + '"') -WorkingDirectory $serverRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $serverRoot "logs\watchdog-launch-$launchStamp.out.log") -RedirectStandardError (Join-Path $serverRoot "logs\watchdog-launch-$launchStamp.err.log") -PassThru
    if (-not [ServerJob]::AssignProcessToJobObject($serverJobHandle, $watchdogProcess.Handle)) {
        Stop-Process -Id $watchdogProcess.Id -Force -ErrorAction SilentlyContinue
        throw ('Cannot contain server process tree: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error())
    }
    $watchdogProcess.WaitForExit()
    $serverExitCode = $watchdogProcess.ExitCode
} finally { [ServerJob]::CloseHandle($serverJobHandle) | Out-Null }
exit $serverExitCode
