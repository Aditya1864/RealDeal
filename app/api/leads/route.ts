import { after } from "next/server";
import { db } from "@/lib/db";
import { getLeadsWithLatestAnalysis } from "@/lib/db/queries";
import { leads } from "@/lib/db/schema";
import { intakeSchema } from "@/lib/ai/schemas";
import { analyzeAndStoreLead } from "@/lib/lead-analysis";

// Analysis runs in after(), so this bounds how long it may take.
export const maxDuration = 60;

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

  // Respond as soon as the lead is saved; the analysis runs after the response
  // and shows up on the board once stored. If it fails, the lead simply has no
  // analysis (the UI shows "Analysis failed"; retry via /api/leads/[id]/analyze).
  after(async () => {
    try {
      await analyzeAndStoreLead(lead);
    } catch (error) {
      console.error(`Analysis failed for lead ${lead.id}:`, error);
    }
  });

  return Response.json({ ...lead, analysis: null }, { status: 201 });
}

export async function GET() {
  return Response.json(await getLeadsWithLatestAnalysis());
}
