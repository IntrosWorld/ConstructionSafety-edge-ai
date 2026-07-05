# Construction Safety Edge-AI Dashboard

Browser dashboard prototype for the Edge-AI construction-site digital twin.

## Run locally

From the repository root:

```powershell
python -m http.server 5173 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/dashboard/
```

## Included

- Multi-camera Unreal feed dashboard
- Risk score, latency, explainable alerts, validation status, and edge camera health
- Captured feed images under `outputs/feeds`
- Optional feed refresh helper: `Scripts/capture_feeds_mcp.ps1`
