'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DISCLAIMER_VERSION, DISCLAIMER_TEXT_FULL } from '@/lib/legal/disclaimer-version'

export function DisclaimerModal() {
  const [shouldShow, setShouldShow] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const lastActiveRef = useRef<HTMLElement | null>(null)

  const checkAcknowledgment = useCallback(async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('disclaimer_acknowledgments')
        .select('version')
        .eq('user_id', user.id)
        .eq('version', DISCLAIMER_VERSION)
        .maybeSingle()

      if (error) {
        console.error('[disclaimer] check failed:', error)
        setShouldShow(false)
        return
      }

      setShouldShow(!data)
    } catch (err) {
      console.error('[disclaimer] check failed:', err)
      setShouldShow(false)
    }
  }, [])

  useEffect(() => {
    void checkAcknowledgment()
  }, [checkAcknowledgment])

  useEffect(() => {
    if (!shouldShow) return

    lastActiveRef.current = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => {
      const root = panelRef.current
      const focusable = root?.querySelector<HTMLElement>('a[href], button:not([disabled])')
      focusable?.focus()
    }, 0)

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root?.contains(document.activeElement as Node)) return
      const focusables = [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(
        (el) => !el.hasAttribute('disabled')
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKeyDown)
      lastActiveRef.current?.focus?.()
    }
  }, [shouldShow])

  async function acknowledge() {
    setSubmitting(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setShouldShow(false)
        return
      }

      const { error } = await supabase.from('disclaimer_acknowledgments').insert({
        user_id: user.id,
        version: DISCLAIMER_VERSION,
        acknowledged_at: new Date().toISOString(),
        user_agent: navigator.userAgent.slice(0, 500),
      })

      if (error && error.code !== '23505') {
        console.error('[disclaimer] acknowledge failed:', error)
        alert('Could not save acknowledgment. Please try again.')
        return
      }

      setShouldShow(false)
    } catch (err) {
      console.error('[disclaimer] acknowledge failed:', err)
      alert('Could not save acknowledgment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!shouldShow) return null

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-xl shadow-2xl p-6 sm:p-8 outline-none"
        tabIndex={-1}
      >
        <div className="flex items-start gap-3 mb-5">
          <span className="text-2xl" aria-hidden="true">
            ⚠
          </span>
          <h2 id="disclaimer-title" className="text-xl sm:text-2xl font-bold text-white">
            Important Notice
          </h2>
        </div>

        <div className="prose prose-invert prose-sm max-w-none mb-6">
          <p className="text-slate-300 leading-relaxed whitespace-pre-line text-sm sm:text-base">
            {DISCLAIMER_TEXT_FULL}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2.5 border border-slate-600 rounded-lg text-slate-300 text-center hover:bg-slate-800 hover:border-slate-500 transition-colors"
          >
            Read Full Terms
          </a>
          <button
            type="button"
            onClick={() => void acknowledge()}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-cyan-500 text-slate-950 rounded-lg font-semibold hover:bg-cyan-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'I Understand and Agree'}
          </button>
        </div>
      </div>
    </div>
  )
}
