import { extensionAssetUrl } from '../lib/extension-asset-url'

type Props = {
  size?: number
  className?: string
}

const LOGO = extensionAssetUrl('logo.jpg')

/** Small crisp wordmark asset from extension bundle (`public/logo.jpg` → extension root). */
export function BrandLogo({ size = 36, className = '' }: Props) {
  return (
    <img
      src={LOGO}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`shrink-0 rounded-xl object-cover ring-1 ring-white/[0.12] shadow-[0_0_20px_-6px_rgba(0,212,170,0.45)] ${className}`.trim()}
    />
  )
}

export function BrandWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-slate-100 ${className}`.trim()}>
      CryptoCheck
      <span className="text-[#00d4aa]">AI</span>
    </span>
  )
}
