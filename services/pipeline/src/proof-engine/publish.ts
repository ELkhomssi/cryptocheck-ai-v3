import type { SignalProofCall } from '@cryptocheck/signal-contracts'

export async function publishProofCallToTelegram(call: SignalProofCall): Promise<boolean> {
  const token = process.env.TELEGRAM_PROOF_BOT_TOKEN?.trim()
  const channel = process.env.TELEGRAM_PROOF_CHANNEL_ID?.trim()
  if (!token || !channel) {
    console.warn('[proof-engine] Telegram proof channel not configured — skip post')
    return false
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.cryptocheckai.com').replace(/\/$/, '')
  const called = new Date(call.calledAt).toISOString().slice(11, 19)
  const emoji =
    call.callType === 'rug_alert' ? '⚠️' : call.callType === 'safe_entry' ? '✅' : '🐋'
  const label =
    call.callType === 'rug_alert'
      ? 'RUG ALERT'
      : call.callType === 'safe_entry'
        ? 'SAFE ENTRY'
        : 'SMART MONEY'

  const explorer = call.explorerUrl || (call.commitTx.startsWith('paper:') ? '' : `https://solscan.io/tx/${call.commitTx}`)
  const proofLine = explorer ? `proof: ${explorer}` : `proof: ${call.commitmentHash.slice(0, 16)}…`

  const text = [
    `${emoji} ${label} — $${call.symbol}`,
    `Neural score ${call.neuralScore}/100 · ${call.evidenceSummary}`,
    `called ${called} UTC · ${proofLine}`,
    `full scan: ${appUrl}/call/${call.id}`,
    '',
    `Pro got this ${Math.round(Number(process.env.SIGNAL_FREE_DELAY_MS ?? 90_000) / 1000)}s ago → ${appUrl}/app/upgrade`,
  ].join('\n')

  const chatId = channel.startsWith('@') ? channel : channel
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: false,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[proof-engine] Telegram post failed', res.status, body)
    return false
  }
  return true
}
