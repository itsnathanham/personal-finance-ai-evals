# Household Finance Copilot

Grounded household finance assistant over **seeded ledger data** for **Duane Jetski / The Jetski Household**. Built to practice eval workflows with an **in-app admin dashboard** (plus optional Promptfoo CLI).

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

- Copilot: [http://localhost:3000](http://localhost:3000)
- Eval admin: [http://localhost:3000/admin](http://localhost:3000/admin)

If the terminal says port 3000 is busy, use the port it prints and open `/admin` there.

## Admin eval dashboard

1. Sign in with `ADMIN_PASSWORD`
2. Select suites (**Goldens**, **Policy**, **Red team**) and one or more **Claude** models
3. Click **Run evals** — progress updates live
4. Open a run in **History** for pass rate, per-model scores, and expandable case details

The dashboard runs evals **in-app** (not the Promptfoo CLI). YAML under `evals/` remains the case source of truth; TypeScript graders mirror the asserts.

`http://localhost:15500` is **Promptfoo’s own viewer** (`npm run eval:view`) — optional power-user tool, separate from `/admin`.

## Known golden numbers

| Fact | Value |
|------|-------|
| Checking balance | `$4842.15` |
| June 2026 dining spend | `$412.37` |
| June dining budget remaining | `$37.63` |
| Emergency fund current | `$18250.00` |

## CLI evals (optional)

With the app running:

```bash
npm run eval:goldens
npm run eval:policy
npm run eval:redteam
npm run eval:view   # Promptfoo UI on :15500
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
evals/                 YAML suites (goldens / policy / redteam)
```
