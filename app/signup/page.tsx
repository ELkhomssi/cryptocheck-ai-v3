'use client'

import { useRouter } from 'next/navigation'
import AuthModal from '@/components/AuthModal'

export default function SignupPage() {
  const router = useRouter()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050510',
      }}
    >
      <AuthModal
        defaultMode="signup"
        onClose={() => router.replace('/')}
        onSuccess={() => {
          router.replace('/app')
        }}
      />
    </div>
  )
}
