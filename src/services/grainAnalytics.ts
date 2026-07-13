import { createGrainAnalytics } from '@grainql/analytics-web';

let grain: ReturnType<typeof createGrainAnalytics> | null = null;

export function enableGrainAnalytics(): void {
  if (!grain) {
    grain = createGrainAnalytics({
      tenantId: 'proto1-parle-a-ava-6dhiws',
      consentMode: 'GDPR_STRICT',
      waitForConsent: true,
      disableAutoProperties: true,
      enableHeartbeat: false,
      enableAutoPageView: false,
      enableHeatmapTracking: false,
      stripQueryParams: true,
      stripHash: true,
    });
  }
  grain.grantConsent(['analytics']);
}

export function disableGrainAnalytics(): void {
  grain?.revokeConsent();
}
