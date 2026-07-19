#!/usr/bin/env python3
"""Part1 clean stale-cache override latency re-test — no SECTION1_TRAP."""
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path('/Users/pc/crypto')
BASE = 'http://127.0.0.1:3000'
USER_PK = 'So11111111111111111111111111111111111111112'


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in (ROOT / '.env.local').read_text().splitlines():
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def redis(*args: str) -> str:
    r = subprocess.run(['redis-cli', '--raw', *args], capture_output=True, text=True, check=False)
    return (r.stdout or '').rstrip('\n')


def http_json(method: str, path: str, body: dict | None, headers: dict[str, str]) -> tuple[int, dict, int]:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={'Content-Type': 'application/json', **headers},
        method=method,
    )
    t0 = int(time.time() * 1000)
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            raw = res.read().decode()
            code = res.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        code = e.code
    t1 = int(time.time() * 1000)
    try:
        parsed = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        parsed = {'_raw': raw[:500]}
    return code, parsed, t1 - t0


def poison_scan_v2(mint: str) -> dict:
    raw = redis('GET', f'scan:v2:{mint}')
    if not raw:
        raise SystemExit(f'NO_SCAN_V2 for {mint}')
    payload = json.loads(raw)
    snap = payload.get('snapshot') or {}
    w = dict(snap.get('weighted') or {})
    w['score'] = 5
    snap['weighted'] = w
    r = dict(snap.get('reasoning') or {})
    r['aggregateScore'] = 5
    r['verdict'] = 'HIGH'
    flags = list(r.get('flags') or [])
    for f in ('mint_authority_active', 'honeypot_risk', 'rugpull_pattern'):
        if f not in flags:
            flags.append(f)
    r['flags'] = flags
    snap['reasoning'] = r
    sim = dict(snap.get('simulator') or {})
    sim['honeypotLikelihood'] = 'high'
    sim['sell'] = {'ok': False, 'path': 'poison', 'summary': 'high-risk sell fail'}
    snap['simulator'] = sim
    payload['snapshot'] = snap
    out = json.dumps(payload, separators=(',', ':'))
    redis('SET', f'scan:v2:{mint}', out, 'EX', '180')
    bh = payload.get('bodyHash')
    if bh:
        redis('SET', f'institutional_scan:v1:{bh}', json.dumps(snap, separators=(',', ':')), 'EX', '180')
    return {'bodyHash': (bh or '')[:16], 'safetyScore': 5, 'riskScore': 95}


def main() -> None:
    env = load_env()
    secret = env.get('SIGNAL_WORKER_SECRET', '')
    assert secret, 'SIGNAL_WORKER_SECRET missing'
    auth = {'Authorization': f'Bearer {secret}'}

    # Prefer prior trap mint (known scannable); fall back to BONK
    mint = os.environ.get('OVERRIDE_TEST_MINT') or 'J7fjPVEsE1WMU2Q8KhQS6TtGHX67BgSRyeNSgsuQtakK'
    print('MINT', mint)

    redis('DEL', f'ccai:sig:verdict:{mint}', f'scan:v2:{mint}')

    print('\n===== WARM via /api/internal/signals/assess (normal gate) =====')
    for i in (1, 2, 3):
        code, body, ms = http_json(
            'POST',
            '/api/internal/signals/assess',
            {'chain': 'solana', 'contractAddress': mint},
            auth,
        )
        print(f'assess_{i}', {'http': code, 'client_ms': ms, **{k: body.get(k) for k in ('gatewayVerdict', 'riskScore', 'neuralScore', 'cache', 'resolved')}})

    verdict_raw = redis('GET', f'ccai:sig:verdict:{mint}')
    print('\n===== VERDICT CACHE AFTER WARM =====')
    print(verdict_raw[:300] if verdict_raw else None)
    assert verdict_raw, 'verdict cache empty after warm'
    vd = json.loads(verdict_raw)
    assert vd['riskScore'] < 80 and vd['verdict'] in ('SAFE', 'CAUTION', 'HIGH_RISK'), vd
    print('WARM_OK', {'verdict': vd['verdict'], 'riskScore': vd['riskScore']})
    print('scan:v2 exists', redis('EXISTS', f'scan:v2:{mint}'))

    print('\n===== POISON scan:v2 (real snapshot row) — leave verdict cache untouched =====')
    poisoned = poison_scan_v2(mint)
    print('POISON_OK', poisoned)

    vd2 = json.loads(redis('GET', f'ccai:sig:verdict:{mint}'))
    print('VERDICT_STILL', {'verdict': vd2['verdict'], 'riskScore': vd2['riskScore']})
    assert vd2['riskScore'] < 80 and vd2['verdict'] in ('SAFE', 'CAUTION', 'HIGH_RISK')
    print('VERDICT_STILL_SAFE_OK')

    print('\n===== PRECOMPILE build-swap on DIFFERENT mint (discard; keep test mint caches intact) =====')
    warm_mint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'  # BONK — compile only
    code, body, ms = http_json(
        'POST',
        '/api/signals/snipe/build-swap',
        {'mint': warm_mint, 'userPublicKey': USER_PK, 'amountSol': 0.01, 'amountUsd': 1.5, 'slippageBps': 100},
        auth,
    )
    print('precompile', {'http': code, 'client_ms': ms, 'verdictPath': body.get('verdictPath')})

    # Confirm test mint still stale SAFE + poisoned
    vd3 = json.loads(redis('GET', f'ccai:sig:verdict:{mint}'))
    print('pre_measure_verdict', {'verdict': vd3['verdict'], 'riskScore': vd3['riskScore']})
    assert vd3['riskScore'] < 80
    # Re-poison in case TTL/other races
    poison_scan_v2(mint)

    print('\n===== MEASURED OVERRIDE SNIPE =====')
    code, body, client_ms = http_json(
        'POST',
        '/api/signals/snipe/build-swap',
        {'mint': mint, 'userPublicKey': USER_PK, 'amountSol': 0.01, 'amountUsd': 1.5, 'slippageBps': 100},
        auth,
    )
    timing = body.get('timing') or {}
    decision = body.get('decision') or {}
    result = {
        'http': code,
        'client_delta_ms': client_ms,
        'verdictPath': body.get('verdictPath'),
        'blocked': body.get('blocked'),
        'fresh_verdict': decision.get('verdict'),
        'fresh_riskScore': decision.get('riskScore'),
        'timing': timing,
        'stale_override_log_expected': body.get('verdictPath') == 'cache-hit' and code == 403,
    }
    print(json.dumps(result, indent=2))

    # Baseline cache-hit (SAFE+SAFE): warm again and snipe without poison
    print('\n===== BASELINE cache-hit (no poison) =====')
    http_json('POST', '/api/internal/signals/assess', {'chain': 'solana', 'contractAddress': mint}, auth)
    code_c, body_c, ms_c = http_json(
        'POST',
        '/api/signals/snipe/build-swap',
        {'mint': mint, 'userPublicKey': USER_PK, 'amountSol': 0.01, 'amountUsd': 1.5, 'slippageBps': 100},
        auth,
    )
    print(json.dumps({'http': code_c, 'client_ms': ms_c, 'verdictPath': body_c.get('verdictPath'), 'blocked': body_c.get('blocked'), 'timing': body_c.get('timing')}, indent=2))

    print('\n===== BASELINE inline (delete verdict, keep scan warm) =====')
    redis('DEL', f'ccai:sig:verdict:{mint}')
    code_i, body_i, ms_i = http_json(
        'POST',
        '/api/signals/snipe/build-swap',
        {'mint': mint, 'userPublicKey': USER_PK, 'amountSol': 0.01, 'amountUsd': 1.5, 'slippageBps': 100},
        auth,
    )
    print(json.dumps({'http': code_i, 'client_ms': ms_i, 'verdictPath': body_i.get('verdictPath'), 'blocked': body_i.get('blocked'), 'timing': body_i.get('timing')}, indent=2))

    print('\n===== THREE-WAY =====')
    print(
        json.dumps(
            {
                'prior_baselines_from_section1': {'cache_hit_ms': 510, 'inline_ms': 1302, 'trap_override_ms': 22659},
                'this_run_override': result,
                'this_run_cache_hit': {'timing': body_c.get('timing'), 'client_ms': ms_c, 'http': code_c},
                'this_run_inline': {'timing': body_i.get('timing'), 'client_ms': ms_i, 'http': code_i},
            },
            indent=2,
        )
    )


if __name__ == '__main__':
    main()
