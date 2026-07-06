export type SourceBrandId =
  | 'telegram'
  | 'x'
  | 'dexscreener'
  | 'pumpfun'
  | 'coinmarketcap'
  | 'coingecko'
  | 'whale'
  | 'smartmoney'
  | 'news'

type Props = {
  id: SourceBrandId
  className?: string
}

export function SourceBrandIcon({ id, className = 'h-3.5 w-3.5' }: Props) {
  switch (id) {
    case 'telegram':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M9.9 15.3 9.7 19c.4 0 .6-.2.8-.4l2-1.9 4.1 3c.8.4 1.3.2 1.5-.7l2.7-12.6c.3-1.2-.4-1.7-1.2-1.4L4.2 10.4c-1.1.4-1.1 1 0 1.3l4.5 1.4 10.4-6.6c.5-.3.9-.1.5.2"
          />
        </svg>
      )
    case 'x':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M18.9 2H22l-6.8 7.8L23.2 22h-6.7l-5.2-6.8L5.4 22H2.3l7.3-8.4L.8 2h6.9l4.7 6.1L18.9 2zm-1.2 18h1.9L7.1 3.9H5.1L17.7 20z"
          />
        </svg>
      )
    case 'dexscreener':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="14" width="4" height="7" rx="1" fill="currentColor" opacity="0.5" />
          <rect x="10" y="9" width="4" height="12" rx="1" fill="currentColor" opacity="0.75" />
          <rect x="17" y="4" width="4" height="17" rx="1" fill="currentColor" />
        </svg>
      )
    case 'pumpfun':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M8 4v8H4l8 12V12h4L8 4z" />
        </svg>
      )
    case 'coinmarketcap':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path fill="currentColor" d="M8 15V9l4-2v8l-4-2z" />
        </svg>
      )
    case 'coingecko':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.85" />
          <circle cx="9" cy="10" r="1.2" fill="currentColor" className="text-dash-bg" />
        </svg>
      )
    case 'whale':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M3 13c2-4 6-6 9-5 2 .8 3 2.5 3 4.5 0 2.5-2 4.5-4.5 4.5H9c-1.5 0-3-.5-4-1.5l1-2.5zm14 1c1.5 0 3-1 3.5-2.5.5 1 1.5 1.8 2.5 1.8"
          />
        </svg>
      )
    case 'smartmoney':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
        </svg>
      )
    case 'news':
      return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden>
          <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path fill="currentColor" d="M7 9h10v1.5H7V9zm0 3h7v1.5H7V12zm0 3h10v1.5H7V15z" />
        </svg>
      )
    default:
      return null
  }
}
