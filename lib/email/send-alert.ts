import 'server-only'

export type EmailAlertData = {
  userId: string
  mint: string
  oldScore: number
  newScore: number
  oldVerdict: string | null
  newVerdict: string
}

/**
 * Fail-closed placeholder: if no provider is configured, quietly skip email delivery.
 */
export async function sendEmailAlert(_alert: EmailAlertData): Promise<boolean> {
  const providerReady = Boolean(process.env.RESEND_API_KEY || process.env.POSTMARK_SERVER_TOKEN)
  if (!providerReady) {
    return false
  }

  // Email provider integration can be plugged in here.
  return false
}
