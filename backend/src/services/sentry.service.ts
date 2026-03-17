/**
 * Viprosell v1.2 Mock Sentry Service
 * Simulated error tracking for Beta Readiness
 */

export const MockSentry = {
  init() {
    console.log('[MockSentry] Initialized for Viprosell v1.2 Beta');
  },
  
  captureException(error: Error | any, context?: any) {
    const errorPayload = {
      timestamp: new Date().toISOString(),
      message: error?.message || error,
      context,
      stack: error?.stack
    };
    console.error('[MockSentry] Captured Exception:', JSON.stringify(errorPayload, null, 2));
    // In production, this would send an HTTP request to Sentry/Datadog
  },
  
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    console.log(`[MockSentry][${level.toUpperCase()}] ${message}`);
  }
};
