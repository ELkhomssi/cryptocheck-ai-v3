import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getActiveSaasSubscription } from '@/lib/services/saas-subscription.service'
import type { SaasSubscriptionRow } from '@/lib/types/saas-subscription'
import { hasAccess, getProductBand, type AccessContext } from '@/lib/access-control'
import { buildLpAlertContextFromSignature } from '@/lib/trading-os/lp-alert-context'
import { sendTelegramPlainMessage } from '@/lib/telegram/send-alert'
import { EnhancedRugDetector } from '@/modules/copilot/enhanced-rug-detector'
import { AlertLevel, type AlertResult, type LPMovement } from '@/services/alerts/lp-rug-detector'

function escapeTelegramHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function loadAccessContextForUser(userId: string): Promise<AccessContext> {
  const sb = getSupabaseAdmin()
  const { data: p } = await sb.from('profiles').select('tier').eq('id', userId).maybeSingle()
  const saas = (await getActiveSaasSubscription(userId)) as SaasSubscriptionRow | null
  return {
    profileTier: p?.tier ?? null,
    saasTier: saas?.tier ?? null,
  }
}

/**
 * LP / rug pipeline: Helius + DexScreener context, {@link EnhancedRugDetector}, tier gates, Telegram (elite band), Supabase `trading_os_alerts`.
 */
export class AlertEngine {
  private rugDetector = new EnhancedRugDetector()

  async processLPEvent(movement: LPMovement, userId: string): Promise<AlertResult> {
    const context = await buildLpAlertContextFromSignature(movement.signature)
    const result = await this.rugDetector.analyzeWithContext(movement, context)

    const accessCtx = await loadAccessContextForUser(userId)
    const hasRugAlerts = hasAccess(accessCtx, 'rug_alerts')
    const hasEliteTelegramBand = hasAccess(accessCtx, 'whale_alerts')

    if (result.level === AlertLevel.CRITICAL) {
      await this.sendCriticalAlert(userId, result, movement)
      if (hasEliteTelegramBand) {
        await this.sendTelegramAlert(userId, result, movement)
      }
    } else if (result.level === AlertLevel.HIGH_RISK && hasRugAlerts) {
      await this.sendInAppAlert(userId, result, movement)
    }

    await this.storeAlert(userId, movement, result, accessCtx)
    return result
  }

  private async sendCriticalAlert(userId: string, result: AlertResult, movement: LPMovement): Promise<void> {
    console.info('[AlertEngine] CRITICAL', {
      userId,
      level: result.level,
      signature: movement.signature,
      reason: result.reason,
    })
  }

  private async sendTelegramAlert(userId: string, result: AlertResult, movement: LPMovement): Promise<void> {
    const sb = getSupabaseAdmin()
    const { data: prefs } = await sb
      .from('alert_preferences')
      .select('telegram_chat_id, telegram_alerts_enabled')
      .eq('user_id', userId)
      .maybeSingle()
    if (!prefs?.telegram_alerts_enabled || !prefs.telegram_chat_id) return

    const html = [
      '<b>LP / Rug — ELITE priority</b>',
      '',
      `<b>${escapeTelegramHtml(result.level)}</b>`,
      escapeTelegramHtml(result.reason),
      '',
      `<i>${escapeTelegramHtml(result.recommendation)}</i>`,
      '',
      `<code>${escapeTelegramHtml(movement.signature)}</code>`,
    ].join('\n')

    await sendTelegramPlainMessage(String(prefs.telegram_chat_id), html)
  }

  private async sendInAppAlert(userId: string, result: AlertResult, movement: LPMovement): Promise<void> {
    console.info('[AlertEngine] in-app HIGH_RISK', {
      userId,
      signature: movement.signature,
      reason: result.reason,
    })
  }

  private async storeAlert(
    userId: string,
    movement: LPMovement,
    result: AlertResult,
    accessCtx: AccessContext
  ): Promise<void> {
    const sb = getSupabaseAdmin()
    const band = getProductBand(accessCtx)
    const { error } = await sb.from('trading_os_alerts').insert({
      user_id: userId,
      kind: `lp_rug_${String(result.level).toLowerCase()}`,
      tier_band: band,
      payload: {
        movement,
        result,
        signature: movement.signature,
        timestamp: movement.timestamp,
      },
      delivered: false,
    })
    if (error) {
      console.error('[AlertEngine] storeAlert failed', error.message, error.code)
    }
  }
}
