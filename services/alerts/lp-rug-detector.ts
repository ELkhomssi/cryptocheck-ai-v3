export enum AlertLevel {
  MONITORING_ONLY = 'MONITORING_ONLY', // نشاط طبيعي
  WATCH = 'WATCH', // مراقبة
  HIGH_RISK = 'HIGH_RISK', // خطر مرتفع
  CRITICAL = 'CRITICAL', // احتيال مؤكد
}

export interface LPMovement {
  signature: string
  timestamp: number
  type: 'TRANSFER' | 'BURN' | 'CLOSE' | 'MINT'
  amount: number
  from?: string
  to?: string
}

export interface AlertResult {
  level: AlertLevel
  reason: string
  metrics: {
    totalRemoved: number
    eventCount: number
    timeWindowSeconds: number
    averageAmountPerEvent: number
  }
  recommendation: string
}

export class LPRugDetector {
  private movementWindow: LPMovement[] = []
  private readonly WINDOW_MS = 60000 // 60 ثانية
  private readonly CRITICAL_THRESHOLD_USD = 10000
  private readonly HIGH_RISK_THRESHOLD_USD = 5000
  private readonly MIN_EVENTS_FOR_CRITICAL = 3

  analyze(movement: LPMovement, _totalLiquidity?: number): AlertResult {
    this.movementWindow.push(movement)

    const now = Date.now()
    this.movementWindow = this.movementWindow.filter((m) => now - m.timestamp < this.WINDOW_MS)

    const sortedEvents = [...this.movementWindow].sort((a, b) => a.timestamp - b.timestamp)

    const criticalEvents = sortedEvents.filter((m) => m.type === 'BURN' || m.type === 'CLOSE')

    const totalRemoved = criticalEvents.reduce((sum, m) => sum + m.amount, 0)

    const weightedRisk = this.calculateWeightedRisk(criticalEvents)

    if (criticalEvents.length >= this.MIN_EVENTS_FOR_CRITICAL) {
      const firstEventTime = criticalEvents[0]!.timestamp
      const timeSpan = now - firstEventTime

      if (timeSpan < 10000 && totalRemoved > this.CRITICAL_THRESHOLD_USD) {
        return {
          level: AlertLevel.CRITICAL,
          reason: `🚨 اكتشاف احتيال نشط! إزالة ${totalRemoved.toFixed(2)} دولار من السيولة خلال ${(timeSpan / 1000).toFixed(1)} ثانية`,
          metrics: {
            totalRemoved,
            eventCount: criticalEvents.length,
            timeWindowSeconds: timeSpan / 1000,
            averageAmountPerEvent: totalRemoved / criticalEvents.length,
          },
          recommendation: 'اخرج فورًا! يتم إزالة السيولة بسرعة - توقع انهيار السعر خلال دقائق',
        }
      }
    }

    if (totalRemoved > this.HIGH_RISK_THRESHOLD_USD) {
      return {
        level: AlertLevel.HIGH_RISK,
        reason: `⚠️ تم إزالة ${totalRemoved.toFixed(2)} دولار من السيولة - خطر مرتفع`,
        metrics: {
          totalRemoved,
          eventCount: criticalEvents.length,
          timeWindowSeconds: this.WINDOW_MS / 1000,
          averageAmountPerEvent: totalRemoved / (criticalEvents.length || 1),
        },
        recommendation: 'قلل مركزك وراقب عن كثب - احتمال حدوث احتيال',
      }
    }

    if (movement.type === 'TRANSFER' && this.movementWindow.length > 10 && criticalEvents.length === 0) {
      return {
        level: AlertLevel.MONITORING_ONLY,
        reason: 'نشاط سيولة طبيعي - تدفق مستقر للتحويلات',
        metrics: {
          totalRemoved: 0,
          eventCount: 0,
          timeWindowSeconds: this.WINDOW_MS / 1000,
          averageAmountPerEvent: 0,
        },
        recommendation: 'تابع كالمعتاد - لا يوجد نشاط مشبوه',
      }
    }

    return {
      level: AlertLevel.WATCH,
      reason: `نشاط سيولة معتدل - ${criticalEvents.length} حدث حرج، إجمالي ${totalRemoved.toFixed(2)} دولار (مخاطرة وزنية ${Math.round(weightedRisk)})`,
      metrics: {
        totalRemoved,
        eventCount: criticalEvents.length,
        timeWindowSeconds: this.WINDOW_MS / 1000,
        averageAmountPerEvent: criticalEvents.length > 0 ? totalRemoved / criticalEvents.length : 0,
      },
      recommendation: 'راقب السعر ونشاط المحفظة المنشئة',
    }
  }

  private calculateWeightedRisk(events: LPMovement[]): number {
    let risk = 0
    for (const event of events) {
      switch (event.type) {
        case 'CLOSE':
          risk += 50
          break
        case 'BURN':
          risk += Math.min(30, event.amount / 1000)
          break
        case 'TRANSFER':
          risk += 5
          break
        case 'MINT':
          risk += 8
          break
        default:
          break
      }
    }
    return Math.min(100, risk)
  }

  reset(): void {
    this.movementWindow = []
  }
}
