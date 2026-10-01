# Keys are passed only to the child process environment, never files or command arguments.
$ErrorActionPreference = 'Stop'
function Read-DeliveryKey([string]$Prompt) {
    $value = Read-Host $Prompt -AsSecureString
    try { return [System.Net.NetworkCredential]::new('', $value).Password.Trim() }
    finally { $value.Dispose() }
}
try {
    $env:DELIVERY_TEST_PUBLIC_URL = (Read-Host 'Public HTTPS origin (https://...ngrok-free.app)').Trim()
    $env:DELIVERY_TEST_CLIENT_ID = Read-DeliveryKey 'Client ID (hidden)'
    $env:DELIVERY_TEST_CLIENT_SECRET = Read-DeliveryKey 'Client Secret (hidden)'
    & node (Join-Path $PSScriptRoot 'delivery-webhook.mjs')
} finally {
    Remove-Item Env:DELIVERY_TEST_CLIENT_ID -ErrorAction SilentlyContinue
    Remove-Item Env:DELIVERY_TEST_CLIENT_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:DELIVERY_TEST_PUBLIC_URL -ErrorAction SilentlyContinue
}
