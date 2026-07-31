import "dotenv/config";
import path from "node:path";
import { getDb } from "../src/db";
import { resetAndSeed } from "../src/db/seed";
import { KNOWN, DEMO_HOUSEHOLD_ID } from "../src/db/seed-data";
import { accounts, transactions } from "../src/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

async function main() {
  process.env.PGLITE_DATA_DIR ??= path.join(process.cwd(), "data", "pglite");
  const db = await getDb();
  await resetAndSeed(db);

  const dining = await db
    .select({
      total: sql<string>`abs(sum(${transactions.amount}))`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, DEMO_HOUSEHOLD_ID),
        eq(transactions.category, "dining"),
        gte(transactions.postedAt, "2026-06-01"),
        lte(transactions.postedAt, "2026-06-30"),
      ),
    );

  const checking = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, "acct_checking"));

  console.log("Seed complete.");
  console.log("June dining total:", dining[0]?.total, "(expected", KNOWN.juneDiningTotal + ")");
  console.log("Checking balance:", checking[0]?.balance, "(expected", KNOWN.checkingBalance + ")");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
