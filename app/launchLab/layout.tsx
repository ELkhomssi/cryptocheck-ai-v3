import '@/lib/dashboard/tokens.css'

export default function LaunchLabLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#07080c] text-zinc-100 antialiased">{children}</div>
}
