function qualitativeLabel(rating: number): "Low" | "Medium" | "High" {
  if (rating <= 3) return "Low";
  if (rating <= 7) return "Medium";
  return "High";
}

export function FactorBar({
  label,
  rating,
  evidence,
}: {
  label: string;
  rating: number;
  evidence: string;
}) {
  const clamped = Math.min(10, Math.max(0, rating));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {qualitativeLabel(clamped)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={clamped}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e4e4e2] dark:bg-white/15"
      >
        <div
          className="h-full rounded-full bg-[#696969] dark:bg-[#a3a3a3] transition-[width] duration-500 ease-out"
          style={{ width: `${clamped * 10}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{evidence}</p>
    </div>
  );
}
