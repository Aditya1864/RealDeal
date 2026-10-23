import type { Analysis } from "@/lib/ai/schemas";
import type { priorityTagEnum } from "@/lib/db/schema";

export type ScoringFactors = Analysis["scoringFactors"];
export type FactorKey = keyof ScoringFactors;
export type PriorityTag = (typeof priorityTagEnum.enumValues)[number];

export type ScoreResult = {
  score: number; // integer, 0-100
  tag: PriorityTag;
  explanation: string;
};

const WEIGHTS: Record<FactorKey, number> = {
  buyingTimeline: 35,
  budgetFit: 30,
  locationFit: 20,
  propertyRequirementFit: 15,
};

const LABELS: Record<FactorKey, string> = {
  buyingTimeline: "buying timeline",
  budgetFit: "budget fit",
  locationFit: "location fit",
  propertyRequirementFit: "property requirement fit",
};

const FACTOR_KEYS = Object.keys(WEIGHTS) as FactorKey[];

function tagFor(score: number): PriorityTag {
  if (score >= 75) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}

function joinLabels(keys: FactorKey[]): string {
  return keys.map((k) => LABELS[k]).join(" and ");
}

// Factors tied at the extreme rating (highest or lowest), heavier weights
// first, capped at two so the explanation stays short.
function extremeFactors(
  factors: ScoringFactors,
  direction: "highest" | "lowest",
): FactorKey[] {
  const sorted = [...FACTOR_KEYS].sort((a, b) => {
    const diff = factors[a].rating - factors[b].rating;
    return (direction === "highest" ? -diff : diff) || WEIGHTS[b] - WEIGHTS[a];
  });
  const extreme = factors[sorted[0]].rating;
  return sorted.filter((k) => factors[k].rating === extreme).slice(0, 2);
}

function explain(tag: PriorityTag, factors: ScoringFactors): string {
  const label = tag[0].toUpperCase() + tag.slice(1);
  if (tag === "hot") {
    return `${label} — driven by strong ${joinLabels(extremeFactors(factors, "highest"))}`;
  }
  if (tag === "cold") {
    return `${label} — held back by weak ${joinLabels(extremeFactors(factors, "lowest"))}`;
  }
  const [best] = extremeFactors(factors, "highest");
  const [worst] = extremeFactors(factors, "lowest");
  return `${label} — strongest on ${LABELS[best]}, weakest on ${LABELS[worst]}`;
}

/** Deterministic BANT-inspired priority score. The AI supplies ratings only. */
export function computeScore(factors: ScoringFactors): ScoreResult {
  const raw = FACTOR_KEYS.reduce(
    (sum, k) => sum + (factors[k].rating / 10) * WEIGHTS[k],
    0,
  );
  const score = Math.min(100, Math.max(0, Math.round(raw)));
  const tag = tagFor(score);
  return { score, tag, explanation: explain(tag, factors) };
}
