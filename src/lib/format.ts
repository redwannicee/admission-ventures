export function pick(locale: string, en?: string | null, bn?: string | null): string {
  return (locale === 'bn' ? bn || en : en || bn) ?? '';
}

export function formatNumber(n: number, locale: string, grouping = true): string {
  return new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-US', { useGrouping: grouping }).format(n);
}

export function formatPrice(n: number, locale: string): string {
  return `৳${formatNumber(n, locale)}`;
}
