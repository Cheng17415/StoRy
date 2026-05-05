# Inicia el frontend Angular (puerto 4200, proxy a http://localhost:8080).
# Uso desde la raíz del repositorio: .\scripts\start-frontend.ps1
# Si existe .env en la raíz del repo, carga variables (útil si otras herramientas las leen).

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $repoRoot ".env"
if (Test-Path $envPath) {
    Get-Content $envPath -Encoding utf8 | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -eq 0 -or $line.StartsWith("#")) {
            return
        }
        $eq = $line.IndexOf("=")
        if ($eq -lt 1) {
            return
        }
        $key = $line.Substring(0, $eq).Trim()
        $val = $line.Substring($eq + 1).Trim()
        if ($val.Length -ge 2) {
            $fc = $val.Substring(0, 1)
            $lc = $val.Substring($val.Length - 1, 1)
            if (($fc -eq '"' -and $lc -eq '"') -or ($fc -eq "'" -and $lc -eq "'")) {
                $val = $val.Substring(1, $val.Length - 2)
            }
        }
        [Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
}

$frontendDir = (Resolve-Path (Join-Path $PSScriptRoot "..\frontend")).Path
Set-Location $frontendDir
Write-Host "Directorio: $frontendDir" -ForegroundColor Cyan
Write-Host "Google Sign-In: configura GOOGLE_CLIENT_ID en .env y arranca el backend; el cliente lee /api/auth/google-config." -ForegroundColor DarkGray
npm run start -- @args
