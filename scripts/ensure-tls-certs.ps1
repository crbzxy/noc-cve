$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'certs'
$certPath = Join-Path $dir 'cert.pem'
$keyPath = Join-Path $dir 'key.pem'

if ((Test-Path $certPath) -and (Test-Path $keyPath)) {
  Write-Host 'TLS ya existe en certs/cert.pem'
  exit 0
}

New-Item -ItemType Directory -Force -Path $dir | Out-Null

$cert = New-SelfSignedCertificate `
  -Subject 'CN=noc-cve-dashboard' `
  -TextExtension @('2.5.29.17={text}DNS=localhost&DNS=noc-cve-dashboard&IPAddress=127.0.0.1&IPAddress=172.21.1.140') `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyExportPolicy Exportable `
  -KeySpec Signature `
  -NotAfter (Get-Date).AddYears(2)

$pwd = ConvertTo-SecureString -String 'noc-cve-temp' -Force -AsPlainText
$pfx = Join-Path $dir 'tmp.pfx'
Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pwd | Out-Null

$pfxData = Get-PfxData -FilePath $pfx -Password $pwd
$leaf = $pfxData.EndEntityCertificates[0]

$certBytes = $leaf.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$certB64 = [Convert]::ToBase64String($certBytes, 'InsertLineBreaks')
@(
  '-----BEGIN CERTIFICATE-----'
  $certB64
  '-----END CERTIFICATE-----'
) | Set-Content -Path $certPath -Encoding ascii

$rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($leaf)
if (-not $rsa) { throw 'No se pudo exportar la llave privada RSA' }
$keyBytes = $rsa.ExportPkcs8PrivateKey()
$keyB64 = [Convert]::ToBase64String($keyBytes, 'InsertLineBreaks')
@(
  '-----BEGIN PRIVATE KEY-----'
  $keyB64
  '-----END PRIVATE KEY-----'
) | Set-Content -Path $keyPath -Encoding ascii

Remove-Item $pfx -Force
Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force
Set-Content -Path (Join-Path $dir 'README.txt') -Value "Autofirmados para QA. Sustituye por PEM corporativos en prod.`n"
Write-Host 'TLS generado → certs/cert.pem + certs/key.pem'
