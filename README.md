# Personal Finance AI Evals

Grounded personal finance assistant over **seeded ledger data** for **Duane Jetski / The Jetski Household**. Built to practice AI eval workflows with an **in-app admin dashboard** (plus optional Promptfoo CLI).

> Synthetic demo data only. Not financial advice. Not a bank.

## Stack

- Next.js App Router + TypeScript
- Drizzle ORM + **PGlite** locally (auto) or **Neon Postgres** when `DATABASE_URL` is set
- Vercel AI SDK + Anthropic (Claude) via a pluggable model registry
- In-app eval runner + `/admin` dashboard for non-technical runs
- Optional Promptfoo CLI suites in [`evals/`](evals/)

## Quick start

```bash
cp .env.example .env.local
# add ANTHROPIC_API_KEY=
# set ADMIN_PASSWORD=...

npm install
npm run db:seed
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)
- Eval admin: [http://localhost:3000/admin](http://localhost:3000/admin)
- Eval trends: [http://localhost:3000/admin/trends](http://localhost:3000/admin/trends)

If the terminal says port 3000 is busy, use the port it prints and open `/admin` there.

## Admin eval dashboard

1. Sign in with `ADMIN_PASSWORD`
2. Select any mix of suites and one or more **Claude** models (Haiku 4.5, Sonnet 5, Opus 5, Fable 5.1):
   - **Goldens** — ledger accuracy
   - **Policy** — product-boundary refusals
   - **Red team** — jailbreaks / exfil probes
   - **Promptfoo Finance** — curated Promptfoo financial plugins (`impartiality`, `misconduct`, `compliance-violation`, `hallucination`)
3. Click **Run evals** — the browser runs each case against `/api/eval` (works on Vercel serverless)
4. When finished you’re taken to the run detail page with **pass rate**, **estimated cost**, **avg latency**, and per-model breakdown
5. Open **Trends** (`/admin/trends`) to filter by model + suite and chart pass/fail/cost/latency over time

Costs are **list-price estimates** from Anthropic token usage (current Claude API rates). Cache/batch discounts are not applied.

Run history for trends is kept in **browser localStorage** (merged with best-effort server runs). For durable server-side history across devices, set a Neon `DATABASE_URL` on Vercel.

`http://localhost:15500` is **Promptfoo’s own viewer** (`npm run eval:view`) — optional power-user tool, separate from `/admin`.

## Known golden numbers

| Fact | Value |
|------|-------|
| Checking balance | `$4842.15` |
| June 2026 dining spend | `$412.37` |
| June dining budget remaining | `$37.63` |
| Emergency fund current | `$18250.00` |

## CLI evals (optional)

With the app running (adjust port if needed; YAML defaults to `localhost:3003`):

```bash
npm run eval:goldens
npm run eval:policy
npm run eval:redteam
npm run eval:finance          # frozen Promptfoo Finance cases (same as admin suite)
npm run eval:finance:plugins  # live Promptfoo redteam with curated financial:* plugins
npm run eval:view             # Promptfoo UI on :15500
```

## Deploy notes

Set `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`, optional `DATABASE_URL` (Neon), `CHAT_RATE_LIMIT_PER_HOUR`, `EVAL_CONCURRENCY` on Vercel. Admin eval jobs run in-process; for heavy suites prefer a long-lived Node host.

## Project layout

```
src/app/admin          eval dashboard UI
src/app/api/admin      login + eval run APIs
src/app/api/eval       single-case eval endpoint
src/lib/evals          suites, graders, job runner
src/lib/models         Claude model registry
evals/                 YAML suites (goldens / policy / redteam / finance)
```
