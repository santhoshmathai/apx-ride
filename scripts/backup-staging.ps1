param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\backups')
)

$ErrorActionPreference = 'Stop'
$resolvedRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$databaseFile = Join-Path $resolvedOutput "apx-ride-staging-$stamp.sql"

Push-Location $resolvedRoot
try {
  & .\node_modules\.bin\wrangler.cmd d1 export apx-ride-staging --remote --output $databaseFile --skip-confirmation
  if ($LASTEXITCODE -ne 0) { throw "D1 export failed with exit code $LASTEXITCODE" }
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $databaseFile).Hash.ToLowerInvariant()
  $manifest = [ordered]@{
    createdAt = (Get-Date).ToUniversalTime().ToString('o')
    database = 'apx-ride-staging'
    sqlFile = [System.IO.Path]::GetFileName($databaseFile)
    sha256 = $hash
    note = 'Store this export outside Cloudflare using encrypted storage. R2 objects require a separate S3-compatible sync.'
  }
  $manifest | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath "$databaseFile.manifest.json"
  Write-Host "D1 backup created: $databaseFile"
  Write-Host "SHA-256: $hash"
}
finally { Pop-Location }
