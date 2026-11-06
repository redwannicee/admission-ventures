import { AlarmClock } from "lucide-react";
import { formatClock } from "@/utils/format";

/** Countdown badge with a visible and announced warning before time runs out. */
export function ExamTimer({ secondsLeft }: { secondsLeft: number }) {
  const warn = secondsLeft <= 300 && secondsLeft > 60;
  const danger = secondsLeft <= 60;
  const tone = danger ? "bg-red-700 text-white" : warn ? "bg-amber text-ink" : "bg-brand-800 text-white";
  return (
    <>
      <div className={`flex items-center gap-2 rounded-full px-4 py-2 font-mono text-lg font-semibold tabular-nums ${tone}`} aria-label={`Time left ${formatClock(secondsLeft)}`}>
        <AlarmClock className="h-5 w-5" aria-hidden />{formatClock(secondsLeft)}
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {secondsLeft === 300 ? "Five minutes remaining." : secondsLeft === 60 ? "One minute remaining." : ""}
      </div>
    </>
  );
}
