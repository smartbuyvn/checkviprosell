/**
 * Viprosell — Currency formatting utility
 * Single source of truth for displaying prices.
 */

export function formatPrice(amount: number, currency: string = 'VND'): string {
  if (amount === 0) return 'Miễn phí';

  if (currency === 'VND') {
    return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
  }

  if (currency === 'USD') {
    return '$' + new Intl.NumberFormat('en-US').format(amount);
  }

  return `${amount} ${currency}`;
}
