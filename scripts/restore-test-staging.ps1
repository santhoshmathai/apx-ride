param(
  [Parameter(Mandatory = $true)][string]$SqlFile,
  [string]$DatabaseName = "apx-ride-restore-test-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
)

$ErrorActionPreference = 'Stop'
$resolvedRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$resolvedSql = [System.IO.Path]::GetFullPath($SqlFile)
if (-not (Test-Path -LiteralPath $resolvedSql -PathType Leaf)) { throw "Backup file not found: $resolvedSql" }

Push-Location $resolvedRoot
try {
  Write-Host "Creating isolated restore database: $DatabaseName"
  & .\node_modules\.bin\wrangler.cmd d1 create $DatabaseName --jurisdiction eu
  if ($LASTEXITCODE -ne 0) { throw "D1 database creation failed with exit code $LASTEXITCODE" }
  & .\node_modules\.bin\wrangler.cmd d1 execute $DatabaseName --remote --file $resolvedSql --yes
  if ($LASTEXITCODE -ne 0) { throw "D1 restore failed with exit code $LASTEXITCODE" }
  & .\node_modules\.bin\wrangler.cmd d1 execute $DatabaseName --remote --command "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;" --json
  if ($LASTEXITCODE -ne 0) { throw "D1 restore verification failed with exit code $LASTEXITCODE" }
  Write-Host "Restore verified. The isolated database was retained for inspection: $DatabaseName"
  Write-Host "Delete it from Cloudflare only after the recovery evidence has been reviewed."
}
finally { Pop-Location }
