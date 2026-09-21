# 本地守护部署：把「GitHub 有新提交」变成「本机自动 wrangler deploy」
#
# 适用场景：GitHub Actions 尚未配置 CLOUDFLARE_API_TOKEN 时，用本机已有的 wrangler
# 登录态完成自动部署，**不需要任何 Cloudflare API Token**。
#
# 用法：
#   .\tools\watch-deploy.ps1                # 跑一轮：有远程新提交才部署
#   .\tools\watch-deploy.ps1 -Force         # 忽略状态文件，强制部署一次
#   .\tools\watch-deploy.ps1 -DryRun        # 只检查不部署（打印将要做什么）
#
# 挂成计划任务（可选，需用户自行决定）：
#   schtasks /Create /SC MINUTE /MO 5 /TN "alu-watch-deploy" `
#     /TR "powershell -NoProfile -ExecutionPolicy Bypass -File F:\Autoclaw\alu_extrusion\tools\watch-deploy.ps1"
#
# 状态与日志（均在 .openclaw/ 下，已被 .gitignore 忽略）：
#   .openclaw/watch-deploy.state   最近一次成功部署的提交 SHA
#   .openclaw/watch-deploy.log     运行日志（含每次的 Worker Version ID）

[CmdletBinding()]
param(
  [string]$Repo = 'F:\Autoclaw\alu_extrusion',
  [string]$Branch = 'main',
  [string]$Proxy = 'http://127.0.0.1:7897',
  [switch]$Force,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$stateDir = Join-Path $Repo '.openclaw'
$stateFile = Join-Path $stateDir 'watch-deploy.state'
$logFile = Join-Path $stateDir 'watch-deploy.log'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

function Write-Log([string]$msg) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Write-Host $line
  Add-Content -Path $logFile -Value $line -Encoding UTF8
}

Write-Log "---- watch-deploy 启动（Force=$Force DryRun=$DryRun）----"

# 1) 取远端最新提交
Push-Location $Repo
try {
  $env:HTTPS_PROXY = $Proxy; $env:HTTP_PROXY = $Proxy
  git fetch origin $Branch --quiet 2>$null
  if ($LASTEXITCODE -ne 0) { Write-Log "git fetch 失败（代理是否开启？）"; exit 2 }

  $remoteSha = (git rev-parse "origin/$Branch").Trim()
  $localSha = (git rev-parse HEAD).Trim()
  Write-Log "remote/$Branch=$($remoteSha.Substring(0,7))  local HEAD=$($localSha.Substring(0,7))"

  $stateSha = if (Test-Path $stateFile) { (Get-Content $stateFile -Raw).Trim() } else { '' }
  Write-Log "上次已部署=$($stateSha.Substring(0, [Math]::Min(7, $stateSha.Length)))"

  if (-not $Force -and $remoteSha -eq $stateSha) {
    Write-Log '远端无新提交，无需部署'
    exit 0
  }

  # 2) 本地工作区与远端不一致时先对齐（避免部署半成品）
  if ($localSha -ne $remoteSha) {
    $dirty = (git status --porcelain | Measure-Object).Count
    if ($dirty -gt 0) { Write-Log "本地有 $dirty 项未提交改动，为安全起见放弃本轮部署"; exit 3 }
    if ($DryRun) { Write-Log "[dry-run] 将执行 git checkout $remoteSha" } else {
      git checkout --quiet $remoteSha
      Write-Log "已检出 $($remoteSha.Substring(0,7))"
    }
  }

  # 3) 构建 + 部署
  if ($DryRun) {
    Write-Log "[dry-run] 将执行 npm run build 与 npx wrangler deploy --config wrangler.local.toml"
    exit 0
  }

  Write-Log 'npm run build ...'
  npm run build 2>&1 | ForEach-Object { $_ } | Out-String | ForEach-Object { if ($_ -match 'built in|error') { Write-Log ('  ' + $_.Trim()) } }
  if ($LASTEXITCODE -ne 0) { Write-Log '构建失败，终止'; exit 4 }

  $env:CLOUDFLARE_ACCOUNT_ID = if ($env:CLOUDFLARE_ACCOUNT_ID) { $env:CLOUDFLARE_ACCOUNT_ID } else { '' }
  Write-Log 'wrangler deploy ...'
  $out = npx wrangler deploy --config wrangler.local.toml 2>&1
  $version = ($out | Select-String -Pattern 'Current Version ID:\s*(\S+)' | ForEach-Object { $_.Matches[0].Groups[1].Value }) -join ''
  if ($LASTEXITCODE -ne 0) { Write-Log '部署失败，终止'; ($out | Select-Object -Last 5) | ForEach-Object { Write-Log ('  ' + $_) }; exit 5 }

  Write-Log "部署成功，Version ID=$version"
  Set-Content -Path $stateFile -Value $remoteSha -Encoding UTF8 -NoNewline
  Write-Log '状态文件已更新'
}
finally {
  Pop-Location
}
