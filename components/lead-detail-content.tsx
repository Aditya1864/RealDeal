import type { LeadWithAnalysis } from "@/lib/db/queries";

// Placeholder body; the real detail content comes in the next step.
export function LeadDetailContent({ lead }: { lead: LeadWithAnalysis }) {
  return <h2 className="pr-10 text-2xl font-serif font-bold">{lead.name}</h2>;
}
