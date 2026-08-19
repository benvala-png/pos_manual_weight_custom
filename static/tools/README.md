# Outils poste de caisse (Windows)

`setup_balance_autostart.ps1` — enregistre le serveur HTTP de la balance
(script Python/Flask sur le port 5000 du PC de caisse) en **tâche planifiée
Windows**, déclenchée au démarrage du poste et à l'ouverture de session.

Sans cette tâche, un simple redémarrage de Windows laisse la balance muette :
`manual_weight.js` échoue en silence sur `localhost:5000` et la caisse retombe
sur la saisie manuelle des grammes sans afficher d'erreur.

À lancer **sur le PC de caisse**, PowerShell **en administrateur**, de
préférence pendant que la balance fonctionne (le script relit alors la ligne de
commande du processus à l'écoute et la rejoue à l'identique, arguments COM et
baud compris).

```powershell
$u = "http://192.168.129.19:8069/pos_manual_weight_custom/static/tools/setup_balance_autostart.ps1"
Invoke-WebRequest $u -OutFile "$env:TEMP\setup_balance_autostart.ps1"
Unblock-File "$env:TEMP\setup_balance_autostart.ps1"
Set-ExecutionPolicy -Scope Process Bypass -Force
& "$env:TEMP\setup_balance_autostart.ps1"
```

## Si le script Python est sur le Bureau

C'est le cas au 19/08/2026. L'installeur le trouve (le Bureau est le premier
dossier fouillé), mais l'emplacement est fragile : un glisser-déposé suffit à
casser la balance.

- **Bureau classique** → simple avertissement, l'installation continue.
- **Bureau redirigé vers OneDrive** → l'installeur **s'arrête**. Au démarrage du
  PC, OneDrive peut ne pas avoir encore réhydraté le fichier (« fichiers à la
  demande ») : la tâche échouerait et la balance resterait muette, exactement le
  problème qu'on cherche à supprimer.

Pour le ranger dans un dossier local stable (`C:\IPELLE\balance` par défaut) :

```powershell
& "$env:TEMP\setup_balance_autostart.ps1" -Relocate
```

Le script est **déplacé** (pas copié), le serveur en cours est arrêté le temps du
déplacement, la ligne de commande de la tâche est réécrite vers le nouveau
chemin, et la commande de retour arrière est affichée à l'écran.

Retour arrière :

```powershell
Unregister-ScheduledTask -TaskName "IPELLE-Balance-POS" -Confirm:$false
```

Voir `STATUS.md` ÉTAPE 79.
