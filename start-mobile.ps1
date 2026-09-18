[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "AI-Chat 移动端 App 一键启动 (Flutter Hot Reload)"
Set-Location -Path $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       AI-Chat 移动端应用 (Flutter) - 一键快捷启动" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查并确保 PostgreSQL 服务运行
Write-Host "[*] 正在检查 PostgreSQL 数据库服务..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
if ($pgService) {
    if ($pgService.Status -ne "Running") {
        Write-Host "[!] 正在启动 PostgreSQL 服务..." -ForegroundColor Yellow
        Start-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
    }
    Write-Host "[OK] PostgreSQL 数据库服务已就绪 (端口: 5432)" -ForegroundColor Green
} else {
    Write-Host "[*] 未检测到 postgresql-x64-18 系统服务（跳过）" -ForegroundColor Gray
}

# 2. 检查并确保 Redis 服务运行
Write-Host "[*] 正在检查 Redis 缓存服务..." -ForegroundColor Yellow
$redisService = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
if ($redisService) {
    if ($redisService.Status -ne "Running") {
        Write-Host "[!] 正在启动 Redis 服务..." -ForegroundColor Yellow
        Start-Service -Name "Redis" -ErrorAction SilentlyContinue
    }
    Write-Host "[OK] Redis 缓存服务已就绪 (端口: 6379)" -ForegroundColor Green
} else {
    Write-Host "[*] 未检测到 Redis 系统服务（跳过）" -ForegroundColor Gray
}

# 3. 检查后端服务 (端口 3000)
Write-Host "[*] 正在检查后端 NestJS API 服务 (localhost:3000)..." -ForegroundColor Yellow
$backendRunning = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect("127.0.0.1", 3000, $null, $null)
    $success = $iar.AsyncWaitHandle.WaitOne(1000, $false)
    if ($success) {
        $tcp.EndConnect($iar)
        $backendRunning = $true
    }
    $tcp.Close()
} catch {
    $backendRunning = $false
}

if ($backendRunning) {
    Write-Host "[OK] 后端 API 服务已在线运行 (http://localhost:3000)" -ForegroundColor Green
} else {
    Write-Host "[!] 后端服务尚未启动，正在新窗口中为您拉起后端 NestJS 服务..." -ForegroundColor Yellow
    $backendCmd = "Set-Location '$PSScriptRoot'; npm run dev:backend"
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy Bypass", "-Command", $backendCmd
    Write-Host "[OK] 已在新终端中启动后端服务" -ForegroundColor Green
}

# 4. 检测并注入 Flutter 环境
Write-Host ""
Write-Host "[*] 正在检查 Flutter SDK 环境..." -ForegroundColor Yellow
$flutterCmd = Get-Command flutter -ErrorAction SilentlyContinue
if (-not $flutterCmd) {
    $candidatePaths = @(
        "D:\flutter\bin",
        "C:\flutter\bin",
        "C:\src\flutter\bin",
        "C:\tools\flutter\bin",
        "$env:LOCALAPPDATA\flutter\bin",
        "$env:USERPROFILE\flutter\bin",
        "D:\src\flutter\bin"
    )
    foreach ($p in $candidatePaths) {
        if (Test-Path "$p\flutter.bat") {
            $env:Path = "$p;$env:Path"
            Write-Host "[OK] 已自动定位并注入 Flutter SDK: $p" -ForegroundColor Green
            break
        }
    }
}

# 5. 进入移动端工程并启动
Set-Location -Path "$PSScriptRoot\aiChatMobile"

Write-Host ""
Write-Host "--------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "[*] Flutter 移动端控制台操作指南:" -ForegroundColor Cyan
Write-Host "    - [ r ] : 秒级热重载 (Hot Reload) 刷新界面状态" -ForegroundColor White
Write-Host "    - [ R ] : 完整热重启 (Hot Restart) 重置应用状态" -ForegroundColor White
Write-Host "    - [ v ] : 在浏览器打开 Flutter DevTools 性能监视器" -ForegroundColor White
Write-Host "    - [ q ] : 安全退出当前移动端应用" -ForegroundColor White
Write-Host "--------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$flutterFound = Get-Command flutter -ErrorAction SilentlyContinue
if ($flutterFound) {
    flutter run
} else {
    Write-Host "[!] 系统未找到 flutter 命令。" -ForegroundColor Red
    Write-Host "    请确认已安装 Flutter SDK 并将其 bin 目录配置到系统环境变量 PATH。" -ForegroundColor Yellow
    Write-Host "    如果您使用的是 Web/模拟器或特定路径，也可以在控制台中运行 flutter run。" -ForegroundColor Gray
    Write-Host ""
    Read-Host "按回车键退出..."
}