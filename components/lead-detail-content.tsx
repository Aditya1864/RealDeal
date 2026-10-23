"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Lightbulb, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FactorBar } from "@/components/factor-bar";
import { ScoreRing } from "@/components/score-ring";
import { missingAnalysisLabel } from "@/lib/analysis-status";
import { computeScore } from "@/lib/scoring";
import type { LeadWithAnalysis } from "@/lib/db/queries";

// What the lead looks like after crossing the JSON boundary of the API.
type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;
type LeadDetail = Jsonify<LeadWithAnalysis>;
type Analysis = NonNullable<LeadDetail["analysis"]>;

type FetchResult = { id: number; lead: LeadDetail | null };

export function LeadDetailContent({ lead }: { lead: LeadWithAnalysis }) {
  const leadId = lead.id;
  const [result, setResult] = useState<FetchResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/leads/${leadId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: LeadDetail) => setResult({ id: leadId, lead: data }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ id: leadId, lead: null });
      });
    return () => controller.abort();
  }, [leadId, refreshKey]);

  const current = result?.id === leadId ? result : null;

  // Analysis runs after the lead is created, so keep checking while it is
  // still in progress.
  const isAnalyzing =
    !!current?.lead &&
    !current.lead.analysis &&
    missingAnalysisLabel(current.lead.createdAt) === "Analyzing…";
  useEffect(() => {
    if (!isAnalyzing) return;
    const timer = setTimeout(() => setRefreshKey((k) => k + 1), 3000);
    return () => clearTimeout(timer);
  }, [isAnalyzing, refreshKey]);

  return (
    <div className="space-y-6">
      <h2 className="pr-10 text-2xl font-serif font-bold">{lead.name}</h2>
      {!current ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !current.lead ? (
        <p className="text-sm text-muted-foreground">
          Couldn’t load lead details.
        </p>
      ) : current.lead.analysis ? (
        <AnalysisSections analysis={current.lead.analysis} />
      ) : (
        <MissingAnalysis
          leadId={leadId}
          createdAt={current.lead.createdAt}
          onRetried={() => {
            setRefreshKey((k) => k + 1);
            router.refresh(); // update the board card behind the panel
          }}
        />
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function MissingAnalysis({
  leadId,
  createdAt,
  onRetried,
}: {
  leadId: number;
  createdAt: string;
  onRetried: () => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/analyze`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Analysis failed");
      }
      onRetried();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-4">
      <p className="text-sm italic text-muted-foreground">
        {missingAnalysisLabel(createdAt)}
      </p>
      <Button variant="outline" size="sm" onClick={retry} disabled={retrying}>
        {retrying ? "Retrying…" : "Retry analysis"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function AnalysisSections({ analysis }: { analysis: Analysis }) {
  const [copied, setCopied] = useState(false);

  const factors = {
    buyingTimeline: {
      rating: analysis.buyingTimelineRating,
      evidence: analysis.buyingTimelineEvidence,
    },
    budgetFit: {
      rating: analysis.budgetFitRating,
      evidence: analysis.budgetFitEvidence,
    },
    locationFit: {
      rating: analysis.locationFitRating,
      evidence: analysis.locationFitEvidence,
    },
    propertyRequirementFit: {
      rating: analysis.propertyRequirementFitRating,
      evidence: analysis.propertyRequirementFitEvidence,
    },
  };
  const { explanation } = computeScore(factors);

  async function copyResponse() {
    try {
      await navigator.clipboard.writeText(analysis.suggestedResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context); leave the button as is.
    }
  }

  return (
    <>
      <section className="space-y-2">
        <p className="text-base leading-relaxed">{analysis.summary}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Intent:</span>{" "}
          {analysis.intent}
        </p>
      </section>

      <section className="flex items-center gap-4">
        <ScoreRing score={analysis.priorityScore} tag={analysis.priorityTag} />
        <p className="rounded-md bg-muted px-3 py-2 text-sm font-medium">
          {explanation}
        </p>
      </section>

      <section className="space-y-4">
        <FactorBar
          label="Buying timeline"
          rating={factors.buyingTimeline.rating}
          evidence={factors.buyingTimeline.evidence}
        />
        <FactorBar
          label="Budget fit"
          rating={factors.budgetFit.rating}
          evidence={factors.budgetFit.evidence}
        />
        <FactorBar
          label="Location fit"
          rating={factors.locationFit.rating}
          evidence={factors.locationFit.evidence}
        />
        <FactorBar
          label="Property requirement fit"
          rating={factors.propertyRequirementFit.rating}
          evidence={factors.propertyRequirementFit.evidence}
        />
      </section>

      <Section title="Key requirements">
        {analysis.keyRequirements.length === 0 ? (
          <p className="text-sm text-muted-foreground">None noted.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {analysis.keyRequirements.map((req, i) => (
              <li
                key={i}
                className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
              >
                {req}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Objections">
        {analysis.objections.length === 0 ? (
          <p className="text-sm text-muted-foreground">None identified.</p>
        ) : (
          <ul className="space-y-1.5">
            {analysis.objections.map((objection, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{objection}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {analysis.missingOrAmbiguousInfo.length > 0 && (
        <section className="rounded-lg border border-dashed p-3 text-muted-foreground">
          <h3 className="mb-1.5 text-sm font-semibold text-foreground">
            Missing or ambiguous info
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {analysis.missingOrAmbiguousInfo.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
        <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold">Recommended next action</h3>
          <p className="mt-1 text-sm">{analysis.recommendedNextAction}</p>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Suggested response</h3>
          <Button variant="outline" size="sm" onClick={copyResponse}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="rounded-lg rounded-tl-sm border bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">
          {analysis.suggestedResponse}
        </div>
      </section>
    </>
  );
}
