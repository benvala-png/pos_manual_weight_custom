# =====================================================================
#  IPELLE - Demarrage automatique du serveur de balance du POS (port 5000)
#
#  A lancer SUR LE PC DE CAISSE (LESIDEES2), dans PowerShell EN ADMINISTRATEUR.
#  Idempotent : peut etre relance sans risque.
#
#  Le plus fiable est de le lancer PENDANT QUE LA BALANCE FONCTIONNE : le script
#  lit alors la ligne de commande du processus qui ecoute sur le port 5000 et la
#  rejoue telle quelle (arguments COM/baud compris).
#
#  Retour arriere :
#    Unregister-ScheduledTask -TaskName "IPELLE-Balance-POS" -Confirm:$false
#  Voir STATUS.md ETAPE 79.
# =====================================================================
param(
    # Chemin du script de la balance, si la detection automatique echoue
    [string]$ScriptPath,

    # Deplace le script vers un dossier local stable (C:\IPELLE\balance) avant
    # d'enregistrer la tache. Recommande si le script est sur le Bureau, et
    # INDISPENSABLE si le Bureau est redirige vers OneDrive.
    [switch]$Relocate,

    # Dossier de destination utilise par -Relocate
    [string]$Destination = "C:\IPELLE\balance"
)

$ErrorActionPreference = "Stop"
$TaskName = "IPELLE-Balance-POS"

function Say($m) { Write-Host $m }
function Ok($m)  { Write-Host "  [OK]    $m" -ForegroundColor Green }
function Bad($m) { Write-Host "  [ECHEC] $m" -ForegroundColor Red }
function Note($m){ Write-Host "  [note]  $m" -ForegroundColor Yellow }

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Bad "Cette fenetre PowerShell n'est pas en administrateur."
    Note "Menu Demarrer > tape powershell > clic droit > Executer en tant qu'administrateur."
    exit 1
}

Say ""
Say "=== 1. Identification du serveur de balance ==="

$script  = $null    # chemin du .py
$fullCmd = $null    # ligne de commande a rejouer telle quelle
$pyName  = $null    # nom du .py si seul un chemin relatif est connu

if ($ScriptPath) {
    if (-not (Test-Path $ScriptPath)) { Bad "Chemin fourni introuvable : $ScriptPath"; exit 1 }
    $script = (Resolve-Path $ScriptPath).Path
    Ok "Chemin fourni en parametre : $script"
}

try {
    $conn = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction Stop | Select-Object -First 1
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($conn.OwningProcess)"
    Ok "Processus a l'ecoute : PID $($proc.ProcessId)"
    Say "          Executable : $($proc.ExecutablePath)"
    Say "          Ligne cmd  : $($proc.CommandLine)"
    $fullCmd = $proc.CommandLine
    $exePath = $proc.ExecutablePath

    if (-not $script) {
        # 1. chemin absolu entre guillemets (tolere les espaces)
        $m = [regex]::Match($fullCmd, '"([A-Za-z]:\\[^"]+?\.py)"')
        # 2. sinon chemin absolu sans guillemets (donc sans espace)
        if (-not $m.Success) { $m = [regex]::Match($fullCmd, '([A-Za-z]:\\[^"\s]+?\.py)') }
        if ($m.Success) { $script = $m.Groups[1].Value }
        else {
            # 3. argument relatif : on retient le nom, on le cherchera sur le disque
            $m2 = [regex]::Match($fullCmd, '([^\s"\\/]+\.py)')
            if ($m2.Success) { $pyName = $m2.Groups[1].Value; Note "Chemin relatif ($pyName) : recherche sur le disque." }
        }
    }
} catch {
    Note "Rien n'ecoute sur le port 5000 : le serveur est arrete."
    Note "Les eventuels arguments (COM, baud) ne pourront pas etre devines."
}

if (-not $script) {
    Say "  Recherche sur le disque (peut prendre 1 a 2 minutes)..."
    $roots = @("$env:USERPROFILE", "C:\Scripts", "C:\balance", "C:\IPELLE", "C:\")
    foreach ($r in $roots) {
        if (-not (Test-Path $r)) { continue }
        if ($pyName) {
            $hit = Get-ChildItem -Path $r -Filter $pyName -Recurse -ErrorAction SilentlyContinue |
                   Select-Object -First 1
        } else {
            $hit = Get-ChildItem -Path $r -Filter *.py -Recurse -ErrorAction SilentlyContinue |
                   Where-Object { $_.Length -lt 200KB } |
                   Where-Object { $c = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
                                  $c -match 'weight' -and $c -match 'Flask|route\(' } |
                   Select-Object -First 1
        }
        if ($hit) { $script = $hit.FullName; break }
    }
}

if (-not $script) {
    Bad "Script de la balance introuvable."
    Note "Retrouve-le a la main (un .py contenant 'weight'), puis relance ainsi :"
    Note "  .\setup_balance_autostart.ps1 -ScriptPath 'C:\chemin\vers\le_script.py'"
    exit 1
}
Ok "Script de la balance : $script"

# --- emplacement fragile ? -------------------------------------------
$onDesktop = $script -imatch '\\(Desktop|Bureau)\\'
$onOneDrive= $script -imatch 'OneDrive'
if ($onOneDrive) {
    Bad "Le script est dans un dossier synchronise OneDrive :"
    Say "        $script"
    Note "Au demarrage du PC, OneDrive peut ne pas avoir encore reconstitue le fichier"
    Note "(mode 'fichiers a la demande') : la tache echouerait et la balance resterait muette."
    if (-not $Relocate) {
        Bad "Relance avec -Relocate pour le deplacer vers un dossier local stable :"
        Note "  .\setup_balance_autostart.ps1 -Relocate"
        exit 1
    }
} elseif ($onDesktop -and -not $Relocate) {
    Note "Le script est sur le Bureau : un glisser-deposer suffit a casser la balance."
    Note "Pour le ranger dans $Destination, relance avec -Relocate (facultatif)."
}

if ($Relocate) {
    Say ""
    Say "=== Relocalisation vers un dossier local stable ==="
    if (-not (Test-Path $Destination)) { New-Item -ItemType Directory -Path $Destination -Force | Out-Null }
    $target = Join-Path $Destination (Split-Path $script -Leaf)
    if ($script -ieq $target) {
        Ok "Deja au bon endroit : $target"
    } else {
        if (Test-Path $target) {
            $bak = "$target.$(Get-Date -Format yyyyMMdd-HHmmss).bak"
            Move-Item -Path $target -Destination $bak
            Note "Un fichier du meme nom existait : sauvegarde en $bak"
        }
        # arreter le serveur avant de deplacer son propre fichier
        if ($conn) {
            Note "Arret du serveur en cours (PID $($conn.OwningProcess)) le temps du deplacement..."
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        Move-Item -Path $script -Destination $target
        Ok "Deplace : $script"
        Say "             -> $target"
        Note "Retour arriere : Move-Item '$target' '$script'"
        if ($fullCmd) { $fullCmd = $fullCmd.Replace($script, $target) }
        $script = $target
    }
}

$workdir = Split-Path $script -Parent

# --- interpreteur -----------------------------------------------------
if (-not $fullCmd) {
    if (-not $exePath -or -not (Test-Path $exePath)) {
        $exePath = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
    }
    if (-not $exePath) { Bad "python.exe introuvable dans le PATH."; exit 1 }
    $fullCmd = '"{0}" "{1}"' -f $exePath, $script
    Note "Ligne de commande reconstruite (sans arguments) : $fullCmd"
}

# pythonw.exe = pas de fenetre console noire sur l'ecran de la caisse
if ($fullCmd -imatch 'python\.exe') {
    $cand = $fullCmd -ireplace 'python\.exe', 'pythonw.exe'
    $exeCand = [regex]::Match($cand, '^"?([^"]+?pythonw\.exe)"?').Groups[1].Value
    if ($exeCand -and (Test-Path $exeCand)) { $fullCmd = $cand; Ok "Bascule sur pythonw.exe (aucune fenetre a l'ecran)." }
    else { Note "pythonw.exe absent : une fenetre console restera ouverte." }
}
Say "  Commande retenue : $fullCmd"

Say ""
Say "=== 2. Lanceur avec garde anti-doublon ==="
# Sans cette garde, un 2e exemplaire se disputerait le port COM de la balance.
$launcher = Join-Path $workdir "balance_autostart.cmd"
@"
@echo off
rem Genere par setup_balance_autostart.ps1 (IPELLE) - ne pas modifier a la main.
rem Ne lance rien si quelque chose ecoute deja sur le port 5000.
netstat -ano | findstr /R /C:"LISTENING" | findstr ":5000 " >nul 2>&1
if %errorlevel%==0 exit /b 0
cd /d "$workdir"
$fullCmd
"@ | Set-Content -Path $launcher -Encoding ASCII
Ok "Lanceur ecrit : $launcher"

Say ""
Say "=== 3. Tache planifiee ==="
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Note "Ancienne tache du meme nom supprimee (reinstallation)."
}
$action    = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$launcher`"" -WorkingDirectory $workdir
$trigStart = New-ScheduledTaskTrigger -AtStartup
$trigLogon = New-ScheduledTaskTrigger -AtLogOn
# S4U : s'execute meme sans session ouverte, sans avoir a stocker de mot de passe
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
               -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
               -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigStart,$trigLogon `
    -Principal $principal -Settings $settings `
    -Description "Serveur HTTP de la balance du POS IPELLE (port 5000). Voir STATUS.md ETAPE 79." | Out-Null
Ok "Tache '$TaskName' enregistree : au demarrage du PC + a l'ouverture de session."

Say ""
Say "=== 4. Verification ==="
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 5
try {
    $r = Invoke-WebRequest -Uri "http://localhost:5000/weight" -TimeoutSec 5 -UseBasicParsing
    Ok "http://localhost:5000/weight -> HTTP $($r.StatusCode) : $($r.Content.Trim())"
    Say ""
    Write-Host "TERMINE. La balance redemarrera desormais toute seule avec le PC." -ForegroundColor Green
    Note "Test reel : redemarre le poste sans ouvrir de session, puis pese un article."
} catch {
    Bad "localhost:5000 ne repond pas : $($_.Exception.Message)"
    Note "Historique : Planificateur de taches > Bibliotheque > $TaskName"
    Note "Test manuel dans une fenetre cmd : $launcher"
}

Say ""
Say "Etat de la tache :"
Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo |
    Format-List TaskName, LastRunTime, LastTaskResult, NumberOfMissedRuns
