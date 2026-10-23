import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, leadAnalyses } from "@/lib/db/schema";

export type Lead = typeof leads.$inferSelect;
export type LeadAnalysis = typeof leadAnalyses.$inferSelect;
export type LeadWithAnalysis = Lead & { analysis: LeadAnalysis | null };

/**
 * All leads, each joined with its most recent analysis (null if none).
 * Ordered for the Kanban board: highest priorityScore first, unanalyzed
 * leads last, newest first on ties.
 */
export async function getLeadsWithLatestAnalysis(): Promise<LeadWithAnalysis[]> {
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

  return allLeads
    .map((lead) => ({ ...lead, analysis: analysisByLead.get(lead.id) ?? null }))
    .sort(
      (a, b) =>
        (b.analysis?.priorityScore ?? -1) - (a.analysis?.priorityScore ?? -1) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
}
