import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { getLeadById } from "@/lib/db/queries";
import { stageUpdateSchema } from "@/lib/ai/schemas";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/leads/[id]">,
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
  return Response.json(lead);
}

/** Manual stage change: the salesperson moves a lead between New and Qualified. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/leads/[id]">,
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
  const parsed = stageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [lead] = await db
    .update(leads)
    .set({ stage: parsed.data.stage, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning();
  if (!lead) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }
  return Response.json(lead);
}
