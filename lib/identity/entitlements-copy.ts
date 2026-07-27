/**
 * Client-safe copy for Pro feature gates (no server-only imports).
 */

export type EntitlementFeature =
  | 'scheduled_reports'
  | 'automation'
  | 'launchlab_create'
  | 'recommendations_full'
  | 'higher_rate_limits'

export const FEATURE_UNLOCK_COPY: Record<EntitlementFeature, string> = {
  scheduled_reports:
    'Scheduled Daily / Weekly / Monthly reports are included with Pro — upgrade to keep automatic briefs running.',
  automation:
    'Automation schedules are included with Pro — upgrade to let agents run on a schedule for you.',
  launchlab_create:
    'LaunchLab token creation is included with Pro — upgrade to prepare and launch tokens.',
  recommendations_full:
    'Full Recommendation Engine output is included with Pro — upgrade for denser, grounded priorities.',
  higher_rate_limits:
    'Higher Command Center and intelligence rate limits are included with Pro.',
}
