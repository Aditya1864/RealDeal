import { cn } from "@/lib/utils";
import type { PriorityTag } from "@/lib/scoring";

export const TAG_STYLES: Record<
  PriorityTag,
  { label: string; className: string; stroke: string }
> = {
  hot: {
    label: "Hot",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    stroke: "stroke-red-500 dark:stroke-red-400",
  },
  warm: {
    label: "Warm",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    stroke: "stroke-amber-500 dark:stroke-amber-400",
  },
  cold: {
    label: "Cold",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    stroke: "stroke-sky-500 dark:stroke-sky-400",
  },
};

export function PriorityBadge({
  score,
  tag,
  className,
}: {
  score: number;
  tag: PriorityTag;
  className?: string;
}) {
  const style = TAG_STYLES[tag];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        style.className,
        className,
      )}
    >
      <span className="font-semibold tabular-nums">{score}</span>
      {style.label}
    </span>
  );
}
