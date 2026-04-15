import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} min-h-screen bg-[#050506] text-slate-200 antialiased`}>
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.4]"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 50% at 50% -15%, rgba(59,130,246,0.07), transparent), radial-gradient(ellipse 50% 35% at 100% 0%, rgba(16,185,129,0.06), transparent)',
        }}
      />
      {children}
    </div>
  )
}
