import Link from 'next/link'
import { COMPLIANCE_DISCLAIMER, FEE_DISCLOSURE_PATH, TERMS_PATH } from '@/lib/revenue-dashboard/constants'

export function RevenueComplianceNote({ className = '' }: { className?: string }) {
  return (
    <p className={`rd-compliance ${className}`}>
      {COMPLIANCE_DISCLAIMER}{' '}
      <Link href={FEE_DISCLOSURE_PATH} className="underline hover:text-rd-mid">
        Fee disclosure
      </Link>
      {' · '}
      <Link href={TERMS_PATH} className="underline hover:text-rd-mid">
        Terms
      </Link>
    </p>
  )
}
