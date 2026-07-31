import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";

export const households = pgTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id),
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    name: text("name").notNull(),
    type: text("type").notNull(), // checking | savings | credit | brokerage
    institution: text("institution").notNull(),
    mask: text("mask").notNull(),
    currency: text("currency").notNull().default("USD"),
    balance: numeric("balance", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [index("accounts_household_idx").on(t.householdId)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    postedAt: text("posted_at").notNull(), // YYYY-MM-DD for stable evals
    merchant: text("merchant").notNull(),
    category: text("category").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // negative = outflow
    memo: text("memo"),
    isRecurring: boolean("is_recurring").notNull().default(false),
  },
  (t) => [
    index("tx_household_idx").on(t.householdId),
    index("tx_posted_idx").on(t.postedAt),
    index("tx_category_idx").on(t.category),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    category: text("category").notNull(),
    month: text("month").notNull(), // YYYY-MM
    limitAmount: numeric("limit_amount", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [index("budgets_household_month_idx").on(t.householdId, t.month)],
);

export const goals = pgTable("goals", {
  id: text("id").primaryKey(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", {
    precision: 12,
    scale: 2,
  }).notNull(),
  targetDate: text("target_date"),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull(),
  toolName: text("tool_name").notNull(),
  argsJson: text("args_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  latencyMs: integer("latency_ms"),
});

export const evalRuns = pgTable("eval_runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(), // queued | running | completed | failed
  suiteIdsJson: text("suite_ids_json").notNull(),
  modelIdsJson: text("model_ids_json").notNull(),
  totalCases: integer("total_cases").notNull().default(0),
  completedCases: integer("completed_cases").notNull().default(0),
  passedCases: integer("passed_cases").notNull().default(0),
  failedCases: integer("failed_cases").notNull().default(0),
  errorCases: integer("error_cases").notNull().default(0),
  currentLabel: text("current_label"),
  summaryJson: text("summary_json"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const evalCaseResults = pgTable(
  "eval_case_results",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => evalRuns.id),
    suiteId: text("suite_id").notNull(),
    caseId: text("case_id").notNull(),
    caseDescription: text("case_description").notNull(),
    modelId: text("model_id").notNull(),
    prompt: text("prompt").notNull(),
    output: text("output"),
    toolsUsedJson: text("tools_used_json"),
    pass: boolean("pass"),
    failReasonsJson: text("fail_reasons_json"),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    estimatedCostUsd: text("estimated_cost_usd"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("eval_case_results_run_idx").on(t.runId)],
);

export type Household = typeof households.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type EvalRun = typeof evalRuns.$inferSelect;
export type EvalCaseResult = typeof evalCaseResults.$inferSelect;
