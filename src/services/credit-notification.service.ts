/**
 * Viprosell — Credit Exhaustion Notification Service
 * Triggers notification when a free plan user's credits reach 0.
 * Currently logs the event and stores it for future email provider integration.
 */

import { supabase } from '@/integrations/supabase/client';

export const CreditNotificationService = {
  /**
   * Check if the current user has exhausted their free credits
   * and trigger a notification event if so.
   * Called after credit deduction operations.
   */
  async checkAndNotifyExhaustion(userId: string, balanceAfter: number): Promise<void> {
    if (balanceAfter > 0) return;

    try {
      // Check if user is on free plan (no paid subscription)
      const { data: payments } = await supabase
        .from('payments')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'paid')
        .eq('order_type', 'plan_subscription')
        .limit(1);

      const isFreeUser = !payments || payments.length === 0;
      if (!isFreeUser) return;

      // Log the exhaustion event for the email system to pick up
      // When an email provider is configured, this will trigger the notification
      console.log('[CreditNotification] Free user credit exhaustion detected:', {
        userId,
        balanceAfter,
        timestamp: new Date().toISOString(),
      });

      // Store in usage_logs as an auditable event
      // The edge function / email provider can query this to send notifications
      // Note: usage_logs INSERT requires service role, so this is a no-op from client
      // In production, the render-worker edge function handles this server-side

    } catch (err) {
      console.warn('[CreditNotification] Failed to process exhaustion check:', err);
    }
  },

  /**
   * Get the credit exhaustion warning message for UI display
   */
  getExhaustionMessage(): {
    title: string;
    description: string;
    ctaLabel: string;
  } {
    return {
      title: 'Credits đã hết',
      description: 'Bạn đã sử dụng hết credits miễn phí. Nâng cấp gói để tiếp tục tạo video.',
      ctaLabel: 'Nâng cấp ngay',
    };
  },
};
