import { getLeadById } from "@/lib/db/queries";

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
