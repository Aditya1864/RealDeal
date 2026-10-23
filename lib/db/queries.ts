import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  callOutcomes,
  chatMessages,
  leads,
  leadAnalyses,
} from "@/lib/db/schema";

export type Lead = typeof leads.$inferSelect;
export type LeadAnalysis = typeof leadAnalyses.$inferSelect;
export type CallOutcome = typeof callOutcomes.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type LeadWithAnalysis = Lead & { analysis: LeadAnalysis | null };
export type LeadWithDetails = LeadWithAnalysis & {
  callOutcomes: CallOutcome[];
};

/**
 * All leads, each joined with its most recent analysis (null if none).
 * Ordered for the Kanban board: highest priorityScore first, unanalyzed
 * leads last, newest first on ties.
 */
export async function getLeadsWithLatestAnalysis(): Promise<
  LeadWithAnalysis[]
> {
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

/** A lead's call outcomes, oldest first. */
export async function getCallOutcomes(leadId: number): Promise<CallOutcome[]> {
  return db
    .select()
    .from(callOutcomes)
    .where(eq(callOutcomes.leadId, leadId))
    .orderBy(asc(callOutcomes.createdAt), asc(callOutcomes.id));
}

/**
 * One lead with its most recent analysis (null if none) and its call
 * outcomes (oldest first), or null if no such lead.
 */
export async function getLeadById(id: number): Promise<LeadWithDetails | null> {
  const [[lead], [analysis], outcomes] = await Promise.all([
    db.select().from(leads).where(eq(leads.id, id)),
    db
      .select()
      .from(leadAnalyses)
      .where(eq(leadAnalyses.leadId, id))
      .orderBy(desc(leadAnalyses.createdAt), desc(leadAnalyses.id))
      .limit(1),
    getCallOutcomes(id),
  ]);
  if (!lead) return null;
  return { ...lead, analysis: analysis ?? null, callOutcomes: outcomes };
}

/** A lead's chat messages, oldest first. With `limit`, only the most recent ones. */
export async function getChatMessages(
  leadId: number,
  limit?: number,
): Promise<ChatMessage[]> {
  const query = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.leadId, leadId))
    .orderBy(desc(chatMessages.id));
  const rows = limit ? await query.limit(limit) : await query;
  return rows.reverse();
}

/** Stores one completed question and answer, in that order. */
export async function saveChatExchange(
  leadId: number,
  userText: string,
  assistantText: string,
) {
  await db.insert(chatMessages).values([
    { leadId, role: "user", content: userText },
    { leadId, role: "assistant", content: assistantText },
  ]);
}
