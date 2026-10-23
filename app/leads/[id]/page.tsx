import { Suspense } from "react";
import Link from "next/link";

async function LeadId({ params }: Pick<PageProps<"/leads/[id]">, "params">) {
  const { id } = await params;
  return <p className="text-muted-foreground">Lead #{id}</p>;
}

// Placeholder until the real lead detail page is built.
export default function LeadDetailPage(props: PageProps<"/leads/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to board
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Lead detail</h1>
      <Suspense>
        <LeadId params={props.params} />
      </Suspense>
    </main>
  );
}
