import { DEV_SIGNING_SALT_FALLBACK } from '@cryptocheck/signing';
export function resolveSigningSalt(explicit) {
    if (explicit?.trim())
        return explicit.trim();
    if (typeof process !== 'undefined' && process.env) {
        const a = process.env.CRYPTOCHECK_SIGNING_SALT?.trim();
        if (a)
            return a;
        const b = process.env.API_SIGNING_SALT?.trim();
        if (b)
            return b;
    }
    return DEV_SIGNING_SALT_FALLBACK;
}
export function resolveConnectBaseUrl(explicit) {
    const u = explicit?.trim() ||
        (typeof process !== 'undefined' && process.env
            ? process.env.CRYPTOCHECK_BASE_URL?.trim() ||
                process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
                process.env.NEXT_PUBLIC_APP_URL?.trim()
            : '') ||
        'https://www.cryptocheckai.com';
    return u.replace(/\/$/, '');
}
