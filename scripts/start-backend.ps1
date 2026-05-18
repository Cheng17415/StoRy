# Inicia el backend Spring Boot (perfil dev → Postgres en Supabase).
# Uso desde la raíz del repositorio: .\scripts\start-backend.ps1
# Requiere .env con SPRING_DATASOURCE_* (y opcionalmente GOOGLE_CLIENT_ID, RESEND_*).

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

$backendDir = (Resolve-Path (Join-Path $PSScriptRoot "..\backend")).Path
Set-Location $backendDir
Write-Host "Directorio: $backendDir" -ForegroundColor Cyan
& .\mvnw.cmd spring-boot:run @args
