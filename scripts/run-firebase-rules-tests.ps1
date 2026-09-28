$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$javaHome = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools') -Directory -Filter 'jdk-*' |
  Select-Object -First 1 -ExpandProperty FullName

if (-not $javaHome) {
  throw 'No se encontró Java portátil en .tools. Ejecutá la preparación local antes de las pruebas.'
}

$env:JAVA_HOME = $javaHome
$env:Path = "$(Join-Path $javaHome 'bin');$env:Path"
$env:FIREBASE_EMULATORS_PATH = Join-Path $projectRoot '.tools\firebase-emulators'
$env:XDG_CONFIG_HOME = Join-Path $projectRoot '.tools\config'
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK = 'true'
$env:GOOGLE_CLOUD_PROJECT = 'demo-dnd-app'
$env:GOOGLE_APPLICATION_CREDENTIALS = $null
$env:CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE = $null
$env:FIREBASE_TOKEN = $null
$firebase = Join-Path $projectRoot 'node_modules\.bin\firebase.cmd'

& $firebase emulators:exec --non-interactive --project demo-dnd-app --only firestore,storage 'node --test tests/firebase-rules.test.cjs'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
