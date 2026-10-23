# RealDeal

**AI-powered lead prioritization for real estate sales.**

A salesperson submits a lead. An LLM reads the inquiry and extracts structured
insight, plain TypeScript turns that into a priority score, and a Kanban board
shows where every lead stands. Logging a call re-analyzes the lead with
everything learned so far, and a per-lead chat helps prepare for the next
conversation.

Built with Next.js, deployed on Vercel, using free-tier services only.

LIVE URL: https://realdeal-rho.vercel.app/

**Contents:**
[What I built](#1-what-i-built) ·
[Architecture overview](#2-architecture-overview) ·
[AI models and how they are called](#3-ai-models-and-how-they-are-called) ·
[Running it locally](#4-running-it-locally) ·
[Key technical decisions](#5-key-technical-decisions) ·
[Known limitations](#6-known-limitations)

---

## 1. What I built

- **Lead intake.** A validated form (name, location, property requirement,
  budget, buying timeline, customer message). The lead is saved immediately and
  analyzed in the background.
- **AI analysis.** For each lead the model produces a summary, intent, key
  requirements, objections, missing information, a recommended next action, a
  suggested customer reply, and four 0–10 ratings with evidence (buying
  timeline, budget fit, location fit, property requirement fit).
- **Deterministic priority score.** The ratings are combined into a 0–100 score
  and a Hot / Warm / Cold tag by plain TypeScript, not by the model, plus a
  one-line explanation such as _"Cold — buying timeline: Customer says they
  already signed…"_.
- **Kanban board.** Four columns: Hot, Warm and Cold (leads still in the `new`
  stage, split by tag) and Qualified. Clicking a card opens a detail panel
  beside the board, so both stay visible.
- **Call-outcome logging with re-analysis.** The salesperson logs what happened
  on a call. The lead is re-analyzed using the original inquiry plus the full
  chronological call history, and the new score, summary and next action
  appear immediately. Earlier analyses are kept.
- **Qualify / demote buttons.** After a call pushes the score to 70 or higher,
  the panel offers "Move to Qualified". Nothing ever moves on its own.
- **Grounded per-lead chat.** An assistant that answers only from that lead's
  own data (intake form, customer message, call history, latest analysis) and
  says so when the data does not contain the answer. Four fixed quick prompts
  (draft a follow-up, call talking points, handle an objection, manager
  summary). Chat history is saved and survives reloads.
- **Retry analysis and sample data.** A failed analysis can be retried from the
  UI, and `npm run db:seed` loads six sample leads through the real pipeline.

---

## 2. Architecture overview

```
 Browser (React client components)
   ├─ Board, lead cards, detail panel, call log, chat (useChat)
   └─ never talks to an AI provider and never sees an API key
          │  fetch / streaming
          ▼
 Next.js App Router on Vercel
   ├─ Server components ── read leads + latest analysis straight from the DB
   ├─ Route handlers (/api/...)
   │     ├─ validate input with Zod
   │     ├─ read / write Postgres through Drizzle
   │     └─ call the AI layer (lib/ai) server-side only
   └─ lib/scoring.ts ── deterministic score, tag and explanation
          │                                   │
          ▼                                   ▼
 Neon (serverless Postgres)           Groq (primary) ─► Gemini (backup)
```

### Data model

| Table           | Purpose                                                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leads`         | Raw intake data entered once, plus `stage` (`new` or `qualified`, set only by the salesperson), `lastContactedAt` and `nextFollowUpAt`.                                                                                               |
| `lead_analyses` | **History table.** One new row per analysis run, never overwritten: summary, intent, requirements, objections, next action, suggested reply, the four ratings with evidence, and the code-computed `priorityScore` and `priorityTag`. |
| `call_outcomes` | The salesperson's call notes, in order.                                                                                                                                                                                               |
| `chat_messages` | Per-lead chat history (user and assistant messages).                                                                                                                                                                                  |

### API routes

| Route                           | Purpose                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `GET` / `POST /api/leads`       | List leads with their latest analysis, create a lead (analysis runs after the response).                              |
| `GET` / `PATCH /api/leads/[id]` | One lead with its latest analysis and call history, change a lead's stage.                                            |
| `POST /api/leads/[id]/analyze`  | Run a fresh analysis (used by "Retry analysis").                                                                      |
| `POST /api/leads/[id]/outcome`  | Save a call note, re-analyze with the full history, update follow-up dates. Returns `canQualify` / `canDemote` hints. |
| `GET` / `POST /api/chat/[id]`   | Saved chat history, and one streamed chat answer.                                                                     |

Pages: `/` (board with the detail panel), `/leads/new` (intake form),
`/leads/[id]` (full-page version of the detail view, for direct links).

### How a lead flows through the system

1. **Submit.** `POST /api/leads` validates the body, inserts the lead and
   responds straight away. The analysis is scheduled to run after the response.
2. **Analyze.** `analyzeLead()` asks the model for a schema-validated analysis.
   `computeScore()` turns its four ratings into the score and tag, and a new
   `lead_analyses` row is stored.
3. **Show.** The board and panel poll every 3 seconds while a lead is still
   analyzing, so the card moves into its column when the analysis lands.
4. **Log a call.** `POST /api/leads/[id]/outcome` stores the note, then
   `reAnalyzeLead()` runs with the original inquiry and every call so far. A new
   analysis row is stored, and `nextFollowUpAt` is set from the suggested date.

### Project layout

```
app/                  pages and API routes
components/           board, cards, detail panel, chat, shadcn/ui primitives
lib/ai/               prompts, provider setup and fallback, Zod schemas
lib/scoring.ts        deterministic score, tag and explanation
lib/lead-analysis.ts  analyze, score and store a lead
lib/db/               Drizzle schema, client and queries
scripts/seed.ts       sample leads
```

---

## 3. AI models and how they are called

All AI calls are made **server-side only**, through route handlers, using the
[Vercel AI SDK](https://ai-sdk.dev). API keys are environment variables and
never reach the browser.

| Use                           | Primary                    | Backup                         |
| ----------------------------- | -------------------------- | ------------------------------ |
| Lead analysis and re-analysis | Groq `openai/gpt-oss-120b` | Gemini `gemini-3.1-flash-lite` |
| Chat                          | Groq `openai/gpt-oss-120b` | Gemini `gemini-3.6-flash`      |

### Analysis: structured output

- **Call:** `generateObject` with a Zod schema (`lib/ai/schemas.ts`), so the
  response is validated before anything is stored. Temperature is 0.7 to avoid
  templated wording across leads.
- **What the model returns:** the summary, intent, requirements, objections,
  missing information, next action, suggested reply, and four ratings (0–10
  integers) with evidence. **It never returns a score or a Hot/Warm/Cold
  label.**
- **Prompt:** one shared system prompt (`lib/ai/prompt-parts.ts`) in two modes.
  _First pass_ analyzes the inquiry. _Re-analysis_ also receives the full call
  history, oldest first, and must visibly account for what has been learned
  since the inquiry. It also gets a 21-day calendar table, because models are
  unreliable at weekday arithmetic and the model is asked for a follow-up date.
  The prompt includes a rating rubric, instructions to use real locality
  knowledge where it adds value (and not to guess), and instructions against
  templated phrasing.
- **Untrusted input:** the customer's message and the call notes are wrapped in
  delimiters and declared to be data, never instructions.

### Chat: grounded streaming

- **Call:** `streamText`, streamed to the browser with the AI SDK's `useChat`.
  Temperature is 0.3, since answers should stick to the data.
- **Prompt:** rebuilt from the database on every message (intake data, customer
  message, call history, latest analysis), so a call logged a moment ago shows
  up in the next answer. Strict rules: use only the lead's data, say "that isn't
  in this lead's data" instead of guessing, no outside knowledge about places or
  prices, no promises on the salesperson's behalf, figures kept exactly as
  entered, raw notes outrank the AI's own analysis, off-topic questions are
  redirected.
- **History:** the server loads the last 20 saved messages itself and takes only
  the new message from the client, so the history cannot be rewritten from the
  browser.

### Reliability: fallback and timeouts

- **Analysis** tries Groq, then Gemini. A failure, an invalid response or no
  answer within 30 seconds triggers the fallback. The SDK also retries transient
  overload errors twice by default.
- **Chat** can only switch providers before the first token (a stream cannot be
  restarted halfway): Groq gets 15 seconds to start, then Gemini gets 30. A
  stream that breaks midway shows an error and the user can resend.

---

## 4. Running it locally

**Prerequisites:** Node.js 20.6 or newer (the scripts use `--env-file`), a free
[Neon](https://neon.tech) Postgres database, a free
[Groq](https://console.groq.com) API key and a free
[Google AI Studio](https://aistudio.google.com) (Gemini) API key.

```bash
git clone https://github.com/Aditya1864/RealDeal.git
cd RealDeal
npm install
```

Create `.env.local` in the project root:

```
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key
DATABASE_URL=your-neon-pooled-connection-string
```

Create the tables, optionally load sample data, and start the app:

```bash
npm run db:push    # create the tables in your Neon database
npm run db:seed    # optional: 6 sample leads through the real AI pipeline
npm run dev        # http://localhost:3000
```

`db:push` and `db:seed` load `.env.local` for you. `db:seed` makes real AI calls
(one per lead) and is safe to re-run: leads that already exist are skipped.
Other commands: `npm run build`, `npm run start`, `npm run lint`.

On Vercel, set the same three environment variables in the project settings.

---

## 5. Key technical decisions

1. **The model rates, code scores.** The model supplies ratings and evidence;
   `lib/scoring.ts` owns the arithmetic:
   `timeline × 35% + budget × 30% + location × 20% + requirement × 15%`,
   with Hot at 75 and above, Warm at 45–74, and Cold below 45. Every score is
   explainable and reproducible, instead of an opaque number the model made up.
2. **Analysis history is append-only.** Every run adds a row, which makes
   before-and-after comparisons and re-scoring after a call possible.
3. **A human decides on qualification.** The system only suggests "Move to
   Qualified" (after a call, when the re-score is 70 or higher). It never moves
   a card itself. A lead's first analysis never triggers a suggestion, since
   qualifying requires at least one logged call. Moving back to New is always
   available.
4. **Fast intake, analysis in the background.** Submitting a lead returns
   immediately and the analysis runs after the response, so the user is not
   left waiting on an LLM. The board polls until it lands.
5. **Chat history is owned by the server, and the prompt is rebuilt every
   time.** This keeps answers current and prevents a client from editing the
   conversation the model sees.
6. **Untrusted text is treated as data.** Customer messages and call notes are
   delimited and labeled in every prompt, and rendered chat replies drop images
   and links, so injected text cannot make the browser fetch anything.
7. **Fallback with timeouts instead of trusting one provider.** Free-tier models
   turned out to be unreliable: I measured overload errors and silent stalls,
   so every attempt has a timeout, and the backup models were chosen by
   testing which one actually answered.
8. **Structured output validated with Zod, shared with the forms.** The same
   schemas back the intake form and the API routes.
9. **Server components for the board, with Suspense.** The board reads straight
   from the database on the server (no extra API hop), and Cache Components keep
   the page shell static while data streams in.

---

## 6. Known limitations

- **No authentication.** Out of scope for this assignment.
- **Background analysis has no queue.** It runs after the response with a
  60-second limit and no automatic retry. A real deployment would use a proper
  job queue. A failed analysis shows "Analysis failed", and the "Retry analysis"
  button re-runs it.
- **The scoring weights are heuristic**, not learned from real conversion data,
  and the model's ratings can be overly generous. In the sample data, a lead
  asking for a 4 BHK sea-facing villa with a pool for 40 lakhs still scored
  exactly 75 (Hot): the model rated budget fit 2 (correctly noting the budget
  is unrealistic) but rated the requirement 9 for being specific, and gave
  timeline and location 10 each.
- **Free-tier AI limits.** Rate limits apply, and the free Gemini models were
  often overloaded when tested, so the backup is not always available. Fallback
  scores can also differ by a few points from Groq's (one lead scored 87 on Groq
  and 79 on the fallback). Chat's `gemini-3.6-flash` backup in particular failed
  every call in one test, so if Groq were down, chat might have no working
  backup.
- **Chat is grounded, not infallible.** It can still, for instance, turn a
  customer's worry into a promise in a drafted message, so treat drafts as
  drafts to review. Saved answers are fed back as history, and there is no
  clear-chat button.
- **`generateObject` is deprecated in AI SDK v7.** It still works and is what
  the analysis uses, but a migration to `generateText` with structured output
  would be the next step.
- **No automated tests.** The pipeline was verified manually and with real calls
  against the real database and providers.
