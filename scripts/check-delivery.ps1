# One-off V2 query. No files, database writes, webhook registration or retries.
# https://tracker.delivery/docs/authentication
# https://tracker.delivery/docs/tracking-api
$ErrorActionPreference = 'Stop'
$deliveryId = $null
$deliverySecret = $null
$deliveryNumber = $null
$deliveryHeaders = $null
$deliveryBody = $null
$deliveryResponse = $null
$deliveryFailed = $false

function Read-DeliveryPrivateValue([string]$Prompt) {
    $secureValue = Read-Host $Prompt -AsSecureString
    try {
        return [System.Net.NetworkCredential]::new('', $secureValue).Password.Trim()
    } finally {
        $secureValue.Dispose()
    }
}

try {
    $deliveryId = Read-DeliveryPrivateValue 'Client ID (hidden)'
    $deliverySecret = Read-DeliveryPrivateValue 'Client Secret (hidden)'
    $deliveryNumber = Read-DeliveryPrivateValue 'Coupang tracking number (hidden)'
    if (!$deliveryId -or !$deliverySecret -or $deliveryNumber -notmatch '^\d{8,30}$') {
        throw 'INVALID_INPUT'
    }
    $deliveryQuery = @'
query CheckDelivery($carrierId: ID!, $trackingNumber: String!) {
  track(carrierId: $carrierId, trackingNumber: $trackingNumber) {
    lastEvent { time status { code } }
    events(last: 10) { edges { node { time status { code } } } }
  }
}
'@
    $deliveryBody = @{
        query = $deliveryQuery
        variables = @{ carrierId = 'kr.coupangls'; trackingNumber = $deliveryNumber }
    } | ConvertTo-Json -Depth 5 -Compress
    $deliveryHeaders = @{ Authorization = "TRACKQL-API-KEY ${deliveryId}:${deliverySecret}" }
    $deliveryResponse = Invoke-RestMethod -Uri 'https://apis.tracker.delivery/graphql' `
        -Method Post -Headers $deliveryHeaders -ContentType 'application/json' `
        -Body $deliveryBody -TimeoutSec 15 -MaximumRedirection 0
    if ($deliveryResponse.errors) {
        # Do not print provider error messages: they may echo request data.
        Write-Output 'RESULT: GRAPHQL_ERROR (authentication, query or provider failure).'
        $deliveryFailed = $true
    } elseif (!$deliveryResponse.data.track.lastEvent) {
        Write-Output 'RESULT: NO_TRACKING_EVENT (not proof of pending delivery).'
        $deliveryFailed = $true
    } else {
        [pscustomobject]@{
            result = 'OK'
            carrier = 'kr.coupangls'
            lastEvent = $deliveryResponse.data.track.lastEvent
            events = @($deliveryResponse.data.track.events.edges | ForEach-Object { $_.node })
        } | ConvertTo-Json -Depth 6
    }
} catch {
    # Never echo the exception/request/headers or response body containing private data.
    Write-Output 'RESULT: REQUEST_FAILED (check inputs, network and API credentials).'
    $deliveryFailed = $true
} finally {
    if ($deliveryHeaders) { $deliveryHeaders.Clear() }
    $deliveryId = $deliverySecret = $deliveryNumber = $deliveryBody = $deliveryResponse = $null
}
if ($deliveryFailed) { exit 1 }
