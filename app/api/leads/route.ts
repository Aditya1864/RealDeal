import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, leadAnalyses } from "@/lib/db/schema";
import { intakeSchema } from "@/lib/ai/schemas";
import { analyzeLead } from "@/lib/ai/analyze-lead";
import { computeScore } from "@/lib/scoring";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = intakeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const intake = parsed.data;

  const [lead] = await db.insert(leads).values(intake).returning();

  try {
    const analysis = await analyzeLead(intake);
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

    return Response.json({ ...lead, analysis: saved }, { status: 201 });
  } catch (error) {
    console.error("Lead analysis failed:", error);
    // The lead is saved; analysis can be retried via /api/leads/[id]/analyze.
    return Response.json(
      { error: "Lead saved, but AI analysis failed", lead },
      { status: 502 },
    );
  }
}

export async function GET() {
  const [allLeads, latestAnalyses] = await Promise.all([
    db.select().from(leads),
    db
      .selectDistinctOn([leadAnalyses.leadId])
      .from(leadAnalyses)
      .orderBy(
        leadAnalyses.leadId,
        desc(leadAnalyses.createdAt),
        desc(leadAnalyses.id),
      ),
  ]);

  const analysisByLead = new Map(latestAnalyses.map((a) => [a.leadId, a]));

  // Highest priority first; unanalyzed leads last; newest first on ties.
  const result = allLeads
    .map((lead) => ({ ...lead, analysis: analysisByLead.get(lead.id) ?? null }))
    .sort(
      (a, b) =>
        (b.analysis?.priorityScore ?? -1) - (a.analysis?.priorityScore ?? -1) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );

  return Response.json(result);
}
