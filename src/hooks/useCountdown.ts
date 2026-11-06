import { useEffect, useState } from "react";

/**
 * Seconds remaining until `deadlineIso`, corrected for the difference between the server clock
 * and this device (offset = serverNow - clientNow at the moment the server told us the time).
 */
export function useCountdown(deadlineIso: string | null, serverNowIso: string | null): number {
  const [left, setLeft] = useState<number>(() => compute(deadlineIso, serverNowIso));
  useEffect(() => {
    if (!deadlineIso) return;
    const offset = serverNowIso ? new Date(serverNowIso).getTime() - Date.now() : 0;
    const tick = () => setLeft(Math.max(0, Math.ceil((new Date(deadlineIso).getTime() - (Date.now() + offset)) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [deadlineIso, serverNowIso]);
  return left;
}

function compute(deadlineIso: string | null, serverNowIso: string | null): number {
  if (!deadlineIso) return 0;
  const now = serverNowIso ? new Date(serverNowIso).getTime() : Date.now();
  return Math.max(0, Math.ceil((new Date(deadlineIso).getTime() - now) / 1000));
}
