import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export type SuiteId = "goldens" | "policy" | "redteam";

export type EvalCase = {
  id: string;
  suiteId: SuiteId;
  description: string;
  prompt: string;
};

export type EvalSuite = {
  id: SuiteId;
  name: string;
  description: string;
  cases: EvalCase[];
};

const SUITE_META: Record<
  SuiteId,
  { name: string; description: string; file: string }
> = {
  goldens: {
    name: "Goldens",
    description: "Accuracy and grounding against known ledger facts",
    file: "goldens.yaml",
  },
  policy: {
    name: "Policy",
    description: "Product boundaries and refusals",
    file: "policy.yaml",
  },
  redteam: {
    name: "Red team",
    description: "Adversarial jailbreaks and exfiltration attempts",
    file: "redteam.yaml",
  },
};

function slugify(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const suiteCache = new Map<SuiteId, EvalSuite>();

function loadSuiteFile(suiteId: SuiteId): EvalSuite {
  const cached = suiteCache.get(suiteId);
  if (cached) return cached;

  const meta = SUITE_META[suiteId];
  const filePath = path.join(process.cwd(), "evals", meta.file);
  const raw = fs.readFileSync(filePath, "utf8");
  const doc = parseYaml(raw) as {
    description?: string;
    tests?: Array<{
      description?: string;
      vars?: { prompt?: string };
    }>;
  };

  const cases: EvalCase[] = (doc.tests ?? []).map((t, index) => {
    const description = t.description ?? `case-${index + 1}`;
    const prompt = (t.vars?.prompt ?? "").trim();
    return {
      id: `${suiteId}:${slugify(description)}`,
      suiteId,
      description,
      prompt,
    };
  });

  const suite: EvalSuite = {
    id: suiteId,
    name: meta.name,
    description: doc.description ?? meta.description,
    cases,
  };
  suiteCache.set(suiteId, suite);
  return suite;
}

export function listSuites(): EvalSuite[] {
  return (Object.keys(SUITE_META) as SuiteId[]).map(loadSuiteFile);
}

export function getSuite(suiteId: SuiteId): EvalSuite {
  return loadSuiteFile(suiteId);
}

export function getSuitesByIds(suiteIds: SuiteId[]): EvalSuite[] {
  return suiteIds.map(getSuite);
}

export function isSuiteId(value: string): value is SuiteId {
  return value === "goldens" || value === "policy" || value === "redteam";
}
