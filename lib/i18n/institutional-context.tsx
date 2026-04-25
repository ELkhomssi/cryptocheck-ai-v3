'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isInstitutionalLocale, translate, type InstitutionalLocale } from '@/lib/i18n/institutional-catalog'

const STORAGE_KEY = 'institutional_locale'

type Ctx = {
  locale: InstitutionalLocale
  setLocale: (l: InstitutionalLocale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const InstitutionalI18nContext = createContext<Ctx | null>(null)

export function InstitutionalI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<InstitutionalLocale>('en')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && isInstitutionalLocale(raw)) setLocaleState(raw)
  }, [])

  const setLocale = useCallback((l: InstitutionalLocale) => {
    setLocaleState(l)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, l)
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <InstitutionalI18nContext.Provider value={value}>{children}</InstitutionalI18nContext.Provider>
}

export function useInstitutionalTranslation(): Ctx {
  const v = useContext(InstitutionalI18nContext)
  if (!v) throw new Error('useInstitutionalTranslation must be used within InstitutionalI18nProvider')
  return v
}
