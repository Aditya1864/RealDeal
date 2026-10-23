# RealDeal — AI-Powered Lead Prioritization for Real Estate

Campus recruitment assignment for Masal AI (FDE Round 2). Built in Next.js,
deployed on Vercel, using free-tier tools only.

## What this app does
Salespeople submit real-estate lead inquiries. An LLM analyzes each one,
extracts structured insight, and a deterministic scoring function ranks
leads by priority. A Kanban board (New Leads / Qualified) tracks workflow
state. A grounded per-lead chat helps the salesperson prep. Logging a call
outcome re-triggers analysis and can move a lead between columns.

---

## Stack
- **Framework**: Next.js (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui (Radix UI primitives, Nova preset)
- **AI SDK**: Vercel AI SDK (`ai` package) — `generateObject` for structured
  analysis, `streamText` + `useChat` for the chat feature
- **AI models**: Groq (`openai/gpt-oss-120b`) as primary, Gemini
  (`gemini-3.8-flash`) as fallback if Groq fails or rate-limits
- **Validation**: Zod (shared between AI output schema and form validation)
- **Database**: Neon (serverless Postgres)
- **ORM**: Drizzle ORM
- **Hosting**: Vercel
- **Auth**: none — explicitly out of scope for this assignment

All AI calls happen server-side only (API routes). Keys never reach the
client.

---

## File structure

```
app/
  layout.tsx
  page.tsx                      # Kanban board (New Leads / Qualified)
  leads/
    new/page.tsx                # Intake form
    [id]/page.tsx                # Lead detail: analysis, chat, call log
  api/
    leads/
      route.ts                  # GET list, POST create (analysis runs in after())
      [id]/
        route.ts                # GET single, PATCH (stage changes)
        analyze/route.ts        # POST → first-pass AI analysis
        outcome/route.ts        # POST → log call, re-analyze, re-score
    chat/[id]/route.ts          # POST → grounded streaming chat

components/
  ui/                           # shadcn primitives
  lead-form.tsx
  lead-card.tsx                 # Kanban card: name, score badge, snippet
  lead-detail.tsx
  priority-badge.tsx            # Hot/Warm/Cold
  kanban-board.tsx              # New Leads / Qualified columns
  chat-panel.tsx
  follow-up-panel.tsx           # Call outcome log + history

lib/
  db/
    schema.ts                   # Drizzle tables
    index.ts                    # DB client
  ai/
    client.ts                   # Groq/Gemini provider setup + fallback
    analyze-lead.ts              # First-pass analysis prompt + call
    re-analyze-lead.ts           # Re-analysis prompt (includes call history)
    chat.ts                      # Grounded chat system prompt builder
    schemas.ts                   # Zod schemas (AI output, intake, chat)
  scoring.ts                     # Deterministic score/tag computation

scripts/
  seed.ts                        # 8 sample leads through real pipeline

drizzle.config.ts
.env.local                       # GROQ_API_KEY, GEMINI_API_KEY, DATABASE_URL
```

---

## Data model

### `leads`
Raw intake data, entered once.
- `id`, `name`, `location`, `propertyRequirement`, `budget` (free text),
  `buyingTimeline` (enum: immediate/short_term/medium_term/long_term/unspecified),
  `customerMessage` (free text)
- `stage` (enum: `"new" | "qualified"`) — manual workflow state, salesperson-controlled
- `lastContactedAt`, `nextFollowUpAt`
- `createdAt`, `updatedAt`

### `leadAnalyses`
**History table** — one new row per analysis run, NEVER overwritten. This is
required for the re-scoring feature to show before/after, and for qualify/
demote nudges to compare latest vs. previous state.
- `id`, `leadId` (FK)
- `summary`, `intent`, `keyRequirements` (string[]), `objections` (string[]),
  `recommendedNextAction`, `suggestedResponse`, `missingOrAmbiguousInfo` (string[])
- Four BANT-style scoring factors, each with `rating` (0-10) and `evidence` (string):
  `buyingTimelineRating/Evidence`, `budgetFitRating/Evidence`,
  `locationFitRating/Evidence`, `propertyRequirementFitRating/Evidence`
- `priorityScore` (0-100, computed by code, not AI)
- `priorityTag` (enum: hot/warm/cold, computed by code)
- `suggestedFollowUpDate` (nullable ISO date)
- `createdAt`

### `chatMessages`
Per-lead grounded chat history.
- `id`, `leadId` (FK), `role` (user/assistant), `content`, `createdAt`

### `callOutcomes`
The "own feature" — post-call logging.
- `id`, `leadId` (FK), `notes` (free text), `nextFollowUpAt`, `createdAt`

---

## The AI output contract

The AI NEVER outputs a final score or Hot/Warm/Cold tag directly. It only
rates four factors 0-10 with evidence. All final scoring math happens in
`lib/scoring.ts`, in plain TypeScript — this keeps every score explainable
and consistent, rather than an opaque number the model invented.

```
summary: string
intent: string
keyRequirements: string[]
objections: string[]
recommendedNextAction: string
suggestedResponse: string          // customer-facing tone: warm, professional
missingOrAmbiguousInfo: string[]

scoringFactors:
  buyingTimeline:          { rating: 0-10, evidence: string }
  budgetFit:                { rating: 0-10, evidence: string }
  locationFit:               { rating: 0-10, evidence: string }
  propertyRequirementFit:    { rating: 0-10, evidence: string }

suggestedFollowUpDate: string | null   // used on re-analysis only
```

Validate with Zod (`lib/ai/schemas.ts`). If the model returns malformed
JSON, retry once before failing.

---

## Scoring formula (BANT-inspired, deterministic)

```
score = (buyingTimeline.rating / 10) × 35
      + (budgetFit.rating / 10)      × 30
      + (locationFit.rating / 10)    × 20
      + (propertyRequirementFit.rating / 10) × 15

Hot:  75–100
Warm: 45–74
Cold: 0–44
```

Implemented in `lib/scoring.ts`. Never let the AI compute or output this
number directly — code owns the math, AI only supplies ratings + evidence.

---

## Kanban board: New Leads / Qualified

- Two columns only. Button-based moves — **no drag-and-drop** (out of scope
  for time budget).
- Every card shows its `priorityScore`/`priorityTag` regardless of column —
  stage (workflow state) and priority (AI assessment) are independent
  signals, both visible.
- **Qualify/demote is never automatic.** A nudge button only appears when:
  1. A call outcome has just been logged for that lead, AND
  2. The resulting re-analysis crosses the 70-point threshold in the
     relevant direction
  3. Specifically:
     - Lead is "New" + re-score ≥ 70 → show **"Move to Qualified"** button
     - Lead is "Qualified" + re-score < 70 → show **"Move back to New"** button
  4. The salesperson must click the button — the system never moves a card
     on its own. This is a deliberate trust/safeguard decision: worth
     stating explicitly in the README and demo.
- A lead's FIRST analysis (from intake, before any call) never triggers a
  qualify nudge, even if the score is high — qualification requires at
  least one logged call.

---

## Own feature: post-call outcome logging

1. Salesperson opens a lead, clicks "Log Call Outcome"
2. Types free-text notes (e.g. "Spoke, budget confirmed 85L, wants Sunday visit")
3. POST `/api/leads/[id]/outcome`:
   - Save notes to `callOutcomes`
   - Re-run analysis via `lib/ai/re-analyze-lead.ts`, passing the ORIGINAL
     lead data + FULL call outcome history (chronological) as context
   - Insert new row into `leadAnalyses` (never overwrite)
   - Update `leads.lastContactedAt`; parse `suggestedFollowUpDate` into
     `leads.nextFollowUpAt`
   - Apply qualify/demote nudge logic above
4. UI shows updated score/tag, nudge button if applicable, and the outcome
   appears in a timeline on the lead detail page

Re-analysis prompt must include full call history in chronological order,
not just the latest note — the AI needs to see the full trajectory of the
conversation to assess accurately.

**Status**: steps 1–4 are built except the qualify/demote nudge, which is the
next step. The "Log Call Outcome" form and call timeline live in
`components/lead-detail-content.tsx` (there is no separate `follow-up-panel.tsx`).
Where the implementation differs from the list above:
- `leads.lastContactedAt` is set as soon as the note is saved, before the AI
  call, since the call happened whether or not re-analysis succeeds.
- `leads.nextFollowUpAt` is set from `suggestedFollowUpDate`, or cleared if the
  model returns none.
- If re-analysis fails, the route returns 502 ("Call saved, but re-analysis
  failed"): the note stays in the timeline and no new analysis row is added.
- Unlike intake, the outcome request is synchronous (awaited, no polling).

---

## Grounded chat

- Scoped per lead. System prompt rebuilt FRESH on every message from
  current DB state (raw lead data + latest analysis + full call history) —
  never cached/static, since logging a call should immediately be
  reflected in chat answers.
- System prompt instructs: only answer questions about this lead; never
  invent facts not present in the data; if asked about anything else,
  redirect.
- Customer's raw message is wrapped in clear delimiters and explicitly
  marked as untrusted data, not instructions (prompt injection awareness —
  mention this in the README).
- Streamed via Vercel AI SDK (`streamText` + `useChat`) for responsive UX.
- Persisted in `chatMessages`, survives reloads.
- **Fixed quick-prompt chips** (same 4 for every lead, no per-lead logic):
  1. "Draft a follow-up message"
  2. "What should I emphasize on my next call?"
  3. "Help me handle their objection"
  4. "Summarize this lead for my manager"

---

## AI call behavior
- **Background analysis on intake**: `POST /api/leads` inserts the lead and
  responds immediately (`analysis: null`); the analysis runs in Next's `after()`
  (via `analyzeAndStoreLead` in `lib/lead-analysis.ts`) and is stored when done.
  The form redirects straight to `/?open={id}`, and the board and detail panel
  poll every 3s while a lead is still analyzing. There is no queue: `after()`
  is bounded by the route's `maxDuration` (60s), so note in README that a real
  deployment would use a proper job queue.
- **Analysis status in the UI**: a lead with no analysis row shows "Analyzing…"
  if it is under 2 minutes old, otherwise "Analysis failed" (see
  `lib/analysis-status.ts`). A failed analysis is only logged server-side. The
  "Retry analysis" button (shown only when a lead has no analysis) POSTs to
  `/api/leads/[id]/analyze`, which awaits `analyzeAndStoreLead()` and inserts a
  new `leadAnalyses` row. `analyzeAndStoreLead()` (`lib/lead-analysis.ts`) picks
  the mode itself: first-pass `analyzeLead()` if the lead has no logged calls,
  otherwise `reAnalyzeLead()` with the full call history. The outcome route uses
  the same helper.
- **Fallback**: if Groq fails (rate limit, error), retry via Gemini before
  surfacing an error to the user.
- Never call AI providers from the client — always through API routes.

---

## Seed data
8 sample leads in `scripts/seed.ts`, deliberately varied — a few clearly
Hot, a few clearly Cold, a couple genuinely ambiguous/Warm. Each is run
through the REAL analysis pipeline (not faked scores), so the live URL
never looks empty and genuinely demonstrates the AI working end-to-end.

---

## Environment variables
```
GROQ_API_KEY=
GEMINI_API_KEY=
DATABASE_URL=            # Neon pooled connection string
```

---

## Known limitations (be upfront about these in the README)
- No authentication
- Analysis runs via `after()` with no queue or automatic retry (not a
  production-scale pattern); failures only show as "Analysis failed"
- Scoring weights are heuristic, not learned from real conversion data
- Free-tier AI rate limits apply
- No drag-and-drop on the Kanban board (button-based moves only)

---

## Conventions
- Prefer editing/reading files directly over shell one-liners for app code
- Keep AI prompt-building logic in `lib/ai/`, scoring logic in `lib/scoring.ts`
  — do not blend the two
- Commit after each working feature, not in one giant commit at the end

---

## Build notes / discovered constraints
- **Groq model**: use `openai/gpt-oss-120b`, NOT `llama-3.3-70b-versatile` — the
  latter is now Enterprise-only on Groq and returns a 404 on a free-tier key.
  Confirmed working via `scripts/test-analyze.ts`.
- **Gemini model**: use `gemini-3.8-flash`, NOT `gemini-2.5-flash` — the latter is
  deprecated for new accounts and returns a 404. NOTE: this fallback path has
  not actually been exercised yet (Groq has always succeeded on the first try
  in testing), so it is unverified — don't assume it works without testing it
  directly.
- **Structured output bounds**: Groq's structured output (`generateObject` via
  `response_format: json_schema`) correctly accepts and enforces
  minimum/maximum integer bounds on the scoring factor ratings — no need to
  relax that schema constraint.
- **Env loading**: neither `tsx` nor `drizzle-kit` auto-load `.env.local` the way
  `next dev` does. Standalone scripts must be run with
  `npx tsx --env-file=.env.local <script>`. The `db:push` npm script already
  wraps this for Drizzle pushes — use `npm run db:push`, never a bare
  `drizzle-kit push`.
- **`@hookform/resolvers` could not be installed** — `ERESOLVE` conflict on
  optional peer deps (`effect`, `@typeschema/*`). Worked around with a small
  hand-rolled resolver in `lead-form.tsx` that calls `intakeSchema.safeParse()`
  directly. This is an intentional, permanent workaround, not a TODO — don't try
  to install the package again or "fix" this unless the workaround itself
  causes a problem.
- **shadcn's Nova preset has no `form` component** — the form uses `field` +
  `react-hook-form` directly instead of shadcn's form wrapper. This is expected,
  not a gap.
- **Confirmed end-to-end**: intake form → `POST /api/leads` → `analyzeLead()` →
  `computeScore()` → both DB rows inserted → visible via `GET /api/leads`.
  Tested manually via `npm run dev`.
- **Intake is no longer synchronous**: the end-to-end flow above now returns
  from `POST /api/leads` as soon as the lead row is saved; the analysis row
  appears a few seconds later (verified: POST ~0.7s, analysis stored within
  ~3s). Don't restore a blocking AI call in the request path without a reason.
- **One system prompt, two modes**: `lib/ai/prompt-parts.ts` holds the shared
  system prompt (BANT factors, locality awareness, anti-templating, injection
  guard) via `buildSystemPrompt("first_pass" | "re_analysis")`, plus helpers that
  wrap untrusted text in tags. `analyze-lead.ts` and `re-analyze-lead.ts` both
  use it, with `temperature: 0.7`. Change prompt wording there, not in each file.
- **Relative dates**: LLMs get weekday arithmetic wrong ("this Sunday" came back
  as a Saturday when given only today's date). The re-analysis prompt therefore
  includes a 21-day calendar table with weekdays to read dates from. Stored
  follow-up dates are validated as `YYYY-MM-DD` (else null) before insert.
- **Score explanation line** (`explain()` in `lib/scoring.ts`): a glanceable label
  capped at ~60 chars, e.g. "Cold — buying timeline: Customer says they already
  signed…". Hot names the strongest factor, Cold the weakest, Warm both (short
  labels, so excerpts are tiny). It is computed in the browser from the stored
  ratings/evidence, not stored. The excerpt is the opening words of the evidence,
  truncated at a word boundary.
