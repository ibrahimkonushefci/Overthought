export type AnalyticsEventName =
  | 'app_opened'
  | 'continued_as_guest'
  | 'auth_started'
  | 'auth_completed'
  | 'case_created'
  | 'case_analyzed'
  | 'case_saved'
  | 'case_shared'
  | 'case_update_added'
  | 'outcome_marked'
  | 'paywall_viewed'
  | 'restore_purchases_tapped';

export function trackEvent(name: AnalyticsEventName, payload: Record<string, unknown> = {}) {
  if (__DEV__) {
    console.log(`[analytics] ${name}`, payload);
  }
}
