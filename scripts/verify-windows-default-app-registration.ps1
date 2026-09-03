$ErrorActionPreference = 'Stop'

$installer = Get-ChildItem -Path 'release' -Filter '*-windows-x64-setup.exe' |
  Select-Object -First 1

if (-not $installer) {
  throw 'Windows NSIS installer was not found.'
}

Start-Process -FilePath $installer.FullName -ArgumentList '/S' -Wait

$registrationName = 'Fuxian'
$capabilitiesPath = 'Software\Fuxian\Capabilities'
$progId = 'Fuxian.Markdown'

$registeredPath = Get-ItemPropertyValue `
  -LiteralPath 'HKCU:\Software\RegisteredApplications' `
  -Name $registrationName
if ($registeredPath -ne $capabilitiesPath) {
  throw "RegisteredApplications points to '$registeredPath', expected '$capabilitiesPath'."
}

$capabilities = Get-ItemProperty -LiteralPath "HKCU:\$capabilitiesPath"
if ($capabilities.ApplicationName -ne $registrationName) {
  throw "ApplicationName is '$($capabilities.ApplicationName)', expected '$registrationName'."
}
if ([string]::IsNullOrWhiteSpace($capabilities.ApplicationDescription)) {
  throw 'ApplicationDescription is missing.'
}

$fileAssociations = Get-ItemProperty -LiteralPath "HKCU:\$capabilitiesPath\FileAssociations"
foreach ($extension in @('.md', '.markdown')) {
  if ($fileAssociations.$extension -ne $progId) {
    throw "$extension maps to '$($fileAssociations.$extension)', expected '$progId'."
  }
}

$openCommand = (
  Get-ItemProperty -LiteralPath "HKCU:\Software\Classes\$progId\shell\open\command"
).'(default)'
if ($openCommand -notmatch 'Fuxian\.exe' -or $openCommand -notmatch '%1') {
  throw "The $progId open command is invalid: $openCommand"
}

Write-Host 'Verified installed Fuxian default-app registration.'
