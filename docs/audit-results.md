# Post-migration audit results

**Generated:** 2026-05-30T12:55:24.366Z
**Branch:** connect-mobile @ `51b8661`
**Gate:** ✅ PASS

| Task | Status | Summary |
|------|--------|---------|
| 1 | ⚠️ warn | 4 external scanner importers |
| 2 | ⏭️ skip | no Supabase credentials (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) |
| 3 | ✅ pass | ccai-connect, ccai-pay, extension, signing, types |
| 4 | ⏭️ skip | B2B smoke target unreachable (no running server) |
| 5 | ✅ pass | words=1588 |

## Details

```json
[
  {
    "task": 1,
    "status": "warn",
    "details": {
      "externalImporters": [
        "lib/types/platform-scan-api.ts",
        "lib/solana/connection.ts",
        "lib/sentinel/merge-canonical-institutional.ts",
        "lib/api/scan-request-security.ts"
      ],
      "count": 4,
      "highRiskViolations": [],
      "madgeModuleCount": 52,
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
