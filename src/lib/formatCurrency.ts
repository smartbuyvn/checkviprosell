/**
 * Viprosell â€” Currency formatting utility
 * Single source of truth for displaying prices.
 */

export function formatPrice(amount: number, currency: string = 'VND'): string {
  if (amount === 0) return 'Miá»…n phÃ­';

  if (currency === 'VND') {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'â‚«';
  }

  if (currency === 'USD') {
    return '$' + new Intl.NumberFormat('en-US').format(amount);
  }

  return `${amount} ${currency}`;
}
