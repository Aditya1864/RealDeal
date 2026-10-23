import { db } from "@/lib/db";
import { leadAnalyses } from "@/lib/db/schema";
import type { Lead } from "@/lib/db/queries";
import { analyzeLead } from "@/lib/ai/analyze-lead";
import { computeScore } from "@/lib/scoring";

/** Runs first-pass analysis for a lead, scores it, and stores a new analysis row. */
export async function analyzeAndStoreLead(lead: Lead) {
  const analysis = await analyzeLead({
    name: lead.name,
    location: lead.location,
    propertyRequirement: lead.propertyRequirement,
    budget: lead.budget,
    buyingTimeline: lead.buyingTimeline,
    customerMessage: lead.customerMessage,
  });
  const { score, tag } = computeScore(analysis.scoringFactors);
  const { scoringFactors: f } = analysis;

  const [saved] = await db
    .insert(leadAnalyses)
    .values({
      leadId: lead.id,
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
      suggestedFollowUpDate: analysis.suggestedFollowUpDate,
    })
    .returning();
  return saved;
}
