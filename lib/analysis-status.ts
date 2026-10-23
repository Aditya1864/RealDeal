// Analysis runs synchronously on submit, so a lead without one that is this
// fresh is still being analyzed; an older one means the analysis failed.
const ANALYZING_WINDOW_MS = 2 * 60 * 1000;

export function missingAnalysisLabel(
  createdAt: Date | string,
): "Analyzing…" | "Analysis failed" {
  const age = Date.now() - new Date(createdAt).getTime();
  return age < ANALYZING_WINDOW_MS ? "Analyzing…" : "Analysis failed";
}
