$ErrorActionPreference = "Stop"

$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$Manifest = Get-Content (Join-Path $RepositoryRoot "manifest.json") -Raw | ConvertFrom-Json
$DistDirectory = Join-Path $RepositoryRoot "dist"
$StagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("dark-pdf-viewer-store-" + [Guid]::NewGuid())
$OutputFile = Join-Path $DistDirectory ("Dark-PDF-Viewer-Chrome-Web-Store-v" + $Manifest.version + ".zip")

$PackageItems = @(
  "_locales",
  "background.js",
  "icons",
  "manifest.json",
  "pdf-annotations.js",
  "pdf-source.js",
  "vendor",
  "viewer-utils.js",
  "viewer.css",
  "viewer.html",
  "viewer.js"
)

New-Item -ItemType Directory -Force -Path $DistDirectory | Out-Null
New-Item -ItemType Directory -Force -Path $StagingDirectory | Out-Null

try {
  foreach ($Item in $PackageItems) {
    Copy-Item -Recurse -Force (Join-Path $RepositoryRoot $Item) $StagingDirectory
  }
  if (Test-Path $OutputFile) {
    Remove-Item $OutputFile
  }
  Compress-Archive -Path (Join-Path $StagingDirectory "*") -DestinationPath $OutputFile -CompressionLevel Optimal
  Write-Host "Created $OutputFile"
} finally {
  Remove-Item -Recurse -Force $StagingDirectory
}
