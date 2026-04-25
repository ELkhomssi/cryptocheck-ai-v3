import en from '@/locales/institutional/en.json'
import fr from '@/locales/institutional/fr.json'
import ar from '@/locales/institutional/ar.json'

export type InstitutionalLocale = 'en' | 'fr' | 'ar'

const catalogs: Record<InstitutionalLocale, Record<string, unknown>> = { en, fr, ar }

function getNested(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur != null && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

/**
 * Nested keys e.g. `institutional.hero.title` — interpolates `{name}` from vars.
 */
export function translate(
  locale: InstitutionalLocale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const raw = getNested(catalogs[locale], key)
  let s = typeof raw === 'string' ? raw : key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return s
}

export function isInstitutionalLocale(v: string): v is InstitutionalLocale {
  return v === 'en' || v === 'fr' || v === 'ar'
}
