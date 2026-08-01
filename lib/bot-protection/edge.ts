import { NextResponse, type NextRequest } from 'next/server'
import { isSearchEngineCrawler } from '@/lib/bot-protection/allowlists'
import {
  incrRequestsLastMinute,
  isBlacklistedIp,
  learnFingerprint,
  logBlockedRequest,
} from '@/lib/bot-protection/edge-store'
import {
  computeBotScore,
  headerAnomalyFromHeaders,
  resolveConfig,
} from '@/lib/bot-protection/score'
import type { BotScoreResult, UserTier } from '@/lib/bot-protection/types'
import { pickClientIp } from '@/lib/page-views/capture'

function readTier(req: NextRequest): UserTier {
  // Lightweight cookie/header signals only — no DB in the hot path.
  if (req.cookies.get('ccai_premium')?.value === '1') return 'premium'
  if (req.cookies.get('ccai_session')?.value || req.cookies.get('sb-access-token')?.value) {
    return 'logged'
  }
  const auth = req.headers.get('authorization')
  const apiKey = req.headers.get('x-api-key')
  if (auth || apiKey || req.headers.get('x-cryptocheck-signature')) return 'api_key'
  return 'anonymous'
}

function hasApiCredentials(req: NextRequest): boolean {
  return Boolean(
    req.headers.get('authorization') ||
      req.headers.get('x-api-key') ||
      req.headers.get('x-cryptocheck-signature'),
  )
}

function bypassPath(pathname: string): boolean {
  if (
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/sitemap-') ||
    pathname.startsWith('/sitemap/')
  ) {
    return true
  }
  if (pathname.startsWith('/_next/')) return true
  if (pathname.startsWith('/.well-known/')) return true
  // Static assets
  if (/\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|map|txt|xml)$/i.test(pathname)) return true
  return false
}

function challengeHtml(stage: number, botScore: number): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>Security Check · CryptoCheckAI</title>
<meta name="robots" content="noindex"/>
<style>body{font-family:ui-monospace,monospace;background:#050510;color:#cbd5e1;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:28rem;padding:2rem;border:1px solid rgba(255,255,255,.08)}h1{font-size:1rem;color:#c8ff00;letter-spacing:.12em;text-transform:uppercase}p{font-size:.8rem;line-height:1.5;color:#94a3b8}button{margin-top:1rem;background:#c8ff00;color:#050510;border:0;padding:.6rem 1rem;font-weight:700;cursor:pointer}</style>
</head><body><main><h1>Browser verification</h1><p>CryptoCheckAI progressive defense stage ${stage}. Complete this check to continue. Search engine crawlers are never challenged.</p>
<button id="c" type="button">Continue</button>
<script>
(function(){
  var t0 = performance.now();
  document.getElementById('c').onclick = function(){
    var dt = performance.now() - t0;
    document.cookie = 'ccai_bp_ok=1; Max-Age=1800; Path=/; SameSite=Lax';
    document.cookie = 'ccai_bp_nav=' + Math.round(dt) + '; Max-Age=1800; Path=/; SameSite=Lax';
    location.reload();
  };
})();
</script></main></body></html><!-- score:${botScore} -->`
}

function applySlowHeaders(res: NextResponse, score: number): NextResponse {
  // Soft slowdown signal for CDN / clients without burning server time
  res.headers.set('X-CCAI-BotScore', String(score))
  res.headers.set('Cache-Control', 'no-store')
  res.headers.set('X-CCAI-Defense', 'slow')
  return res
}

export type EdgeBotResult = {
  response?: NextResponse
  result: BotScoreResult
}

/**
 * Edge bot protection entry — fail open on store errors.
 * Legitimate traffic target: &lt;5ms when Redis warm / skippable.
 */
export async function runEdgeBotProtection(req: NextRequest): Promise<EdgeBotResult> {
  const cfg = resolveConfig()
  const pathname = req.nextUrl.pathname

  if (!cfg.enabled || bypassPath(pathname)) {
    return {
      result: {
        botScore: 0,
        decision: 'allow',
        stage: 0,
        reasons: ['bypass'],
        crawlerAllowlisted: false,
        aiScraper: false,
        tier: 'anonymous',
      },
    }
  }

  const ua = req.headers.get('user-agent')
  if (isSearchEngineCrawler(ua)) {
    return {
      result: {
        botScore: 0,
        decision: 'allow',
        stage: 0,
        reasons: ['search_engine_allowlist'],
        crawlerAllowlisted: true,
        aiScraper: false,
        tier: 'search_engine',
      },
    }
  }

  // Prior successful JS challenge
  if (req.cookies.get('ccai_bp_ok')?.value === '1') {
    return {
      result: {
        botScore: 0,
        decision: 'allow',
        stage: 0,
        reasons: ['challenge_passed'],
        crawlerAllowlisted: false,
        aiScraper: false,
        tier: readTier(req),
      },
    }
  }

  const maybeIp = (req as NextRequest & { ip?: string }).ip
  const ip = pickClientIp(req.headers, maybeIp)
  const country = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry')
  const asn = req.headers.get('x-vercel-ip-asn') || req.headers.get('x-asn')
  const isApi = pathname.startsWith('/api/')
  const { missingBrowserHeaders, headerAnomalyScore } = headerAnomalyFromHeaders(req.headers, isApi)

  // Parallel store lookups — fail open
  const [rpm, blacklisted] = await Promise.all([
    ip ? incrRequestsLastMinute(ip) : Promise.resolve(undefined),
    ip ? isBlacklistedIp(ip) : Promise.resolve(false),
  ])

  const result = computeBotScore(
    {
      userAgent: ua,
      missingBrowserHeaders,
      headerAnomalyScore,
      requestsLastMinute: rpm,
      tier: isSearchEngineCrawler(ua) ? 'search_engine' : readTier(req),
      blacklisted,
      // Vercel/CF may not provide ASN reputation; treat missing ASN on HTML nav as mild signal only
      asnReputation: asn ? undefined : isApi ? undefined : 0,
      ipReputation: undefined,
      path: pathname,
      hasApiCredentials: hasApiCredentials(req),
    },
    cfg,
  )

  // Automatic learning (non-blocking best-effort)
  const deviceKey = `${ip ?? 'unknown'}|${(ua ?? '').slice(0, 80)}`
  void learnFingerprint(deviceKey, result.botScore)

  if (result.decision === 'allow') {
    return { result }
  }

  if (result.decision === 'slow') {
    const res = applySlowHeaders(NextResponse.next(), result.botScore)
    return { response: res, result }
  }

  const shouldLog =
    result.decision === 'challenge' ||
    result.decision === 'js_challenge' ||
    result.decision === 'temp_block' ||
    result.decision === 'blacklist'

  if (shouldLog) {
    void logBlockedRequest({
      ip,
      asn,
      country,
      userAgent: ua,
      botScore: result.botScore,
      reason: result.reasons.join(','),
      path: pathname,
      decision: result.decision,
      timestamp: new Date().toISOString(),
    })
  }

  if (result.decision === 'js_challenge' || result.decision === 'challenge') {
    return {
      response: new NextResponse(challengeHtml(result.stage, result.botScore), {
        status: 403,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-CCAI-BotScore': String(result.botScore),
          'X-CCAI-Defense': result.decision,
        },
      }),
      result,
    }
  }

  // temp_block / blacklist
  return {
    response: NextResponse.json(
      {
        error: 'request_blocked',
        reason: result.reasons[0] ?? 'bot_score',
        botScore: result.botScore,
      },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': result.decision === 'blacklist' ? '86400' : '120',
          'X-CCAI-BotScore': String(result.botScore),
          'X-CCAI-Defense': result.decision,
        },
      },
    ),
    result,
  }
}
