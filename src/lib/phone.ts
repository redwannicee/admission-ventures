const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Converts Bangla numerals (০-৯) to ASCII digits. */
export function toEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/**
 * Normalizes a Bangladeshi mobile number to E.164 (+8801XXXXXXXXX).
 * Accepts 01712345678, 1712345678, 8801712345678, +880 1712-345678 and Bangla digits.
 * Returns null when the number is not a valid BD mobile number.
 */
export function normalizeBdPhone(input: string): string | null {
  let d = toEnglishDigits(input).replace(/[\s\-()]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('880')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  return /^1[3-9]\d{8}$/.test(d) ? `+880${d}` : null;
}
