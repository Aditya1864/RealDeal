import { db } from "@/lib/db";
import { leadAnalyses } from "@/lib/db/schema";
import { getCallOutcomes, type Lead } from "@/lib/db/queries";
import { analyzeLead } from "@/lib/ai/analyze-lead";
import { reAnalyzeLead } from "@/lib/ai/re-analyze-lead";
import type { Analysis } from "@/lib/ai/schemas";
import { computeScore } from "@/lib/scoring";

// The model is asked for YYYY-MM-DD; anything else would make the insert fail.
function toIsoDateOrNull(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? null : value;
}

/** Scores an analysis and stores it as a new row (existing rows are never touched). */
export async function storeAnalysis(leadId: number, analysis: Analysis) {
  const { score, tag } = computeScore(analysis.scoringFactors);
  const { scoringFactors: f } = analysis;

  const [saved] = await db
    .insert(leadAnalyses)
    .values({
      leadId,
      summary: analysis.summary,
      intent: analysis.intent,
      keyRequirements: analysis.keyRequirements,
      objections: analysis.objections,
      recommendedNextAction: analysis.recommendedNextAction,
      suggestedResponse: analysis.suggestedResponse,
      missingOrAmbiguousInfo: analysis.missingOrAmbiguousInfo,
      buyingTimelineRating: f.buyingTimeline.rating,
      buyingTimelineEvidence: f.buyingTimeline.evidence,
      budgetFitRating: f.budgetFit.rating,
      budgetFitEvidence: f.budgetFit.evidence,
      locationFitRating: f.locationFit.rating,
      locationFitEvidence: f.locationFit.evidence,
      propertyRequirementFitRating: f.propertyRequirementFit.rating,
      propertyRequirementFitEvidence: f.propertyRequirementFit.evidence,
      priorityScore: score,
      priorityTag: tag,
      suggestedFollowUpDate: toIsoDateOrNull(analysis.suggestedFollowUpDate),
    })
    .returning();
  return saved;
}

/**
 * Analyzes a lead and stores the result as a new analysis row. A lead with no
 * logged calls gets a first-pass analysis; otherwise the full call history is
 * included in a re-analysis.
 */
export async function analyzeAndStoreLead(lead: Lead) {
  const intake = {
    name: lead.name,
    location: lead.location,
    propertyRequirement: lead.propertyRequirement,
    budget: lead.budget,
    buyingTimeline: lead.buyingTimeline,
    customerMessage: lead.customerMessage,
  };
  const outcomes = await getCallOutcomes(lead.id);
  const analysis = outcomes.length
    ? await reAnalyzeLead(intake, outcomes)
    : await analyzeLead(intake);
  return storeAnalysis(lead.id, analysis);
}
