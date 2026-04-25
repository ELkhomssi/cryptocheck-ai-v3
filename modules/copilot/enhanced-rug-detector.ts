import {
  AlertLevel,
  LPRugDetector,
  type AlertResult,
  type LPMovement,
} from '@/services/alerts/lp-rug-detector'

const LEVEL_RANK: Record<AlertLevel, number> = {
  [AlertLevel.MONITORING_ONLY]: 0,
  [AlertLevel.WATCH]: 1,
  [AlertLevel.HIGH_RISK]: 2,
  [AlertLevel.CRITICAL]: 3,
}

function escalateLevel(current: AlertLevel, minimum: AlertLevel): AlertLevel {
  return LEVEL_RANK[current] >= LEVEL_RANK[minimum] ? current : minimum
}

export class EnhancedRugDetector extends LPRugDetector {
  async analyzeWithContext(
    movement: LPMovement,
    context: {
      priceChange?: number // تغير السعر
      devWallet?: string // محفظة المنشئ
      totalLiquidity?: number // إجمالي السيولة
      holderConcentration?: number // تركيز الحائزين (reserved)
    }
  ): Promise<AlertResult> {
    void context.holderConcentration
    const baseResult = this.analyze(movement, context.totalLiquidity)

    if (context.priceChange != null && context.priceChange < -10) {
      if (baseResult.level === AlertLevel.CRITICAL) {
        baseResult.reason += ` 🔥 تأكيد إضافي: السعر انخفض ${Math.abs(context.priceChange)}%`
      }
    }

    if (context.devWallet && movement.from === context.devWallet) {
      baseResult.level = AlertLevel.CRITICAL
      baseResult.reason += ` 🚨 الخطر الأقصى: محفظة المنشئ تقوم بإزالة السيولة!`
    }

    if (context.totalLiquidity && baseResult.metrics.totalRemoved > 0) {
      const percentage = (baseResult.metrics.totalRemoved / context.totalLiquidity) * 100

      if (percentage > 40) {
        baseResult.level = AlertLevel.CRITICAL
        baseResult.reason += ` 🔴 تمت إزالة ${percentage.toFixed(1)}% من إجمالي السيولة`
      } else if (percentage > 20) {
        baseResult.level = escalateLevel(baseResult.level, AlertLevel.HIGH_RISK)
        baseResult.reason += ` ⚠️ تمت إزالة ${percentage.toFixed(1)}% من إجمالي السيولة`
      }
    }

    return baseResult
  }
}
