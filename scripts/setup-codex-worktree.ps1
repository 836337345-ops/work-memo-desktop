$ErrorActionPreference = 'Stop'

$worktreeRoot = (Resolve-Path -LiteralPath '.').Path
$commonGit = (git rev-parse --git-common-dir).Trim()
if (-not [System.IO.Path]::IsPathRooted($commonGit)) {
  $commonGit = Join-Path $worktreeRoot $commonGit
}
$mainRoot = (Resolve-Path -LiteralPath (Split-Path -Parent $commonGit)).Path

if ($worktreeRoot -eq $mainRoot) {
  Write-Output '当前为主工作目录，无需初始化。'
  exit 0
}

$nodeSource = Join-Path $mainRoot 'node_modules'
$nodeLink = Join-Path $worktreeRoot 'node_modules'
$sharedCache = Join-Path $mainRoot '.worktree-cache'
$rustSource = Join-Path $sharedCache 'cargo-target'
$rustLink = Join-Path $worktreeRoot 'src-tauri\target'

if (-not (Test-Path -LiteralPath $nodeSource)) {
  throw "主项目依赖不存在，请先在主工作目录运行 npm install：$nodeSource"
}

if (-not (Test-Path -LiteralPath $sharedCache)) {
  New-Item -ItemType Directory -Path $sharedCache | Out-Null
}
if (-not (Test-Path -LiteralPath $rustSource)) {
  New-Item -ItemType Directory -Path $rustSource | Out-Null
}

if (-not (Test-Path -LiteralPath $nodeLink)) {
  New-Item -ItemType Junction -Path $nodeLink -Target $nodeSource | Out-Null
}
if (-not (Test-Path -LiteralPath $rustLink)) {
  New-Item -ItemType Junction -Path $rustLink -Target $rustSource | Out-Null
}

Write-Output "工作树依赖已就绪：$worktreeRoot"
