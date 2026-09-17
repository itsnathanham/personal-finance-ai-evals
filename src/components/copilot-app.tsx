"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

function formatMoney(value: string) {
  const n = Number(value);
  const abs = Math.abs(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return n < 0 ? `-${abs}` : abs;
}

type HouseholdPayload = {
  user: { id: string; displayName: string; householdId: string } | null;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    institution: string;
    mask: string;
    balance: string;
  }>;
  recentTransactions: Array<{
    id: string;
    postedAt: string;
    merchant: string;
    category: string;
    amount: string;
  }>;
  budgets: Array<{
    category: string;
    month: string;
    limit: string;
    spent: string;
    remaining: string;
  }>;
  goals: Array<{
    id: string;
    name: string;
    currentAmount: string;
    targetAmount: string;
    targetDate: string | null;
  }>;
};

export function CopilotApp({
  household,
  models,
  defaultModelId,
}: {
  household: HouseholdPayload;
  models: Array<{ id: string; label: string }>;
  defaultModelId: string;
}) {
  const [input, setInput] = useState("");
  const [modelId, setModelId] = useState(defaultModelId);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          householdId: household.user?.householdId,
          modelId,
        },
      }),
    [household.user?.householdId, modelId],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    setInput("");
    await sendMessage({ text });
  }

  const suggestions = [
    "What is my checking balance?",
    "How much did I spend on dining in June 2026?",
    "Am I under my June dining budget?",
    "How are my savings goals looking?",
  ];

  return (
    <div className="copilot-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <p className="brand">Personal Finance AI Evals</p>
          <p className="tagline">
            Exploratory personal finance AI copilot, plus an eval and
            observability infrastructure to compare LLMs on accuracy,
            policy/red-team refusals, costs, and latency.
          </p>
          <p className="sub">
            Signed in as {household.user?.displayName ?? "Guest"} · synthetic
            demo · not financial advice
          </p>
        </div>
        <div className="topbar-actions">
          <label className="model-field">
            <span className="model-field-label">Model</span>
            <select
              className="model-select"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              aria-label="Model"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <a className="admin-link" href="/admin">
            Run evals
          </a>
        </div>
      </header>

      <div className="workspace">
        <section className="chat-panel">
          <div className="messages">
            {messages.length === 0 && (
              <div className="empty">
                <h1>Ask about Duane Jetski&apos;s money</h1>
                <div className="suggestions">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage({ text: s })}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <article
                key={m.id}
                className={m.role === "user" ? "bubble user" : "bubble assistant"}
              >
                <span className="role">
                  {m.role === "user" ? "You" : "Assistant"}
                </span>
                <div className="content">
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      if (m.role === "assistant") {
                        return (
                          <div key={`${m.id}-${i}`} className="md">
                            <ReactMarkdown>{part.text}</ReactMarkdown>
                          </div>
                        );
                      }
                      return <p key={`${m.id}-${i}`}>{part.text}</p>;
                    }
                    if (part.type.startsWith("tool-")) {
                      const toolName = part.type.replace("tool-", "");
                      return (
                        <p key={`${m.id}-${i}`} className="tool-chip">
                          Used tool: {toolName}
                        </p>
                      );
                    }
                    return null;
                  })}
                </div>
              </article>
            ))}

            {(status === "submitted" || status === "streaming") && (
              <p className="status">Thinking with ledger tools…</p>
            )}
            {error && <p className="error">{error.message}</p>}
          </div>

          <form className="composer" onSubmit={onSubmit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about balances or budgets…"
              aria-label="Message"
            />
            <button
              type="submit"
              disabled={status === "streaming" || status === "submitted"}
            >
              Send
            </button>
          </form>
        </section>

        <aside className="rail">
          <RailBlock title="Accounts">
            <ul>
              {household.accounts.map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{a.name}</strong>
                    <span>
                      {a.institution} ···{a.mask}
                    </span>
                  </div>
                  <em className="amount">{formatMoney(a.balance)}</em>
                </li>
              ))}
            </ul>
          </RailBlock>

          <RailBlock title="June 2026 budgets">
            <ul>
              {household.budgets.map((b) => (
                <li key={b.category}>
                  <div>
                    <strong className="title-case">{b.category}</strong>
                    <span>
                      spent {formatMoney(b.spent)} / {formatMoney(b.limit)}
                    </span>
                  </div>
                  <em className="amount">{formatMoney(b.remaining)} left</em>
                </li>
              ))}
            </ul>
          </RailBlock>

          <RailBlock title="Goals">
            <ul>
              {household.goals.map((g) => (
                <li key={g.id}>
                  <div>
                    <strong>{g.name}</strong>
                    <span>
                      {formatMoney(g.currentAmount)} of{" "}
                      {formatMoney(g.targetAmount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </RailBlock>

          <RailBlock title="Recent transactions">
            <ul className="tx">
              {household.recentTransactions.map((t) => {
                const negative = Number(t.amount) < 0;
                return (
                  <li key={t.id}>
                    <div>
                      <strong>{t.merchant}</strong>
                      <span>
                        {t.postedAt} · {t.category}
                      </span>
                    </div>
                    <em className={negative ? "amount debit" : "amount"}>
                      {formatMoney(t.amount)}
                    </em>
                  </li>
                );
              })}
            </ul>
          </RailBlock>
        </aside>
      </div>
    </div>
  );
}

function RailBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rail-block">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
