import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { callOutcomes, leads } from "@/lib/db/schema";
import { getLeadById } from "@/lib/db/queries";
import { callOutcomeSchema } from "@/lib/ai/schemas";
import { analyzeAndStoreLead } from "@/lib/lead-analysis";

// Re-analysis is awaited in the request, so this bounds how long it may take.
export const maxDuration = 60;

/** Logs a call outcome, then re-analyzes the lead using the full call history. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/leads/[id]/outcome">,
) {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid lead id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = callOutcomeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const lead = await getLeadById(id);
  if (!lead) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }

  // The call happened whether or not the AI call below succeeds, so record it
  // (and the contact time) first.
  const now = new Date();
  await db
    .insert(callOutcomes)
    .values({ leadId: id, notes: parsed.data.notes });
  await db
    .update(leads)
    .set({ lastContactedAt: now, updatedAt: now })
    .where(eq(leads.id, id));

  try {
    const analysis = await analyzeAndStoreLead(lead);
    await db
      .update(leads)
      .set({
        nextFollowUpAt: analysis.suggestedFollowUpDate
          ? new Date(`${analysis.suggestedFollowUpDate}T00:00:00Z`)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id));
    return Response.json(analysis, { status: 201 });
  } catch (error) {
    console.error(`Re-analysis failed for lead ${id}:`, error);
    return Response.json(
      { error: "Call saved, but re-analysis failed. Please try again." },
      { status: 502 },
    );
  }
}
