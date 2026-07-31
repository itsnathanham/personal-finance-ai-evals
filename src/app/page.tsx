import { CopilotApp } from "@/components/copilot-app";
import { getDb } from "@/db";
import {
  DEMO_HOUSEHOLD_ID,
  DEMO_USER_ID,
  DEMO_MONTH,
} from "@/db/seed-data";
import { accounts, budgets, goals, transactions, users } from "@/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  DEFAULT_MODEL_ID,
  MODEL_REGISTRY,
  resolveModelId,
} from "@/lib/models/registry";

export const dynamic = "force-dynamic";

async function loadHousehold() {
  const db = await getDb();
  const monthStart = `${DEMO_MONTH}-01`;
  const monthEnd = `${DEMO_MONTH}-31`;

  const [userRows, accountRows, recentTx, budgetRows, spentRows, goalRows] =
    await Promise.all([
      db.select().from(users).where(eq(users.id, DEMO_USER_ID)).limit(1),
      db
        .select()
        .from(accounts)
        .where(eq(accounts.householdId, DEMO_HOUSEHOLD_ID)),
      db
        .select()
        .from(transactions)
        .where(eq(transactions.householdId, DEMO_HOUSEHOLD_ID))
        .orderBy(desc(transactions.postedAt))
        .limit(12),
      db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.householdId, DEMO_HOUSEHOLD_ID),
            eq(budgets.month, DEMO_MONTH),
          ),
        ),
      db
        .select({
          category: transactions.category,
          total: sql<string>`coalesce(abs(sum(${transactions.amount})), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.householdId, DEMO_HOUSEHOLD_ID),
            gte(transactions.postedAt, monthStart),
            lte(transactions.postedAt, monthEnd),
            sql`${transactions.amount} < 0`,
          ),
        )
        .groupBy(transactions.category),
      db
        .select()
        .from(goals)
        .where(eq(goals.householdId, DEMO_HOUSEHOLD_ID)),
    ]);

  const user = userRows[0];
  const spentByCategory = new Map(
    spentRows.map((r) => [r.category, Number(r.total)]),
  );

  const budgetStatus = budgetRows.map((b) => {
    const spent = spentByCategory.get(b.category) ?? 0;
    const limit = Number(b.limitAmount);
    return {
      category: b.category,
      month: DEMO_MONTH,
      limit: limit.toFixed(2),
      spent: spent.toFixed(2),
      remaining: (limit - spent).toFixed(2),
    };
  });

  return {
    user: user
      ? {
          id: user.id,
          displayName: user.displayName,
          householdId: user.householdId,
        }
      : null,
    accounts: accountRows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      institution: a.institution,
      mask: a.mask,
      balance: Number(a.balance).toFixed(2),
    })),
    recentTransactions: recentTx.map((t) => ({
      id: t.id,
      postedAt: t.postedAt,
      merchant: t.merchant,
      category: t.category,
      amount: Number(t.amount).toFixed(2),
    })),
    budgets: budgetStatus,
    goals: goalRows.map((g) => ({
      id: g.id,
      name: g.name,
      currentAmount: Number(g.currentAmount).toFixed(2),
      targetAmount: Number(g.targetAmount).toFixed(2),
      targetDate: g.targetDate,
    })),
  };
}

export default async function Home() {
  const household = await loadHousehold();
  return (
    <CopilotApp
      household={household}
      models={MODEL_REGISTRY.map((m) => ({ id: m.id, label: m.label }))}
      defaultModelId={resolveModelId(DEFAULT_MODEL_ID)}
    />
  );
}
