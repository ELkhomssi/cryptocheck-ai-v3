import 'server-only'

export type AlertData = {
  mint: string
  oldScore: number
  newScore: number
  oldVerdict: string | null
  newVerdict: string
}

export async function sendTelegramAlert(chatId: string, alert: AlertData): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!botToken) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN missing, telegram alerts disabled')
    return false
  }

  try {
    const text = formatAlertMessage(alert)
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      console.error('[telegram] send failed', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[telegram] send error', err)
    return false
  }
}

function formatAlertMessage(alert: AlertData): string {
  const emoji = alert.newVerdict === 'DANGER' ? '🚨' : '⚠️'
  const oldVerdict = alert.oldVerdict ?? 'UNKNOWN'
  return `
${emoji} <b>Risk Alert</b>

Token: <code>${alert.mint.slice(0, 8)}...</code>
Risk changed: ${oldVerdict} → ${alert.newVerdict}
Score: ${alert.oldScore} → ${alert.newScore}

<a href="https://www.cryptocheckai.com/scan/${alert.mint}">View full analysis</a>
  `.trim()
}
