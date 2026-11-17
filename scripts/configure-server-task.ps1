$ErrorActionPreference = 'Stop'
$serverRoot = Split-Path -Parent $PSScriptRoot
$statusFile = Join-Path $serverRoot 'logs\server-task-setup.json'
try {
    $serverTask = Get-ScheduledTask -TaskName 'FN Assistant Manual Server'
    $backupFile = Join-Path $serverRoot 'logs\server-task-before-24x7.xml'
    if (-not (Test-Path -LiteralPath $backupFile)) {
        Export-ScheduledTask -TaskName $serverTask.TaskName | Set-Content -LiteralPath $backupFile
    }
    $serverAction = New-ScheduledTaskAction -Execute 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + (Join-Path $PSScriptRoot 'start-server.ps1') + '"') -WorkingDirectory $serverRoot
    $serverPrincipal = New-ScheduledTaskPrincipal -UserId $serverTask.Principal.UserId -LogonType S4U -RunLevel Limited
    $bootTrigger = New-ScheduledTaskTrigger -AtStartup
    # Configure successfully before stopping the current working server.
    Set-ScheduledTask -TaskName $serverTask.TaskName -Action $serverAction -Principal $serverPrincipal -Trigger $bootTrigger | Out-Null
    & wevtutil sl Microsoft-Windows-TaskScheduler/Operational /e:true
    if ($LASTEXITCODE -ne 0) { throw 'Cannot enable Task Scheduler history' }
    & powercfg /change standby-timeout-ac 0
    if ($LASTEXITCODE -ne 0) { throw 'Cannot disable AC sleep' }
    $oldListener = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
    $oldServer = if ($oldListener) { Get-CimInstance Win32_Process -Filter ('ProcessId=' + $oldListener.OwningProcess) }
    Stop-ScheduledTask -TaskName $serverTask.TaskName
    # Clean up legacy launchers that did not contain their child process tree.
    $watchdogPath = [regex]::Escape((Join-Path $PSScriptRoot 'watchdog.js'))
    $indexPath = [regex]::Escape((Join-Path $serverRoot 'index.js'))
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
        $_.CommandLine -match $watchdogPath
    } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
        $_.CommandLine -match $indexPath
    } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    if ($oldServer -and $oldServer.CommandLine -match 'node\s+index\.js') {
        Stop-Process -Id $oldServer.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-ScheduledTask -TaskName $serverTask.TaskName
    @{ status = 'configured'; time = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $statusFile
} catch {
    @{ status = 'failed'; error = $_.Exception.Message; time = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $statusFile
    exit 1
}
