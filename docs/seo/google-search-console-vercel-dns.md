# Google Search Console + Vercel DNS (CryptoCheckAI)

Production host: `https://www.cryptocheckai.com`  
Apex `cryptocheckai.com` already 308/redirects to `www` via `next.config.js`.

## 1. Environment variable (HTML meta verification)

In **Vercel → Project → Settings → Environment Variables** (Production):

| Name | Value |
|------|--------|
| `GOOGLE_SITE_VERIFICATION` | `zdQBBLwjabNtgA5Z-TE0TNGdYztlGkTlRWsxBYp1vf0` |

This is exposed **only** through the Next.js Metadata API (`verification.google`) in `lib/seo/metadata.ts`.  
Do **not** hardcode the token in source.

Redeploy after setting the variable so `/` HTML includes:

```html
<meta name="google-site-verification" content="…" />
```

## 2. Vercel DNS TXT record (domain verification)

Exact UI path:

1. Open [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the **CryptoCheckAI** project
3. Open **Settings → Domains** (or the team **Domains** view for `cryptocheckai.com`)
4. Click **`cryptocheckai.com`**
5. Open **DNS Records**
6. **Add** a record:
   - **Type:** `TXT`
   - **Name:** `@`
   - **Value:** `google-site-verification=zdQBBLwjabNtgA5Z-TE0TNGdYztlGkTlRWsxBYp1vf0`
7. Save and wait for DNS propagation (often minutes; up to 48h)

Verify with:

```bash
dig TXT cryptocheckai.com +short
```

## 3. Google Search Console

1. Add property for `https://www.cryptocheckai.com` (URL-prefix) **or** Domain property for `cryptocheckai.com`
2. Complete verification (meta tag **or** DNS TXT)
3. Submit sitemap: `https://www.cryptocheckai.com/sitemap.xml`
4. Confirm `https://www.cryptocheckai.com/robots.txt` allows `/` and lists the sitemap

## 4. Related SEO endpoints

| URL | Purpose |
|-----|---------|
| `/sitemap.xml` | Sitemap index (auto-splits tokens/wallets/reports) |
| `/sitemap-static.xml` | Marketing + product static routes |
| `/sitemap-tokens.xml` | Indexed `/token/[mint]` pages from DB |
| `/sitemap-wallets.xml` | Indexed `/wallet/[address]` pages |
| `/sitemap-reports.xml` | Indexed `/report/[id]` pages |
| `/robots.txt` | Crawl rules + sitemap pointer |

Sitemaps revalidate from live Supabase data — new tokens, wallets, and reports appear without manual regeneration.
