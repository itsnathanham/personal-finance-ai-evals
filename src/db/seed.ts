import { eq } from "drizzle-orm";
import type { AppDb } from "./index";
import {
  accounts,
  budgets,
  goals,
  households,
  transactions,
  users,
} from "./schema";
import {
  seedAccounts,
  seedBudgets,
  seedGoals,
  seedHouseholds,
  seedTransactions,
  seedUsers,
  DEMO_HOUSEHOLD_ID,
} from "./seed-data";

export async function ensureSeeded(db: AppDb): Promise<void> {
  const existing = await db
    .select()
    .from(households)
    .where(eq(households.id, DEMO_HOUSEHOLD_ID))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  await db.insert(households).values(
    seedHouseholds.map((h) => ({
      id: h.id,
      name: h.name,
    })),
  );

  await db.insert(users).values(seedUsers);
  await db.insert(accounts).values(
    seedAccounts.map((a) => ({
      ...a,
      currency: "USD",
    })),
  );
  await db.insert(transactions).values(
    seedTransactions.map((t) => ({
      ...t,
      memo: t.memo ?? null,
      isRecurring: t.isRecurring ?? false,
    })),
  );
  await db.insert(budgets).values(seedBudgets);
  await db.insert(goals).values(seedGoals);
}

export async function resetAndSeed(db: AppDb): Promise<void> {
  // Order matters for FKs
  await db.delete(transactions);
  await db.delete(budgets);
  await db.delete(goals);
  await db.delete(accounts);
  await db.delete(users);
  await db.delete(households);
  await ensureSeeded(db);
}
