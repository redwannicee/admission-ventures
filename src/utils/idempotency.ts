/** A stable random key per checkout intent, kept in sessionStorage so reloads and double clicks reuse it. */
export function checkoutKey(courseId: string): string {
  const storageKey = `av_checkout_${courseId}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const fresh = `${crypto.randomUUID().replace(/-/g, "")}`;
    sessionStorage.setItem(storageKey, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID().replace(/-/g, "");
  }
}
export function clearCheckoutKey(courseId: string): void {
  try { sessionStorage.removeItem(`av_checkout_${courseId}`); } catch { /* ignore */ }
}
