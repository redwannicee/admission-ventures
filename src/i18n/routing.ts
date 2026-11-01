import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['bn', 'en'],
  // Bangla is the primary audience: "/" is Bangla, "/en" is English.
  defaultLocale: 'bn',
  localePrefix: 'as-needed',
  // No Accept-Language redirects: keeps every URL a single cacheable response at the edge.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
