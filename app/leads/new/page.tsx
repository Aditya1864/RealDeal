import Link from "next/link";
import { LeadForm } from "@/components/lead-form";

export default function NewLeadPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to board
      </Link>
      <h1 className="mt-4 mb-6 text-2xl font-semibold">New lead</h1>
      <LeadForm />
    </main>
  );
}
