# Post-migration audit results

**Generated:** 2026-05-30T16:53:09.592Z
**Branch:** connect-mobile @ `326ff01`
**Gate:** ✅ PASS

| Task | Status | Summary |
|------|--------|---------|
| 1 | ❌ fail | 8 external scanner importers |
| 2 | ⏭️ skip | no Supabase credentials (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) |
| 3 | ✅ pass | ccai-connect, ccai-pay, extension, signing, types |
| 4 | ⏭️ skip | B2B smoke target unreachable (no running server) |
| 5 | ✅ pass | words=1588 |

## Details

```json
[
  {
    "task": 1,
    "status": "fail",
    "details": {
      "externalImporters": [
        "lib/types/institutional-scan-api.ts",
        "lib/types/platform-scan-api.ts",
        "lib/cache/scan-cache.ts",
        "lib/solana/connection.ts",
        "lib/sentinel/merge-canonical-institutional.ts",
        "lib/api/scan-request-security.ts",
        "lib/services/reasoning-cache.ts",
        "lib/services/audit-report.service.ts"
      ],
      "count": 8,
      "highRiskViolations": [],
      "madgeModuleCount": 51,
      "passGate": "0 external importers; warn 1–5; fail 6+ or HIGH-RISK scanner imports"
    }
  },
  {
    "task": 2,
    "status": "skip",
    "details": {
      "reason": "no Supabase credentials (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)"
    }
  },
  {
    "task": 3,
    "status": "pass",
    "details": {
      "packages": {
        "ccai-connect": {
          "atImports": [],
          "tscOk": true
        },
        "ccai-pay": {
          "atImports": [],
          "tscOk": true
        },
        "extension": {
          "atImports": [],
          "tscOk": true
        },
        "signing": {
          "atImports": [],
          "tscOk": true
        },
        "types": {
          "atImports": [],
          "tscOk": true
        }
      }
    }
  },
  {
    "task": 4,
    "status": "skip",
    "details": {
      "reason": "B2B smoke target unreachable (no running server)",
      "error": "fetch failed"
    }
  },
  {
    "task": 5,
    "status": "pass",
    "details": {
      "wordCount": 1588,
      "missingSections": [],
      "path": "docs/architecture.md"
    }
  }
]
```
