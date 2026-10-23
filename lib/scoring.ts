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

// The explanation is a glanceable label, so the whole line stays under this.
const MAX_EXPLANATION_LENGTH = 60;
// Below this many characters an evidence excerpt says nothing useful.
const MIN_EXCERPT_LENGTH = 8;

// Shorter labels for Warm, where two factors share the line.
const SHORT_LABELS: Record<FactorKey, string> = {
  buyingTimeline: "timeline",
  budgetFit: "budget",
  locationFit: "location",
  propertyRequirementFit: "property",
};

// First sentence-ish fragment of the evidence, cut at a word boundary to fit
// in `max` characters (the ellipsis included).
function excerpt(evidence: string, max: number): string {
  const text = evidence
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  if (text.length <= max) return text;
  const room = text.slice(0, max - 1);
  const lastSpace = room.lastIndexOf(" ");
  const cut = lastSpace >= MIN_EXCERPT_LENGTH ? room.slice(0, lastSpace) : room;
  return `${cut.replace(/[\s,;:–-]+$/, "")}…`;
}

// The single factor at the extreme rating (heavier weight wins ties).
function extremeFactor(
  factors: ScoringFactors,
  direction: "highest" | "lowest",
): FactorKey {
  return [...FACTOR_KEYS].sort((a, b) => {
    const diff = factors[a].rating - factors[b].rating;
    return (direction === "highest" ? -diff : diff) || WEIGHTS[b] - WEIGHTS[a];
  })[0];
}

function explain(tag: PriorityTag, factors: ScoringFactors): string {
  const head = `${tag[0].toUpperCase() + tag.slice(1)} — `;

  if (tag === "warm") {
    const best = extremeFactor(factors, "highest");
    const worst = extremeFactor(factors, "lowest");
    const keys = best === worst ? [best] : [best, worst];
    const fixed =
      head.length +
      keys.reduce((n, k) => n + SHORT_LABELS[k].length + 2, 0) + // "label: "
      (keys.length - 1) * 3; // " / "
    const each = Math.floor((MAX_EXPLANATION_LENGTH - fixed) / keys.length);
    if (each < MIN_EXCERPT_LENGTH) {
      return head + keys.map((k) => SHORT_LABELS[k]).join(" / ");
    }
    return (
      head +
      keys
        .map((k) => `${SHORT_LABELS[k]}: ${excerpt(factors[k].evidence, each)}`)
        .join(" / ")
    );
  }

  // Hot: the strongest factor. Cold: the weakest.
  const key = extremeFactor(factors, tag === "hot" ? "highest" : "lowest");
  const prefix = `${head}${LABELS[key]}: `;
  const room = MAX_EXPLANATION_LENGTH - prefix.length;
  if (room < MIN_EXCERPT_LENGTH || !factors[key].evidence.trim()) {
    return `${head}${LABELS[key]}`;
  }
  return prefix + excerpt(factors[key].evidence, room);
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
