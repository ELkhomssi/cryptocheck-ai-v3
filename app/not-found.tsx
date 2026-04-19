import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="font-mono min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 212, 170, 0.12), transparent 55%), #050510',
      }}
    >
      <div
        className="w-full max-w-md text-center rounded-2xl px-8 py-10"
        style={{
          background: 'rgba(13, 20, 32, 0.85)',
          border: '1px solid rgba(0, 212, 170, 0.18)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        }}
      >
        <p
          className="text-[10px] font-bold tracking-[0.2em] uppercase mb-4"
          style={{ color: 'rgba(0, 212, 170, 0.75)' }}
        >
          CryptoCheck AI
        </p>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-white tracking-tight mb-2">404</h1>
        <p className="text-sm sm:text-base mb-1" style={{ color: '#94a3b8' }}>
          This page does not exist or has been moved.
        </p>
        <p className="text-xs mb-8 leading-relaxed" style={{ color: '#64748b' }}>
          If you followed a link from elsewhere, it may be out of date. Use the button below to return to
          the main site.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center w-full sm:w-auto min-w-[200px] px-6 py-3 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #00d4aa, #059669)',
            color: '#030308',
            boxShadow: '0 0 24px rgba(0, 212, 170, 0.25)',
          }}
        >
          Back to Home
        </Link>
        <div className="mt-6 pt-6 border-t border-white/[0.06]">
          <Link
            href="/app"
            className="text-xs font-medium transition-colors hover:text-[#00d4aa]"
            style={{ color: '#64748b' }}
          >
            Open app →
          </Link>
        </div>
      </div>
    </div>
  )
}
