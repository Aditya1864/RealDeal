import { getLeadById } from "@/lib/db/queries";
import { analyzeAndStoreLead } from "@/lib/lead-analysis";

// Analysis is awaited in the request, so this bounds how long it may take.
export const maxDuration = 60;

/** Runs a fresh analysis for a lead and stores it as a new history row. */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/leads/[id]/analyze">,
) {
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid lead id" }, { status: 400 });
  }

  const lead = await getLeadById(id);
  if (!lead) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    const analysis = await analyzeAndStoreLead(lead);
    return Response.json(analysis, { status: 201 });
  } catch (error) {
    console.error(`Analysis failed for lead ${id}:`, error);
    return Response.json(
      { error: "Analysis failed. Please try again." },
      { status: 502 },
    );
  }
}
