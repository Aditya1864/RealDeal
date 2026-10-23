import { TAG_STYLES } from "@/components/priority-badge";
import { cn } from "@/lib/utils";
import type { PriorityTag } from "@/lib/scoring";

const SIZE = 96;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreRing({
  score,
  tag,
  className,
}: {
  score: number;
  tag: PriorityTag;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, score));
  const style = TAG_STYLES[tag];

  return (
    <div
      role="img"
      aria-label={`Priority score ${clamped} out of 100, ${style.label}`}
      className={cn("relative shrink-0", className)}
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden="true">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
          className={cn(
            style.stroke,
            "transition-[stroke-dashoffset] duration-500 ease-out",
          )}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold tabular-nums">
        {clamped}
      </span>
    </div>
  );
}
