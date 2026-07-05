$ErrorActionPreference = "Stop"

$ProjectRoot = "F:\College\Hackathon\tata"
$OutputDir = Join-Path $ProjectRoot "outputs\feeds"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$InitializeBody = @{
  jsonrpc = "2.0"
  id = 1
  method = "initialize"
  params = @{
    protocolVersion = "2025-06-18"
    capabilities = @{}
    clientInfo = @{ name = "codex-feed-capture"; version = "1.0.0" }
  }
} | ConvertTo-Json -Depth 20

$Init = Invoke-WebRequest `
  -Uri "http://127.0.0.1:8000/mcp" `
  -Method Post `
  -Body $InitializeBody `
  -ContentType "application/json" `
  -Headers @{ Accept = "application/json, text/event-stream" } `
  -UseBasicParsing `
  -TimeoutSec 10

$Session = $Init.Headers["Mcp-Session-Id"]

Invoke-WebRequest `
  -Uri "http://127.0.0.1:8000/mcp" `
  -Method Post `
  -Body (@{ jsonrpc = "2.0"; method = "notifications/initialized"; params = @{} } | ConvertTo-Json -Depth 20) `
  -ContentType "application/json" `
  -Headers @{ Accept = "application/json, text/event-stream"; "Mcp-Session-Id" = $Session } `
  -UseBasicParsing `
  -TimeoutSec 10 | Out-Null

$Annotations = @{
  gridSpacing = 0
  gridExtent = 0
  gridHeight = 0
  maxLabelDistance = 0
  classFilter = $null
  maxLabels = 0
}

$Feeds = @(
  @{ File = "overview.png"; Location = @{ x = 0; y = 0; z = 16000 }; Rotation = @{ pitch = -90; yaw = 0; roll = 0 } },
  @{ File = "cctv_haul_road.png"; Location = @{ x = -4200; y = -2400; z = 1250 }; Rotation = @{ pitch = -18; yaw = 42; roll = 0 } },
  @{ File = "cctv_excavator_pit.png"; Location = @{ x = 2100; y = -3300; z = 1350 }; Rotation = @{ pitch = -20; yaw = 138; roll = 0 } },
  @{ File = "cctv_crane_zone.png"; Location = @{ x = 3600; y = 2500; z = 1500 }; Rotation = @{ pitch = -22; yaw = -140; roll = 0 } },
  @{ File = "truck_rear.png"; Location = @{ x = -1800; y = -1350; z = 420 }; Rotation = @{ pitch = -8; yaw = 180; roll = 0 } },
  @{ File = "drone_skycam.png"; Location = @{ x = -950; y = -1300; z = 3600 }; Rotation = @{ pitch = -56; yaw = 38; roll = 0 } },
  @{ File = "rover_fieldcam.png"; Location = @{ x = -3150; y = -500; z = 185 }; Rotation = @{ pitch = -6; yaw = 24; roll = 0 } }
)

function Invoke-McpTool {
  param(
    [string]$Name,
    [hashtable]$Arguments,
    [int]$Id
  )

  $Body = @{
    jsonrpc = "2.0"
    id = $Id
    method = "tools/call"
    params = @{
      name = $Name
      arguments = $Arguments
    }
  } | ConvertTo-Json -Depth 30

  $Response = Invoke-WebRequest `
    -Uri "http://127.0.0.1:8000/mcp" `
    -Method Post `
    -Body $Body `
    -ContentType "application/json" `
    -Headers @{ Accept = "application/json, text/event-stream"; "Mcp-Session-Id" = $Session } `
    -UseBasicParsing `
    -TimeoutSec 45

  $DataLine = ($Response.Content -split "`n" | Where-Object { $_.StartsWith("data: ") } | Select-Object -First 1)
  if (-not $DataLine) {
    throw "MCP response did not include an SSE data line."
  }
  return ($DataLine.Substring(6) | ConvertFrom-Json)
}

$Id = 10
foreach ($Feed in $Feeds) {
  $Arguments = @{
    captureTransform = @{
      location = $Feed.Location
      rotation = $Feed.Rotation
      scale = @{ x = 1; y = 1; z = 1 }
    }
    annotations = $Annotations
    bShowUI = $false
  }
  $Result = Invoke-McpTool -Name "EditorToolset.EditorAppToolset.CaptureViewport" -Arguments $Arguments -Id $Id
  $Id += 1
  $TextPayload = $Result.result.content[0].text | ConvertFrom-Json
  $Image = $TextPayload.returnValue.image
  $OutFile = Join-Path $OutputDir $Feed.File
  [System.IO.File]::WriteAllBytes($OutFile, [Convert]::FromBase64String($Image.data))
  Write-Output "Captured $($Feed.File)"
}
