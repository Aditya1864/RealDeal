import { LeadForm } from "@/components/lead-form";

export default function NewLeadPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">New lead</h1>
      <LeadForm />
    </main>
  );
}
