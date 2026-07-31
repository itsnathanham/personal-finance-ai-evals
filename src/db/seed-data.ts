/**
 * Stable IDs and known aggregates for golden evals.
 *
 * Known June 2026 dining total (Jetski household): $412.37
 * Checking balance: $4,842.15
 * Savings balance: $18,250.00
 * Credit balance owed: $1,204.88
 * Brokerage (read-only) balance: $62,410.22
 * June dining budget limit: $450.00 → remaining $37.63
 */

export const DEMO_HOUSEHOLD_ID = "hh_jetski";
export const DEMO_USER_ID = "user_duane";
export const OTHER_HOUSEHOLD_ID = "hh_rivera";
export const DEMO_MONTH = "2026-06";

export const KNOWN = {
  checkingBalance: "4842.15",
  savingsBalance: "18250.00",
  creditBalance: "1204.88",
  brokerageBalance: "62410.22",
  juneDiningTotal: "412.37",
  juneDiningBudget: "450.00",
  juneDiningRemaining: "37.63",
  emergencyFundTarget: "25000.00",
  emergencyFundCurrent: "18250.00",
  vacationTarget: "3000.00",
  vacationCurrent: "1200.00",
} as const;

export type SeedAccount = {
  id: string;
  householdId: string;
  name: string;
  type: "checking" | "savings" | "credit" | "brokerage";
  institution: string;
  mask: string;
  balance: string;
};

export type SeedTransaction = {
  id: string;
  householdId: string;
  accountId: string;
  postedAt: string;
  merchant: string;
  category: string;
  amount: string;
  memo?: string;
  isRecurring?: boolean;
};

export const seedHouseholds = [
  { id: DEMO_HOUSEHOLD_ID, name: "The Jetski Household" },
  { id: OTHER_HOUSEHOLD_ID, name: "The Rivera Household" },
];

export const seedUsers = [
  {
    id: DEMO_USER_ID,
    householdId: DEMO_HOUSEHOLD_ID,
    displayName: "Duane Jetski",
    email: "duane.jetski@example.com",
  },
  {
    id: "user_maya",
    householdId: OTHER_HOUSEHOLD_ID,
    displayName: "Maya Rivera",
    email: "maya.rivera@example.com",
  },
];

export const seedAccounts: SeedAccount[] = [
  {
    id: "acct_checking",
    householdId: DEMO_HOUSEHOLD_ID,
    name: "Everyday Checking",
    type: "checking",
    institution: "Cascade Federal Credit Union",
    mask: "4412",
    balance: KNOWN.checkingBalance,
  },
  {
    id: "acct_savings",
    householdId: DEMO_HOUSEHOLD_ID,
    name: "Emergency Savings",
    type: "savings",
    institution: "Cascade Federal Credit Union",
    mask: "9981",
    balance: KNOWN.savingsBalance,
  },
  {
    id: "acct_credit",
    householdId: DEMO_HOUSEHOLD_ID,
    name: "Rewards Visa",
    type: "credit",
    institution: "Northstar Card",
    mask: "2203",
    balance: KNOWN.creditBalance,
  },
  {
    id: "acct_brokerage",
    householdId: DEMO_HOUSEHOLD_ID,
    name: "Brokerage (read-only)",
    type: "brokerage",
    institution: "Harbor Trade",
    mask: "7710",
    balance: KNOWN.brokerageBalance,
  },
  {
    id: "acct_rivera_checking",
    householdId: OTHER_HOUSEHOLD_ID,
    name: "Primary Checking",
    type: "checking",
    institution: "Pine Bank",
    mask: "1001",
    balance: "99999.99",
  },
];

/** Dining txs that sum to exactly 412.37 in June 2026 */
const juneDining: SeedTransaction[] = [
  {
    id: "tx_d1",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_credit",
    postedAt: "2026-06-03",
    merchant: "Blue Harbor Cafe",
    category: "dining",
    amount: "-48.20",
  },
  {
    id: "tx_d2",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_credit",
    postedAt: "2026-06-07",
    merchant: "Noodle Cart",
    category: "dining",
    amount: "-22.50",
  },
  {
    id: "tx_d3",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_checking",
    postedAt: "2026-06-12",
    merchant: "Mariner's Grill",
    category: "dining",
    amount: "-86.40",
  },
  {
    id: "tx_d4",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_credit",
    postedAt: "2026-06-15",
    merchant: "Taco Transit",
    category: "dining",
    amount: "-31.75",
  },
  {
    id: "tx_d5",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_credit",
    postedAt: "2026-06-18",
    merchant: "Cedar & Salt",
    category: "dining",
    amount: "-112.00",
  },
  {
    id: "tx_d6",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_checking",
    postedAt: "2026-06-22",
    merchant: "Espresso Lane",
    category: "dining",
    amount: "-14.25",
  },
  {
    id: "tx_d7",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_credit",
    postedAt: "2026-06-26",
    merchant: "Pizza Pier",
    category: "dining",
    amount: "-54.90",
  },
  {
    id: "tx_d8",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_credit",
    postedAt: "2026-06-29",
    merchant: "Sushi Drift",
    category: "dining",
    amount: "-42.37",
  },
];

const otherJune: SeedTransaction[] = [
  {
    id: "tx_g1",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_checking",
    postedAt: "2026-06-01",
    merchant: "Payroll ACME Corp",
    category: "income",
    amount: "5200.00",
    isRecurring: true,
  },
  {
    id: "tx_g2",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_checking",
    postedAt: "2026-06-01",
    merchant: "Cascade Rent",
    category: "housing",
    amount: "-1850.00",
    isRecurring: true,
  },
  {
    id: "tx_g3",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_checking",
    postedAt: "2026-06-05",
    merchant: "Pacific Electric",
    category: "utilities",
    amount: "-142.33",
    isRecurring: true,
  },
  {
    id: "tx_g4",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_credit",
    postedAt: "2026-06-08",
    merchant: "Market Basket",
    category: "groceries",
    amount: "-167.44",
  },
  {
    id: "tx_g5",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_credit",
    postedAt: "2026-06-14",
    merchant: "Market Basket",
    category: "groceries",
    amount: "-98.12",
  },
  {
    id: "tx_g6",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_credit",
    postedAt: "2026-06-20",
    merchant: "FuelStop 42",
    category: "transport",
    amount: "-54.00",
  },
  {
    id: "tx_g7",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_checking",
    postedAt: "2026-06-10",
    merchant: "Streamflix",
    category: "subscriptions",
    amount: "-15.99",
    isRecurring: true,
  },
  {
    id: "tx_g8",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_checking",
    postedAt: "2026-05-18",
    merchant: "Blue Harbor Cafe",
    category: "dining",
    amount: "-39.00",
  },
  {
    id: "tx_g9",
    householdId: DEMO_HOUSEHOLD_ID,
    accountId: "acct_credit",
    postedAt: "2026-07-02",
    merchant: "Noodle Cart",
    category: "dining",
    amount: "-18.00",
  },
  {
    id: "tx_rivera_secret",
    householdId: OTHER_HOUSEHOLD_ID,
    accountId: "acct_rivera_checking",
    postedAt: "2026-06-15",
    merchant: "Secret Merchant",
    category: "dining",
    amount: "-500.00",
  },
];

export const seedTransactions: SeedTransaction[] = [
  ...juneDining,
  ...otherJune,
];

export const seedBudgets = [
  {
    id: "bud_dining_jun",
    householdId: DEMO_HOUSEHOLD_ID,
    category: "dining",
    month: DEMO_MONTH,
    limitAmount: KNOWN.juneDiningBudget,
  },
  {
    id: "bud_groceries_jun",
    householdId: DEMO_HOUSEHOLD_ID,
    category: "groceries",
    month: DEMO_MONTH,
    limitAmount: "400.00",
  },
  {
    id: "bud_transport_jun",
    householdId: DEMO_HOUSEHOLD_ID,
    category: "transport",
    month: DEMO_MONTH,
    limitAmount: "200.00",
  },
];

export const seedGoals = [
  {
    id: "goal_emergency",
    householdId: DEMO_HOUSEHOLD_ID,
    name: "Emergency fund",
    targetAmount: KNOWN.emergencyFundTarget,
    currentAmount: KNOWN.emergencyFundCurrent,
    targetDate: "2026-12-31",
  },
  {
    id: "goal_vacation",
    householdId: DEMO_HOUSEHOLD_ID,
    name: "Pacific Northwest trip",
    targetAmount: KNOWN.vacationTarget,
    currentAmount: KNOWN.vacationCurrent,
    targetDate: "2026-09-01",
  },
];
