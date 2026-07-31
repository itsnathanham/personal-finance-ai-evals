import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";
import { getDb } from "@/db";
import { accounts, auditEvents, budgets, goals, transactions } from "@/db/schema";
import { DEMO_MONTH } from "@/db/seed-data";

function money(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toFixed(2);
}

async function logAudit(
  householdId: string,
  toolName: string,
  args: unknown,
  startedAt: number,
) {
  try {
    const db = await getDb();
    await db.insert(auditEvents).values({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      householdId,
      toolName,
      argsJson: JSON.stringify(args),
      latencyMs: Date.now() - startedAt,
    });
  } catch {
    // Non-critical for demo
  }
}

export function createFinanceTools(householdId: string) {
  return {
    list_accounts: tool({
      description:
        "List all accounts for the current household with balances and masks.",
      inputSchema: z.object({}),
      execute: async () => {
        const started = Date.now();
        const db = await getDb();
        const rows = await db
          .select()
          .from(accounts)
          .where(eq(accounts.householdId, householdId))
          .orderBy(asc(accounts.name));
        await logAudit(householdId, "list_accounts", {}, started);
        return {
          accounts: rows.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            institution: a.institution,
            mask: a.mask,
            balance: money(a.balance),
            currency: a.currency,
          })),
        };
      },
    }),

    get_balances: tool({
      description: "Get balances for all accounts or a specific account id.",
      inputSchema: z.object({
        accountId: z
          .string()
          .optional()
          .describe("Optional account id, e.g. acct_checking"),
      }),
      execute: async ({ accountId }) => {
        const started = Date.now();
        const db = await getDb();
        const rows = accountId
          ? await db
              .select()
              .from(accounts)
              .where(
                and(
                  eq(accounts.householdId, householdId),
                  eq(accounts.id, accountId),
                ),
              )
          : await db
              .select()
              .from(accounts)
              .where(eq(accounts.householdId, householdId));
        await logAudit(householdId, "get_balances", { accountId }, started);
        return {
          balances: rows.map((a) => ({
            accountId: a.id,
            name: a.name,
            type: a.type,
            balance: money(a.balance),
          })),
        };
      },
    }),

    query_transactions: tool({
      description:
        "Query transactions filtered by date range, category, merchant, and/or account. Amounts are negative for outflows.",
      inputSchema: z.object({
        startDate: z
          .string()
          .optional()
          .describe("Inclusive start date YYYY-MM-DD"),
        endDate: z.string().optional().describe("Inclusive end date YYYY-MM-DD"),
        category: z.string().optional(),
        merchant: z.string().optional(),
        accountId: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
      }),
      execute: async ({
        startDate,
        endDate,
        category,
        merchant,
        accountId,
        limit,
      }) => {
        const started = Date.now();
        const db = await getDb();
        const filters = [eq(transactions.householdId, householdId)];
        if (startDate) filters.push(gte(transactions.postedAt, startDate));
        if (endDate) filters.push(lte(transactions.postedAt, endDate));
        if (category) filters.push(eq(transactions.category, category));
        if (accountId) filters.push(eq(transactions.accountId, accountId));
        if (merchant) {
          filters.push(
            sql`lower(${transactions.merchant}) like ${`%${merchant.toLowerCase()}%`}`,
          );
        }

        const rows = await db
          .select()
          .from(transactions)
          .where(and(...filters))
          .orderBy(desc(transactions.postedAt))
          .limit(limit ?? 50);

        const absSum = rows.reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
        const signedSum = rows.reduce((s, r) => s + Number(r.amount), 0);

        await logAudit(
          householdId,
          "query_transactions",
          { startDate, endDate, category, merchant, accountId, limit },
          started,
        );

        return {
          count: rows.length,
          absoluteSpendTotal: money(absSum),
          signedNetTotal: money(signedSum),
          transactions: rows.map((t) => ({
            id: t.id,
            postedAt: t.postedAt,
            merchant: t.merchant,
            category: t.category,
            amount: money(t.amount),
            accountId: t.accountId,
            isRecurring: t.isRecurring,
          })),
        };
      },
    }),

    get_budget_status: tool({
      description:
        "Compare category spend vs budget limits for a month (YYYY-MM). Defaults to 2026-06 demo month.",
      inputSchema: z.object({
        month: z
          .string()
          .optional()
          .describe("Month as YYYY-MM. Defaults to 2026-06."),
        category: z.string().optional(),
      }),
      execute: async ({ month, category }) => {
        const started = Date.now();
        const m = month ?? DEMO_MONTH;
        const startDate = `${m}-01`;
        const endDate = `${m}-31`;
        const db = await getDb();

        const budgetFilters = [
          eq(budgets.householdId, householdId),
          eq(budgets.month, m),
        ];
        if (category) budgetFilters.push(eq(budgets.category, category));

        const budgetRows = await db
          .select()
          .from(budgets)
          .where(and(...budgetFilters));

        const status = [];
        for (const b of budgetRows) {
          const spentRows = await db
            .select({
              total: sql<string>`coalesce(abs(sum(${transactions.amount})), 0)`,
            })
            .from(transactions)
            .where(
              and(
                eq(transactions.householdId, householdId),
                eq(transactions.category, b.category),
                gte(transactions.postedAt, startDate),
                lte(transactions.postedAt, endDate),
                sql`${transactions.amount} < 0`,
              ),
            );
          const spent = money(spentRows[0]?.total);
          const limitAmount = money(b.limitAmount);
          const remaining = money(Number(limitAmount) - Number(spent));
          status.push({
            category: b.category,
            month: m,
            limit: limitAmount,
            spent,
            remaining,
            overBudget: Number(spent) > Number(limitAmount),
          });
        }

        await logAudit(
          householdId,
          "get_budget_status",
          { month: m, category },
          started,
        );
        return { month: m, budgets: status };
      },
    }),

    get_goals_progress: tool({
      description: "List savings goals and progress toward targets.",
      inputSchema: z.object({}),
      execute: async () => {
        const started = Date.now();
        const db = await getDb();
        const rows = await db
          .select()
          .from(goals)
          .where(eq(goals.householdId, householdId));
        await logAudit(householdId, "get_goals_progress", {}, started);
        return {
          goals: rows.map((g) => {
            const current = Number(g.currentAmount);
            const target = Number(g.targetAmount);
            const pct = target === 0 ? 0 : (current / target) * 100;
            return {
              id: g.id,
              name: g.name,
              currentAmount: money(g.currentAmount),
              targetAmount: money(g.targetAmount),
              percentComplete: Number(pct.toFixed(1)),
              targetDate: g.targetDate,
            };
          }),
        };
      },
    }),

    summarize_period: tool({
      description:
        "Summarize spending by category for a date range using ledger data only.",
      inputSchema: z.object({
        startDate: z.string().describe("YYYY-MM-DD"),
        endDate: z.string().describe("YYYY-MM-DD"),
      }),
      execute: async ({ startDate, endDate }) => {
        const started = Date.now();
        const db = await getDb();
        const rows = await db
          .select({
            category: transactions.category,
            total: sql<string>`abs(sum(${transactions.amount}))`,
            count: sql<number>`count(*)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.householdId, householdId),
              gte(transactions.postedAt, startDate),
              lte(transactions.postedAt, endDate),
              sql`${transactions.amount} < 0`,
            ),
          )
          .groupBy(transactions.category)
          .orderBy(desc(sql`abs(sum(${transactions.amount}))`));

        const incomeRows = await db
          .select({
            total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.householdId, householdId),
              gte(transactions.postedAt, startDate),
              lte(transactions.postedAt, endDate),
              sql`${transactions.amount} > 0`,
            ),
          );

        await logAudit(
          householdId,
          "summarize_period",
          { startDate, endDate },
          started,
        );

        return {
          startDate,
          endDate,
          incomeTotal: money(incomeRows[0]?.total),
          spendByCategory: rows.map((r) => ({
            category: r.category,
            total: money(r.total),
            count: Number(r.count),
          })),
        };
      },
    }),
  };
}

export type FinanceTools = ReturnType<typeof createFinanceTools>;
