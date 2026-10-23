import { cn } from "@/lib/utils";
import type { PriorityTag } from "@/lib/scoring";

// One palette for everything that shows a priority tag: the card's score pill
// and left stripe, the selected-card outline, and the detail panel's score ring.
export const TAG_STYLES: Record<
  PriorityTag,
  {
    label: string;
    pill: string;
    accent: string;
    selected: string;
    stroke: string;
  }
> = {
  hot: {
    label: "Hot",
    pill: "bg-[#d9483b]/10 text-[#c23b2e] dark:text-[#f0786c]",
    accent: "border-l-[#d9483b]",
    selected: "ring-1 ring-[#d9483b]",
    stroke: "stroke-[#d9483b] dark:stroke-[#f0786c]",
  },
  warm: {
    label: "Warm",
    pill: "bg-[#c98a1b]/10 text-[#a8710f] dark:text-[#e0a84a]",
    accent: "border-l-[#c98a1b]",
    selected: "ring-1 ring-[#c98a1b]",
    stroke: "stroke-[#c98a1b] dark:stroke-[#e0a84a]",
  },
  cold: {
    label: "Cold",
    pill: "bg-[#3d6b94]/10 text-[#3d6b94] dark:text-[#7fa6c9]",
    accent: "border-l-[#3d6b94]",
    selected: "ring-1 ring-[#3d6b94]",
    stroke: "stroke-[#3d6b94] dark:stroke-[#7fa6c9]",
  },
};

// Qualified leads are green on the board, whatever their priority tag.
export const QUALIFIED_STYLE = {
  pill: "bg-[#1f6e4d]/10 text-[#1f6e4d] dark:text-[#5fb88f]",
  accent: "border-l-[#1f6e4d]",
  selected: "ring-1 ring-[#1f6e4d]",
};

/** Small tinted pill with the score; the tag shows through its colour. */
export function PriorityBadge({
  score,
  tag,
  qualified = false,
  className,
}: {
  score: number;
  tag: PriorityTag;
  qualified?: boolean;
  className?: string;
}) {
  const style = TAG_STYLES[tag];
  return (
    <span
      title={style.label}
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        qualified ? QUALIFIED_STYLE.pill : style.pill,
        className,
      )}
    >
      <span className="sr-only">{style.label}, score </span>
      {score}
    </span>
  );
}
