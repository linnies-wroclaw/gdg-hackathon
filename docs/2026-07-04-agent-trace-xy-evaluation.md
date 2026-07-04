# Agent Trace + Deterministic TRIZ × 5-Whys XY Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trace every step of every agent (with per-step reasoning), restructure the pipeline around a 5-Whys LoopAgent + TRIZ candidate records, and select the winning solution with a deterministic XY engine in the NestJS API — trace stored in Postgres and returned to the frontend.

**Architecture:** The ADK pipeline (`problem_extractor → fiveY LoopAgent → triz_solver`) produces data only; the NestJS API parses the *full* SSE event stream into a `steps[]` trace, recomputes all metrics with pure functions (X/Y formulas, Pareto frontier, fixed 60/60 gates), runs conformance checks on agent behavior, renders the final answer deterministically, and persists the whole trace as JSONB on the assistant chat message.

**Tech Stack:** `@google/adk` 1.3 (TS, `LoopAgent`, `EXIT_LOOP`), NestJS 11, Sequelize (Postgres, JSONB), Jest (`ts-jest`), Nx monorepo, Angular frontend (types only).

**Spec:** `docs/superpowers/specs/2026-07-04-agent-trace-xy-evaluation-design.md` (approved)

## Global Constraints

- Workspace root for all commands: `solution-system/` (all `npx nx ...` commands run there).
- Model stays `gemini-2.5-flash`; `@google/adk` stays `^1.3.0`; MCP toolset config unchanged.
- Exact agent names / state keys: `problem_extractor`→`core_problem`, `fiveY` (LoopAgent) wrapping `why_step`→`causal_chain`, `triz_solver`→`candidate_records`.
- Gates are fixed constants `GATE_X = 60`, `GATE_Y = 60` — never env-configurable, never request-configurable ("never move the lines").
- Formulas verbatim: `ccv = MIN(link_validity)` (recomputed, never trusted); `X = ((rcd*ccv)-1)/24*100`; `ideality_raw = benefit/(cost+harm)`; `ideality_norm = (ideality_raw-0.1)/2.4*100`; `Y = ideality_norm*(contradiction_resolution/5)`; `dc = resolved/total` (total 0 → dc 0); `feasible = buildable_48h && deployable`.
- Pareto domination: `A.x >= B.x && A.y >= B.y && (A.x > B.x || A.y > B.y)`.
- Out-of-range agent values are **not clamped** — score as-is, record a failed conformance check.
- Transport/ADK-error failures throw `BadGatewayException`; content failures (bad JSON, no chain, nothing feasible) degrade: trace preserved, verdict text explains.
- 5-Whys loop: max 5 iterations; candidate count target 3–5 (checked, not enforced).
- Follow existing code style: classes only where Nest DI needs them, pure functions elsewhere; specs instantiate directly and mock axios (see `agent.service.spec.ts`).
- Test command: `npx nx test api`. Type check: `npx tsc -p apps/api/tsconfig.app.json --noEmit`.
- **Commits:** the user declined an unprompted commit earlier this session. Confirm commit policy before executing; if declined, skip every "Commit" step below.

---

### Task 1: Trace & evaluation domain types

**Files:**
- Create: `apps/api/src/app/trace/trace.types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: every type used by Tasks 2–10: `TraceStepType`, `TraceStep`, `CausalLink`, `TrizScores`, `Feasibility`, `CandidateRecord`, `ScoredCandidate`, `EvaluationResult`, `ConformanceCheck`, `AgentTrace`.

- [ ] **Step 1: Create the types file**

```ts
// apps/api/src/app/trace/trace.types.ts
export type TraceStepType = 'model_output' | 'tool_call' | 'tool_response';

export interface TraceStep {
  index: number;
  agent: string;
  type: TraceStepType;
  content: string;
  reasoning?: string;
  toolName?: string;
  timestamp?: number;
  invocationId?: string;
  iteration?: number;
}

export interface CausalLink {
  why: string;
  because: string;
  link_validity: number;
  reasoning?: string;
}

export interface TrizScores {
  benefit: number;
  cost: number;
  harm: number;
  contradiction_resolution: number;
}

export interface Feasibility {
  buildable_48h: boolean;
  deployable: boolean;
}

export interface CandidateRecord {
  id: string;
  title: string;
  summary: string;
  causal_chain: CausalLink[];
  intervention_index: number;
  rcd: number;
  ccv: number;
  triz: TrizScores;
  downstream_symptoms_total: number;
  downstream_symptoms_resolved: number;
  feasibility: Feasibility;
  contradiction_sentence: string;
  principles_used?: string[];
  reasoning?: string;
}

export interface ScoredCandidate {
  record: CandidateRecord;
  x: number;
  y: number;
  dc: number;
  ccvComputed: number;
  feasible: boolean;
  onFrontier: boolean;
  passesGates: boolean;
}

export interface EvaluationResult {
  gateX: number;
  gateY: number;
  candidates: ScoredCandidate[];
  frontierIds: string[];
  gatedIds: string[];
  winnerId: string | null;
  verdict: string;
}

export interface ConformanceCheck {
  id: string;
  agent: string;
  passed: boolean;
  details: string;
}

export interface AgentTrace {
  steps: TraceStep[];
  causalChain: CausalLink[] | null;
  candidates: ScoredCandidate[];
  evaluation: EvaluationResult | null;
  checks: ConformanceCheck[];
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p apps/api/tsconfig.app.json --noEmit`
Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add solution-system/apps/api/src/app/trace/trace.types.ts
git commit -m "feat(api): add trace and evaluation domain types"
```

---

### Task 2: Evaluation engine — scoring

**Files:**
- Create: `apps/api/src/app/evaluation/evaluation.engine.ts`
- Test: `apps/api/src/app/evaluation/evaluation.engine.spec.ts`

**Interfaces:**
- Consumes: `CandidateRecord`, `CausalLink`, `ScoredCandidate` from `../trace/trace.types` (Task 1).
- Produces (used by Tasks 4, 5, 7):
  - `GATE_X: 60`, `GATE_Y: 60`
  - `computeCcv(chain: CausalLink[]): number` — MIN of link validities, 0 for empty chain
  - `parseCandidateRecords(raw: unknown): CandidateRecord[] | null` — structural validation, null when nothing valid
  - `scoreCandidate(record: CandidateRecord, chain: CausalLink[]): ScoredCandidate` — `onFrontier`/`passesGates` initialized false

- [ ] **Step 1: Write the failing scoring tests**

```ts
// apps/api/src/app/evaluation/evaluation.engine.spec.ts
import {
  CandidateRecord,
  CausalLink,
} from '../trace/trace.types';
import {
  computeCcv,
  parseCandidateRecords,
  scoreCandidate,
} from './evaluation.engine';

const chain: CausalLink[] = [
  { why: 'w1', because: 'b1', link_validity: 4 },
  { why: 'w2', because: 'b2', link_validity: 3 },
  { why: 'w3', because: 'b3', link_validity: 5 },
];

const record = (overrides: Partial<CandidateRecord> = {}): CandidateRecord => ({
  id: 'c1',
  title: 'Candidate one',
  summary: 'Summary',
  causal_chain: chain,
  intervention_index: 2,
  rcd: 4,
  ccv: 3,
  triz: { benefit: 4, cost: 1, harm: 1, contradiction_resolution: 4 },
  downstream_symptoms_total: 4,
  downstream_symptoms_resolved: 3,
  feasibility: { buildable_48h: true, deployable: true },
  contradiction_sentence: 'Resolves flow vs weight.',
  ...overrides,
});

describe('computeCcv', () => {
  it('is the MIN link validity, not the average', () => {
    expect(computeCcv(chain)).toBe(3);
  });

  it('is 0 for an empty chain', () => {
    expect(computeCcv([])).toBe(0);
  });
});

describe('scoreCandidate', () => {
  it('computes X from rcd and RECOMPUTED ccv', () => {
    // X = ((4 * 3) - 1) / 24 * 100 = 45.8333...
    const scored = scoreCandidate(record({ ccv: 5 }), chain);
    expect(scored.ccvComputed).toBe(3);
    expect(scored.x).toBeCloseTo(45.8333, 3);
  });

  it('computes Y from ideality and contradiction resolution', () => {
    // raw = 4/(1+1) = 2.0; norm = (2.0-0.1)/2.4*100 = 79.1666...; Y = norm * 4/5 = 63.3333...
    const scored = scoreCandidate(record(), chain);
    expect(scored.y).toBeCloseTo(63.3333, 3);
  });

  it('reaches (100, 100) for the ideal candidate on a perfect chain', () => {
    const perfectChain: CausalLink[] = [
      { why: 'w', because: 'b', link_validity: 5 },
    ];
    const scored = scoreCandidate(
      record({
        rcd: 5,
        triz: { benefit: 5, cost: 1, harm: 1, contradiction_resolution: 5 },
      }),
      perfectChain,
    );
    expect(scored.x).toBeCloseTo(100, 6);
    expect(scored.y).toBeCloseTo(100, 6);
  });

  it('bottoms out at (0, 0) for the weakest candidate', () => {
    const weakChain: CausalLink[] = [{ why: 'w', because: 'b', link_validity: 1 }];
    const scored = scoreCandidate(
      record({
        rcd: 1,
        triz: { benefit: 1, cost: 5, harm: 5, contradiction_resolution: 1 },
      }),
      weakChain,
    );
    expect(scored.x).toBeCloseTo(0, 6);
    expect(scored.y).toBeCloseTo(0, 6);
  });

  it('computes dc and guards division by zero', () => {
    expect(scoreCandidate(record(), chain).dc).toBeCloseTo(0.75, 6);
    expect(
      scoreCandidate(
        record({ downstream_symptoms_total: 0, downstream_symptoms_resolved: 0 }),
        chain,
      ).dc,
    ).toBe(0);
  });

  it('requires both feasibility flags', () => {
    expect(scoreCandidate(record(), chain).feasible).toBe(true);
    expect(
      scoreCandidate(
        record({ feasibility: { buildable_48h: true, deployable: false } }),
        chain,
      ).feasible,
    ).toBe(false);
  });
});

describe('parseCandidateRecords', () => {
  it('accepts an array of valid records', () => {
    const parsed = parseCandidateRecords([record(), record({ id: 'c2' })]);
    expect(parsed).toHaveLength(2);
  });

  it('drops structurally invalid entries and returns null when none survive', () => {
    expect(parseCandidateRecords([{ id: 'broken' }])).toBeNull();
    expect(parseCandidateRecords('not an array')).toBeNull();
    expect(parseCandidateRecords([])).toBeNull();
    expect(parseCandidateRecords(null)).toBeNull();
  });

  it('keeps valid records when mixed with invalid ones', () => {
    const parsed = parseCandidateRecords([record(), { junk: true }]);
    expect(parsed).toHaveLength(1);
    expect(parsed?.[0].id).toBe('c1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test api`
Expected: FAIL — `Cannot find module './evaluation.engine'`.

- [ ] **Step 3: Implement scoring**

```ts
// apps/api/src/app/evaluation/evaluation.engine.ts
import {
  CandidateRecord,
  CausalLink,
  EvaluationResult,
  ScoredCandidate,
} from '../trace/trace.types';

export const GATE_X = 60;
export const GATE_Y = 60;

export function computeCcv(chain: CausalLink[]): number {
  return chain.length > 0
    ? Math.min(...chain.map((link) => link.link_validity))
    : 0;
}

export function parseCandidateRecords(raw: unknown): CandidateRecord[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  const records = raw.filter(isCandidateRecord);

  return records.length > 0 ? records : null;
}

export function scoreCandidate(
  record: CandidateRecord,
  chain: CausalLink[],
): ScoredCandidate {
  const ccvComputed = computeCcv(chain);
  const x = ((record.rcd * ccvComputed) - 1) / 24 * 100;
  const idealityRaw =
    record.triz.benefit / (record.triz.cost + record.triz.harm);
  const idealityNorm = ((idealityRaw - 0.1) / 2.4) * 100;
  const y = idealityNorm * (record.triz.contradiction_resolution / 5);
  const dc =
    record.downstream_symptoms_total > 0
      ? record.downstream_symptoms_resolved / record.downstream_symptoms_total
      : 0;
  const feasible =
    record.feasibility.buildable_48h && record.feasibility.deployable;

  return {
    record,
    x,
    y,
    dc,
    ccvComputed,
    feasible,
    onFrontier: false,
    passesGates: false,
  };
}

function isCandidateRecord(value: unknown): value is CandidateRecord {
  const record = value as CandidateRecord;

  return Boolean(
    record &&
      typeof record === 'object' &&
      typeof record.id === 'string' &&
      typeof record.title === 'string' &&
      typeof record.summary === 'string' &&
      Array.isArray(record.causal_chain) &&
      typeof record.intervention_index === 'number' &&
      typeof record.rcd === 'number' &&
      typeof record.ccv === 'number' &&
      record.triz &&
      typeof record.triz.benefit === 'number' &&
      typeof record.triz.cost === 'number' &&
      typeof record.triz.harm === 'number' &&
      typeof record.triz.contradiction_resolution === 'number' &&
      typeof record.downstream_symptoms_total === 'number' &&
      typeof record.downstream_symptoms_resolved === 'number' &&
      record.feasibility &&
      typeof record.feasibility.buildable_48h === 'boolean' &&
      typeof record.feasibility.deployable === 'boolean' &&
      typeof record.contradiction_sentence === 'string',
  );
}
```

(`EvaluationResult` is imported now because Task 3 adds `selectWinner` to this same file; if the linter flags it as unused at this point, remove it here and re-add in Task 3.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test api`
Expected: PASS (evaluation.engine.spec + pre-existing suites).

- [ ] **Step 5: Commit**

```bash
git add solution-system/apps/api/src/app/evaluation/
git commit -m "feat(api): deterministic XY scoring for candidate records"
```

---

### Task 3: Evaluation engine — selection (Pareto frontier, gates, winner)

**Files:**
- Modify: `apps/api/src/app/evaluation/evaluation.engine.ts` (append)
- Test: `apps/api/src/app/evaluation/evaluation.engine.spec.ts` (append)

**Interfaces:**
- Consumes: `ScoredCandidate`, `EvaluationResult` (Task 1), `GATE_X`/`GATE_Y` (Task 2).
- Produces (used by Task 7): `selectWinner(scored: ScoredCandidate[]): EvaluationResult`. Side effect: sets `onFrontier`/`passesGates` on the passed candidates (same objects land in `EvaluationResult.candidates`).

- [ ] **Step 1: Append failing selection tests**

Append to `evaluation.engine.spec.ts` (add `selectWinner` and `ScoredCandidate` to the existing imports):

```ts
describe('selectWinner', () => {
  const scored = (
    id: string,
    x: number,
    y: number,
    dc = 0.5,
    feasible = true,
  ): ScoredCandidate => ({
    record: record({ id, title: id }),
    x,
    y,
    dc,
    ccvComputed: 3,
    feasible,
    onFrontier: false,
    passesGates: false,
  });

  it('excludes dominated candidates from the frontier and picks max X', () => {
    const a = scored('a', 70, 80);
    const b = scored('b', 65, 85);
    const c = scored('c', 60, 60); // dominated by a

    const result = selectWinner([a, b, c]);

    expect(result.frontierIds.sort()).toEqual(['a', 'b']);
    expect(c.onFrontier).toBe(false);
    expect(result.gatedIds.sort()).toEqual(['a', 'b']);
    expect(result.winnerId).toBe('a');
    expect(result.verdict).toContain('selected a');
  });

  it('filters infeasible candidates before everything else', () => {
    const feasibleWeak = scored('weak', 61, 61);
    const infeasibleStrong = scored('strong', 100, 100, 0.9, false);

    const result = selectWinner([feasibleWeak, infeasibleStrong]);

    expect(result.winnerId).toBe('weak');
    expect(result.frontierIds).toEqual(['weak']);
  });

  it('reports the strongest frontier point when gates are not cleared', () => {
    const a = scored('a', 59, 90);
    const b = scored('b', 40, 95);

    const result = selectWinner([a, b]);

    expect(result.winnerId).toBeNull();
    expect(result.verdict).toBe(
      'No candidate clears both gates. Strongest frontier point: a.',
    );
  });

  it('reports when nothing is feasible', () => {
    const result = selectWinner([scored('a', 90, 90, 0.5, false)]);

    expect(result.winnerId).toBeNull();
    expect(result.verdict).toBe(
      'No feasible candidate (none is buildable in 48h and deployable).',
    );
  });

  it('announces a single gated winner', () => {
    const result = selectWinner([scored('a', 70, 70), scored('b', 50, 50)]);

    expect(result.winnerId).toBe('a');
    expect(result.verdict).toBe('Single candidate clears both gates: a.');
  });

  it('breaks X ties with dc', () => {
    const a = scored('a', 70, 80, 0.4);
    const b = scored('b', 70, 80, 0.9);

    const result = selectWinner([a, b]);

    expect(result.frontierIds.sort()).toEqual(['a', 'b']);
    expect(result.winnerId).toBe('b');
  });

  it('handles an empty candidate list', () => {
    const result = selectWinner([]);

    expect(result.winnerId).toBeNull();
    expect(result.candidates).toEqual([]);
    expect(result.verdict).toBe(
      'No feasible candidate (none is buildable in 48h and deployable).',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test api`
Expected: FAIL — `selectWinner` is not exported.

- [ ] **Step 3: Append the selection implementation**

Append to `evaluation.engine.ts`:

```ts
export function selectWinner(scored: ScoredCandidate[]): EvaluationResult {
  const eligible = scored.filter((candidate) => candidate.feasible);
  const frontier = eligible.filter(
    (candidate) =>
      !eligible.some(
        (other) => other !== candidate && dominates(other, candidate),
      ),
  );

  for (const candidate of frontier) {
    candidate.onFrontier = true;
  }

  const gated = frontier.filter(
    (candidate) => candidate.x >= GATE_X && candidate.y >= GATE_Y,
  );

  for (const candidate of gated) {
    candidate.passesGates = true;
  }

  let winnerId: string | null = null;
  let verdict: string;

  if (eligible.length === 0) {
    verdict = 'No feasible candidate (none is buildable in 48h and deployable).';
  } else if (gated.length === 0) {
    const strongest = pickByXThenDc(frontier);
    verdict = `No candidate clears both gates. Strongest frontier point: ${strongest.record.id}.`;
  } else if (gated.length === 1) {
    winnerId = gated[0].record.id;
    verdict = `Single candidate clears both gates: ${winnerId}.`;
  } else {
    winnerId = pickByXThenDc(gated).record.id;
    verdict = `${gated.length} candidates clear both gates; selected ${winnerId} by max X_targeting (tie-break: max dc).`;
  }

  return {
    gateX: GATE_X,
    gateY: GATE_Y,
    candidates: scored,
    frontierIds: frontier.map((candidate) => candidate.record.id),
    gatedIds: gated.map((candidate) => candidate.record.id),
    winnerId,
    verdict,
  };
}

function dominates(a: ScoredCandidate, b: ScoredCandidate): boolean {
  return a.x >= b.x && a.y >= b.y && (a.x > b.x || a.y > b.y);
}

function pickByXThenDc(candidates: ScoredCandidate[]): ScoredCandidate {
  return [...candidates].sort((a, b) => b.x - a.x || b.dc - a.dc)[0];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add solution-system/apps/api/src/app/evaluation/
git commit -m "feat(api): Pareto frontier, fixed gates, and winner selection"
```

---

### Task 4: Trace parser

**Files:**
- Create: `apps/api/src/app/trace/trace-parser.ts`
- Test: `apps/api/src/app/trace/trace-parser.spec.ts`

**Interfaces:**
- Consumes: `CausalLink`, `TraceStep`, `TraceStepType` (Task 1).
- Produces (used by Tasks 5, 7):
  - `parseRun(eventStream: string): ParsedRun` — throws `BadGatewayException` on ADK error events or zero model outputs
  - `interface ParsedRun { steps: TraceStep[]; coreProblem: string | null; symptoms: string[]; causalChain: CausalLink[] | null; rootCauseReached: boolean; candidateRecordsRaw: unknown; exitLoopCalled: boolean }`
  - `extractJson(text: string): unknown` — direct parse, then fenced ```json block, else null
  - Agent-name constants: `EXTRACTOR_AGENT = 'problem_extractor'`, `WHY_AGENT = 'why_step'`, `TRIZ_AGENT = 'triz_solver'`, `EXIT_LOOP_TOOL = 'exit_loop'`

- [ ] **Step 1: Write the failing parser tests**

````ts
// apps/api/src/app/trace/trace-parser.spec.ts
import { BadGatewayException } from '@nestjs/common';
import { parseRun } from './trace-parser';

const sse = (events: unknown[]): string =>
  events.map((event) => `data: ${JSON.stringify(event)}`).join('\n\n') + '\n\n';

const extractorDoc = [
  '# Reasoning',
  'Framed around intake clogging because every symptom traces back to it.',
  '',
  '# Core Problem',
  'Ballast water intake filters clog too quickly in sediment-heavy ports.',
  '',
  '# Key Constraints',
  '- Retrofit existing vessels only',
  '',
  '# Downstream Symptoms',
  '1. Pump cavitation alarms',
  '2. Weekly manual filter cleaning',
  '3. Intake pressure drops below spec',
  '',
  '# Success Criteria',
  '- Cleaning interval above one month',
].join('\n');

const chain1 = JSON.stringify({
  chain: [
    {
      why: 'Why do filters clog quickly?',
      because: 'Sediment load exceeds filter capacity.',
      link_validity: 4,
      reasoning: 'Measured sediment levels correlate with clogging events.',
    },
  ],
  root_cause_reached: false,
});

const chain2 = JSON.stringify({
  chain: [
    {
      why: 'Why do filters clog quickly?',
      because: 'Sediment load exceeds filter capacity.',
      link_validity: 4,
      reasoning: 'Measured sediment levels correlate with clogging events.',
    },
    {
      why: 'Why does sediment load exceed capacity?',
      because: 'The intake sits at hull depth where sediment concentration peaks.',
      link_validity: 4,
      reasoning: 'Port depth surveys show peak sediment at intake depth.',
    },
  ],
  root_cause_reached: true,
});

const candidateRecord = (id: string) => ({
  id,
  title: `Candidate ${id}`,
  summary: `Summary for ${id}`,
  causal_chain: JSON.parse(chain2).chain,
  intervention_index: 1,
  rcd: 4,
  ccv: 4,
  triz: { benefit: 4, cost: 1, harm: 1, contradiction_resolution: 4 },
  downstream_symptoms_total: 3,
  downstream_symptoms_resolved: 2,
  feasibility: { buildable_48h: true, deployable: true },
  contradiction_sentence: `Resolves intake depth vs sediment exposure for ${id}.`,
  principles_used: ['#1 Segmentation'],
  reasoning: 'Acts on the root link with a matrix-backed principle.',
});

const trizText = [
  '# Reasoning',
  'The matrix suggested segmentation for the depth vs sediment contradiction.',
  '',
  '```json',
  JSON.stringify([candidateRecord('c1'), candidateRecord('c2'), candidateRecord('c3')]),
  '```',
].join('\n');

const fullRunEvents = [
  {
    author: 'problem_extractor',
    invocationId: 'inv-1',
    timestamp: 1000,
    content: { parts: [{ text: extractorDoc }] },
    actions: { stateDelta: { core_problem: extractorDoc } },
  },
  {
    author: 'why_step',
    invocationId: 'inv-1',
    timestamp: 1001,
    content: { parts: [{ text: chain1 }] },
    actions: { stateDelta: { causal_chain: chain1 } },
  },
  {
    author: 'why_step',
    invocationId: 'inv-1',
    timestamp: 1002,
    content: {
      parts: [{ text: chain2 }, { functionCall: { name: 'exit_loop', args: {} } }],
    },
    actions: { stateDelta: { causal_chain: chain2 } },
  },
  {
    author: 'why_step',
    invocationId: 'inv-1',
    timestamp: 1003,
    content: { parts: [{ functionResponse: { name: 'exit_loop', response: {} } }] },
    actions: {},
  },
  {
    author: 'triz_solver',
    invocationId: 'inv-1',
    timestamp: 1004,
    content: {
      parts: [{ functionCall: { name: 'search_parameter', args: { query: 'flow' } } }],
    },
  },
  {
    author: 'triz_solver',
    invocationId: 'inv-1',
    timestamp: 1005,
    content: {
      parts: [{ functionResponse: { name: 'search_parameter', response: { matches: [13] } } }],
    },
  },
  {
    author: 'triz_solver',
    invocationId: 'inv-1',
    timestamp: 1006,
    content: { parts: [{ text: trizText }] },
    actions: { stateDelta: { candidate_records: trizText } },
  },
];

describe('parseRun', () => {
  it('turns every event part into an ordered trace step', () => {
    const run = parseRun(sse(fullRunEvents));

    expect(run.steps).toHaveLength(8);
    expect(run.steps.map((step) => step.type)).toEqual([
      'model_output',
      'model_output',
      'model_output',
      'tool_call',
      'tool_response',
      'tool_call',
      'tool_response',
      'model_output',
    ]);
    expect(run.steps.map((step) => step.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(run.steps[0].agent).toBe('problem_extractor');
    expect(run.steps[0].timestamp).toBe(1000);
    expect(run.steps[0].invocationId).toBe('inv-1');
  });

  it('extracts and strips the # Reasoning section for prose agents', () => {
    const run = parseRun(sse(fullRunEvents));

    expect(run.steps[0].reasoning).toBe(
      'Framed around intake clogging because every symptom traces back to it.',
    );
    expect(run.steps[0].content.startsWith('# Core Problem')).toBe(true);
    expect(run.steps[0].content).not.toContain('# Reasoning');
  });

  it('numbers why_step iterations and pulls reasoning from the newest link', () => {
    const run = parseRun(sse(fullRunEvents));

    expect(run.steps[1].iteration).toBe(1);
    expect(run.steps[2].iteration).toBe(2);
    expect(run.steps[2].reasoning).toBe(
      'Port depth surveys show peak sediment at intake depth.',
    );
  });

  it('captures tool calls and responses with their payloads', () => {
    const run = parseRun(sse(fullRunEvents));

    expect(run.steps[3]).toMatchObject({
      type: 'tool_call',
      toolName: 'exit_loop',
      agent: 'why_step',
    });
    expect(run.steps[5]).toMatchObject({
      type: 'tool_call',
      toolName: 'search_parameter',
      content: JSON.stringify({ query: 'flow' }),
    });
    expect(run.steps[6]).toMatchObject({
      type: 'tool_response',
      toolName: 'search_parameter',
    });
    expect(run.exitLoopCalled).toBe(true);
  });

  it('collects state: core problem, symptoms, causal chain, candidate records', () => {
    const run = parseRun(sse(fullRunEvents));

    expect(run.coreProblem).toBe(extractorDoc);
    expect(run.symptoms).toEqual([
      'Pump cavitation alarms',
      'Weekly manual filter cleaning',
      'Intake pressure drops below spec',
    ]);
    expect(run.causalChain).toHaveLength(2);
    expect(run.rootCauseReached).toBe(true);
    expect(Array.isArray(run.candidateRecordsRaw)).toBe(true);
    expect((run.candidateRecordsRaw as unknown[]).length).toBe(3);
  });

  it('falls back to text parsing when stateDelta is missing', () => {
    const withoutDeltas = fullRunEvents.map((event) => ({
      ...event,
      actions: {},
    }));

    const run = parseRun(sse(withoutDeltas));

    expect(run.symptoms).toHaveLength(3);
    expect(run.causalChain).toHaveLength(2);
    expect(Array.isArray(run.candidateRecordsRaw)).toBe(true);
  });

  it('skips malformed data lines', () => {
    const stream = 'data: {not json}\n\n' + sse(fullRunEvents);

    expect(parseRun(stream).steps).toHaveLength(8);
  });

  it('ignores user-authored events', () => {
    const stream = sse([
      { author: 'user', content: { parts: [{ text: 'Question' }] } },
      ...fullRunEvents,
    ]);

    expect(parseRun(stream).steps).toHaveLength(8);
  });

  it('throws BadGateway on ADK error events', () => {
    const stream = sse([
      { author: 'root_agent', errorCode: '429', errorMessage: 'Quota exceeded' },
    ]);

    expect(() => parseRun(stream)).toThrow(BadGatewayException);
    expect(() => parseRun(stream)).toThrow('ADK error 429: Quota exceeded');
  });

  it('throws BadGateway when the stream has no model output', () => {
    const stream = sse([
      {
        author: 'triz_solver',
        content: { parts: [{ functionCall: { name: 'search_parameter', args: {} } }] },
      },
    ]);

    expect(() => parseRun(stream)).toThrow(BadGatewayException);
  });
});
````

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test api`
Expected: FAIL — `Cannot find module './trace-parser'`.

- [ ] **Step 3: Implement the parser**

```ts
// apps/api/src/app/trace/trace-parser.ts
import { BadGatewayException } from '@nestjs/common';
import { CausalLink, TraceStep, TraceStepType } from './trace.types';

export const EXTRACTOR_AGENT = 'problem_extractor';
export const WHY_AGENT = 'why_step';
export const TRIZ_AGENT = 'triz_solver';
export const EXIT_LOOP_TOOL = 'exit_loop';

interface AdkEventPart {
  text?: string;
  functionCall?: { id?: string; name?: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name?: string; response?: unknown };
}

interface AdkEvent {
  invocationId?: string;
  author?: string;
  timestamp?: number;
  errorCode?: string;
  errorMessage?: string;
  content?: { parts?: AdkEventPart[] };
  actions?: { stateDelta?: Record<string, unknown> };
}

interface ChainDocument {
  chain: CausalLink[];
  root_cause_reached?: boolean;
}

export interface ParsedRun {
  steps: TraceStep[];
  coreProblem: string | null;
  symptoms: string[];
  causalChain: CausalLink[] | null;
  rootCauseReached: boolean;
  candidateRecordsRaw: unknown;
  exitLoopCalled: boolean;
}

export function parseRun(eventStream: string): ParsedRun {
  const run: ParsedRun = {
    steps: [],
    coreProblem: null,
    symptoms: [],
    causalChain: null,
    rootCauseReached: false,
    candidateRecordsRaw: null,
    exitLoopCalled: false,
  };
  let whyIteration = 0;

  for (const event of readEvents(eventStream)) {
    if (event.errorCode || event.errorMessage) {
      throw new BadGatewayException(formatAdkError(event));
    }

    if (!event.author || event.author === 'user') {
      continue;
    }

    for (const part of event.content?.parts ?? []) {
      if (part.functionCall?.name) {
        if (part.functionCall.name === EXIT_LOOP_TOOL) {
          run.exitLoopCalled = true;
        }
        run.steps.push(
          makeStep(
            run,
            event,
            'tool_call',
            JSON.stringify(part.functionCall.args ?? {}),
            part.functionCall.name,
          ),
        );
      } else if (part.functionResponse?.name) {
        run.steps.push(
          makeStep(
            run,
            event,
            'tool_response',
            JSON.stringify(part.functionResponse.response ?? null),
            part.functionResponse.name,
          ),
        );
      } else if (part.text?.trim()) {
        whyIteration = pushTextStep(run, event, part.text.trim(), whyIteration);
      }
    }

    applyStateDelta(run, event.actions?.stateDelta ?? {});
  }

  if (!run.steps.some((step) => step.type === 'model_output')) {
    throw new BadGatewayException('ADK response did not include model output.');
  }

  return run;
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = /```(?:json)?\s*\r?\n?([\s\S]*?)```/.exec(trimmed);

    if (!fenced) {
      return null;
    }

    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      return null;
    }
  }
}

function readEvents(eventStream: string): AdkEvent[] {
  return eventStream
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .filter((payload) => payload && payload !== '[DONE]')
    .flatMap((payload) => {
      try {
        return [JSON.parse(payload) as AdkEvent];
      } catch {
        return [];
      }
    });
}

function pushTextStep(
  run: ParsedRun,
  event: AdkEvent,
  text: string,
  whyIteration: number,
): number {
  const step = makeStep(run, event, 'model_output', text);

  if (event.author === WHY_AGENT) {
    whyIteration += 1;
    step.iteration = whyIteration;
    const chainDocument = parseChainDocument(text);

    if (chainDocument) {
      step.reasoning = chainDocument.chain.at(-1)?.reasoning;
      run.causalChain = chainDocument.chain;
      run.rootCauseReached = chainDocument.root_cause_reached ?? false;
    }
  } else {
    const { reasoning, content } = splitReasoning(text);
    step.reasoning = reasoning;
    step.content = content;

    if (event.author === EXTRACTOR_AGENT && !run.coreProblem) {
      run.coreProblem = text;
      run.symptoms = parseSymptoms(text);
    }

    if (event.author === TRIZ_AGENT && run.candidateRecordsRaw === null) {
      const json = extractJson(text);

      if (Array.isArray(json)) {
        run.candidateRecordsRaw = json;
      }
    }
  }

  run.steps.push(step);

  return whyIteration;
}

function applyStateDelta(run: ParsedRun, delta: Record<string, unknown>): void {
  const coreProblem = delta['core_problem'];

  if (typeof coreProblem === 'string') {
    run.coreProblem = coreProblem;
    run.symptoms = parseSymptoms(coreProblem);
  }

  const causalChain = delta['causal_chain'];

  if (typeof causalChain === 'string') {
    const chainDocument = parseChainDocument(causalChain);

    if (chainDocument) {
      run.causalChain = chainDocument.chain;
      run.rootCauseReached = chainDocument.root_cause_reached ?? false;
    }
  }

  const candidateRecords = delta['candidate_records'];

  if (typeof candidateRecords === 'string') {
    const json = extractJson(candidateRecords);

    if (json !== null) {
      run.candidateRecordsRaw = json;
    }
  }
}

function makeStep(
  run: ParsedRun,
  event: AdkEvent,
  type: TraceStepType,
  content: string,
  toolName?: string,
): TraceStep {
  return {
    index: run.steps.length,
    agent: event.author ?? 'unknown',
    type,
    content,
    toolName,
    timestamp: event.timestamp,
    invocationId: event.invocationId,
  };
}

function splitReasoning(text: string): { reasoning?: string; content: string } {
  const match = /^#\s*Reasoning\s*\r?\n([\s\S]*?)(?=\n#\s|$)/.exec(text);

  if (!match) {
    return { content: text };
  }

  const reasoning = match[1].trim();
  const content = text.slice(match[0].length).trim();

  return reasoning ? { reasoning, content } : { content: text };
}

function parseSymptoms(document: string): string[] {
  const section = /#\s*Downstream Symptoms\s*\r?\n([\s\S]*?)(?=\n#\s|$)/.exec(
    document,
  );

  if (!section) {
    return [];
  }

  return section[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)]\s+/.test(line))
    .map((line) => line.replace(/^\d+[.)]\s+/, ''));
}

function parseChainDocument(text: string): ChainDocument | null {
  const value = extractJson(text) as ChainDocument | null;

  if (!value || typeof value !== 'object' || !Array.isArray(value.chain)) {
    return null;
  }

  const links = value.chain.filter(
    (link): link is CausalLink =>
      Boolean(link) &&
      typeof link.why === 'string' &&
      typeof link.because === 'string' &&
      typeof link.link_validity === 'number',
  );

  if (links.length !== value.chain.length) {
    return null;
  }

  return { chain: links, root_cause_reached: value.root_cause_reached };
}

function formatAdkError(event: AdkEvent): string {
  const code = event.errorCode ? ` ${event.errorCode}` : '';
  const message = event.errorMessage ? `: ${event.errorMessage}` : '';

  return `ADK error${code}${message}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add solution-system/apps/api/src/app/trace/
git commit -m "feat(api): parse the full ADK event stream into an agent trace"
```

---

### Task 5: Conformance checks

**Files:**
- Create: `apps/api/src/app/evaluation/conformance.ts`
- Test: `apps/api/src/app/evaluation/conformance.spec.ts`

**Interfaces:**
- Consumes: `ParsedRun`, `WHY_AGENT`, `TRIZ_AGENT` (Task 4), `computeCcv` (Task 2), types (Task 1).
- Produces (used by Task 7): `runChecks(run: ParsedRun, records: CandidateRecord[] | null): ConformanceCheck[]` — 7 base checks always; +5 record checks when `records` is non-null.

- [ ] **Step 1: Write the failing conformance tests**

```ts
// apps/api/src/app/evaluation/conformance.spec.ts
import { CandidateRecord, TraceStep } from '../trace/trace.types';
import { ParsedRun } from '../trace/trace-parser';
import { runChecks } from './conformance';

const whyStep = (iteration: number): TraceStep => ({
  index: iteration,
  agent: 'why_step',
  type: 'model_output',
  content: '{}',
  iteration,
});

const trizToolCall: TraceStep = {
  index: 90,
  agent: 'triz_solver',
  type: 'tool_call',
  content: '{}',
  toolName: 'search_parameter',
};

const baseRun = (): ParsedRun => ({
  steps: [whyStep(1), whyStep(2), trizToolCall],
  coreProblem: 'doc',
  symptoms: ['s1', 's2', 's3'],
  causalChain: [
    { why: 'w1', because: 'b1', link_validity: 4 },
    { why: 'w2', because: 'b2', link_validity: 4 },
  ],
  rootCauseReached: true,
  candidateRecordsRaw: [],
  exitLoopCalled: true,
});

const record = (overrides: Partial<CandidateRecord> = {}): CandidateRecord => ({
  id: 'c1',
  title: 'Candidate',
  summary: 'Summary',
  causal_chain: [],
  intervention_index: 1,
  rcd: 4,
  ccv: 4,
  triz: { benefit: 4, cost: 1, harm: 1, contradiction_resolution: 4 },
  downstream_symptoms_total: 3,
  downstream_symptoms_resolved: 2,
  feasibility: { buildable_48h: true, deployable: true },
  contradiction_sentence: 'Sentence.',
  ...overrides,
});

const byId = (checks: ReturnType<typeof runChecks>, id: string) => {
  const found = checks.find((check) => check.id === id);
  if (!found) {
    throw new Error(`check ${id} missing`);
  }
  return found;
};

describe('runChecks', () => {
  it('passes every check for a clean run', () => {
    const checks = runChecks(baseRun(), [record(), record({ id: 'c2' }), record({ id: 'c3' })]);

    expect(checks).toHaveLength(12);
    expect(checks.filter((check) => !check.passed)).toEqual([]);
  });

  it('emits only base checks when records are missing', () => {
    const checks = runChecks(baseRun(), null);

    expect(checks).toHaveLength(7);
    expect(byId(checks, 'triz.candidates_parse').passed).toBe(false);
  });

  it('fails fiveY checks when the loop misbehaves', () => {
    const run = baseRun();
    run.steps = [trizToolCall]; // no why iterations
    run.causalChain = null;
    run.exitLoopCalled = false;

    const checks = runChecks(run, null);

    expect(byId(checks, 'fiveY.iterations_in_range').passed).toBe(false);
    expect(byId(checks, 'fiveY.one_why_per_iteration').passed).toBe(false);
    expect(byId(checks, 'fiveY.link_validity_in_range').passed).toBe(false);
    expect(byId(checks, 'fiveY.exit_reason_recorded').passed).toBe(false);
  });

  it('treats a full 5-iteration loop without exit_loop as a valid exit', () => {
    const run = baseRun();
    run.steps = [whyStep(1), whyStep(2), whyStep(3), whyStep(4), whyStep(5), trizToolCall];
    run.causalChain = Array.from({ length: 5 }, (_, i) => ({
      why: `w${i}`,
      because: `b${i}`,
      link_validity: 3,
    }));
    run.exitLoopCalled = false;

    const checks = runChecks(run, null);

    expect(byId(checks, 'fiveY.exit_reason_recorded').passed).toBe(true);
    expect(byId(checks, 'fiveY.exit_reason_recorded').details).toContain('maxIterations');
  });

  it('fails triz checks for tool neglect, bad ccv, bad index, bad totals', () => {
    const run = baseRun();
    run.steps = [whyStep(1), whyStep(2)]; // no MCP calls

    const checks = runChecks(run, [
      record({ ccv: 5, intervention_index: 7, downstream_symptoms_total: 9 }),
    ]);

    expect(byId(checks, 'triz.mcp_tool_used').passed).toBe(false);
    expect(byId(checks, 'triz.candidate_count_in_range').passed).toBe(false); // 1 < 3
    expect(byId(checks, 'triz.ccv_matches_chain').passed).toBe(false); // computed 4, claimed 5
    expect(byId(checks, 'triz.intervention_index_in_bounds').passed).toBe(false);
    expect(byId(checks, 'triz.symptoms_total_consistent').passed).toBe(false);
  });

  it('fails range check for out-of-range scores', () => {
    const checks = runChecks(baseRun(), [
      record({ triz: { benefit: 9, cost: 1, harm: 1, contradiction_resolution: 4 } }),
      record({ id: 'c2' }),
      record({ id: 'c3' }),
    ]);

    expect(byId(checks, 'triz.fields_in_range').passed).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test api`
Expected: FAIL — `Cannot find module './conformance'`.

- [ ] **Step 3: Implement the checks**

```ts
// apps/api/src/app/evaluation/conformance.ts
import { CandidateRecord, ConformanceCheck } from '../trace/trace.types';
import { ParsedRun, TRIZ_AGENT, WHY_AGENT } from '../trace/trace-parser';
import { computeCcv } from './evaluation.engine';

const MIN_CANDIDATES = 3;
const MAX_CANDIDATES = 5;
const MAX_WHYS = 5;

export function runChecks(
  run: ParsedRun,
  records: CandidateRecord[] | null,
): ConformanceCheck[] {
  const checks: ConformanceCheck[] = [];
  const chain = run.causalChain ?? [];
  const whySteps = run.steps.filter(
    (step) => step.agent === WHY_AGENT && step.type === 'model_output',
  );
  const trizToolCalls = run.steps.filter(
    (step) => step.agent === TRIZ_AGENT && step.type === 'tool_call',
  );

  checks.push(
    check(
      'extractor.symptoms_listed',
      'problem_extractor',
      run.symptoms.length > 0,
      `${run.symptoms.length} downstream symptoms listed`,
    ),
    check(
      'fiveY.iterations_in_range',
      'fiveY',
      whySteps.length >= 1 && whySteps.length <= MAX_WHYS,
      `${whySteps.length} why iterations`,
    ),
    check(
      'fiveY.one_why_per_iteration',
      'fiveY',
      chain.length > 0 && chain.length === whySteps.length,
      `chain has ${chain.length} links over ${whySteps.length} iterations`,
    ),
    check(
      'fiveY.link_validity_in_range',
      'fiveY',
      chain.length > 0 &&
        chain.every(
          (link) =>
            Number.isInteger(link.link_validity) &&
            link.link_validity >= 1 &&
            link.link_validity <= 5,
        ),
      `validities: [${chain.map((link) => link.link_validity).join(', ')}]`,
    ),
  );

  const exitReason = run.exitLoopCalled
    ? 'exit_loop (root cause reached)'
    : whySteps.length >= MAX_WHYS
      ? 'maxIterations'
      : 'none';

  checks.push(
    check(
      'fiveY.exit_reason_recorded',
      'fiveY',
      exitReason !== 'none',
      `loop ended via ${exitReason}`,
    ),
    check(
      'triz.mcp_tool_used',
      TRIZ_AGENT,
      trizToolCalls.length > 0,
      `${trizToolCalls.length} MCP tool calls`,
    ),
    check(
      'triz.candidates_parse',
      TRIZ_AGENT,
      records !== null,
      records
        ? `${records.length} candidate records parsed`
        : 'candidate records missing or invalid',
    ),
  );

  if (!records) {
    return checks;
  }

  const ccv = computeCcv(chain);
  const scoresInRange = records.every(
    (record) =>
      [
        record.rcd,
        record.ccv,
        record.triz.benefit,
        record.triz.cost,
        record.triz.harm,
        record.triz.contradiction_resolution,
      ].every((value) => Number.isInteger(value) && value >= 1 && value <= 5) &&
      record.downstream_symptoms_resolved >= 0 &&
      record.downstream_symptoms_resolved <= record.downstream_symptoms_total,
  );

  checks.push(
    check(
      'triz.candidate_count_in_range',
      TRIZ_AGENT,
      records.length >= MIN_CANDIDATES && records.length <= MAX_CANDIDATES,
      `${records.length} candidates (target ${MIN_CANDIDATES}-${MAX_CANDIDATES})`,
    ),
    check(
      'triz.fields_in_range',
      TRIZ_AGENT,
      scoresInRange,
      scoresInRange
        ? 'all record scores within declared ranges'
        : 'some record scores out of range',
    ),
    check(
      'triz.ccv_matches_chain',
      TRIZ_AGENT,
      chain.length > 0 && records.every((record) => record.ccv === ccv),
      `computed ccv=${ccv}, claimed=[${records.map((record) => record.ccv).join(', ')}]`,
    ),
    check(
      'triz.intervention_index_in_bounds',
      TRIZ_AGENT,
      chain.length > 0 &&
        records.every(
          (record) =>
            Number.isInteger(record.intervention_index) &&
            record.intervention_index >= 0 &&
            record.intervention_index < chain.length,
        ),
      `chain length ${chain.length}, indexes [${records
        .map((record) => record.intervention_index)
        .join(', ')}]`,
    ),
    check(
      'triz.symptoms_total_consistent',
      TRIZ_AGENT,
      run.symptoms.length > 0 &&
        records.every(
          (record) => record.downstream_symptoms_total === run.symptoms.length,
        ),
      `extractor listed ${run.symptoms.length}, records claim [${records
        .map((record) => record.downstream_symptoms_total)
        .join(', ')}]`,
    ),
  );

  return checks;
}

function check(
  id: string,
  agent: string,
  passed: boolean,
  details: string,
): ConformanceCheck {
  return { id, agent, passed, details };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add solution-system/apps/api/src/app/evaluation/
git commit -m "feat(api): per-run conformance checks on agent behavior"
```

---

### Task 6: Report renderer

**Files:**
- Create: `apps/api/src/app/evaluation/report-renderer.ts`
- Test: `apps/api/src/app/evaluation/report-renderer.spec.ts`

**Interfaces:**
- Consumes: `EvaluationResult`, `CausalLink`, `ScoredCandidate` (Task 1).
- Produces (used by Task 7): `renderReport(evaluation: EvaluationResult | null, chain: CausalLink[] | null, failureReason?: string): string`.

- [ ] **Step 1: Write the failing renderer tests**

```ts
// apps/api/src/app/evaluation/report-renderer.spec.ts
import {
  CausalLink,
  EvaluationResult,
  ScoredCandidate,
} from '../trace/trace.types';
import { renderReport } from './report-renderer';

const chain: CausalLink[] = [
  { why: 'Why A?', because: 'Because B.', link_validity: 4 },
  { why: 'Why B?', because: 'Because C.', link_validity: 4 },
];

const scored = (id: string, x: number, y: number): ScoredCandidate => ({
  record: {
    id,
    title: `Candidate ${id}`,
    summary: `Summary for ${id}`,
    causal_chain: chain,
    intervention_index: 1,
    rcd: 4,
    ccv: 4,
    triz: { benefit: 4, cost: 1, harm: 1, contradiction_resolution: 4 },
    downstream_symptoms_total: 3,
    downstream_symptoms_resolved: 2,
    feasibility: { buildable_48h: true, deployable: true },
    contradiction_sentence: `Contradiction sentence for ${id}.`,
  },
  x,
  y,
  dc: 2 / 3,
  ccvComputed: 4,
  feasible: true,
  onFrontier: true,
  passesGates: x >= 60 && y >= 60,
});

const evaluation = (winnerId: string | null): EvaluationResult => ({
  gateX: 60,
  gateY: 60,
  candidates: [scored('c1', 62.5, 63.3), scored('c2', 45.8, 40.1)],
  frontierIds: ['c1', 'c2'],
  gatedIds: winnerId ? ['c1'] : [],
  winnerId,
  verdict: winnerId
    ? 'Single candidate clears both gates: c1.'
    : 'No candidate clears both gates. Strongest frontier point: c1.',
});

describe('renderReport', () => {
  it('renders the winner with coordinates, chain, and contradiction sentence', () => {
    const report = renderReport(evaluation('c1'), chain);

    expect(report).toContain('# Decision');
    expect(report).toContain('## Winner: Candidate c1 (c1)');
    expect(report).toContain('X_targeting: 62.5');
    expect(report).toContain('Contradiction sentence for c1.');
    expect(report).toContain('← intervention point');
    expect(report).toContain('| c2 | Candidate c2 |');
  });

  it('renders the verdict without a winner section when gates fail', () => {
    const report = renderReport(evaluation(null), chain);

    expect(report).toContain('No candidate clears both gates.');
    expect(report).not.toContain('## Winner:');
    expect(report).toContain('## Candidate plane');
  });

  it('renders a failure explanation when evaluation is unavailable', () => {
    const report = renderReport(null, null, 'Evaluation unavailable: no valid causal chain.');

    expect(report).toContain('# Evaluation Unavailable');
    expect(report).toContain('no valid causal chain');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test api`
Expected: FAIL — `Cannot find module './report-renderer'`.

- [ ] **Step 3: Implement the renderer**

```ts
// apps/api/src/app/evaluation/report-renderer.ts
import { CausalLink, EvaluationResult } from '../trace/trace.types';

export function renderReport(
  evaluation: EvaluationResult | null,
  chain: CausalLink[] | null,
  failureReason?: string,
): string {
  if (!evaluation) {
    return [
      '# Evaluation Unavailable',
      '',
      failureReason ?? 'The run did not produce evaluable data.',
    ].join('\n');
  }

  const lines: string[] = ['# Decision', '', evaluation.verdict];
  const winner = evaluation.candidates.find(
    (candidate) => candidate.record.id === evaluation.winnerId,
  );

  if (winner) {
    lines.push(
      '',
      `## Winner: ${winner.record.title} (${winner.record.id})`,
      '',
      `- X_targeting: ${winner.x.toFixed(1)} / Y_quality: ${winner.y.toFixed(1)} (gates: ${evaluation.gateX}/${evaluation.gateY})`,
      `- Symptom coverage (dc): ${(winner.dc * 100).toFixed(0)}%`,
      `- Contradiction: ${winner.record.contradiction_sentence}`,
      '',
      winner.record.summary,
    );

    if (chain && chain.length > 0) {
      lines.push('', '### Causal chain it acts on');
      chain.forEach((link, index) => {
        const marker =
          index === winner.record.intervention_index
            ? ' ← intervention point'
            : '';
        lines.push(
          `${index + 1}. ${link.why} — ${link.because} (validity ${link.link_validity})${marker}`,
        );
      });
    }
  }

  lines.push(
    '',
    '## Candidate plane',
    '',
    '| id | title | X | Y | dc | feasible | frontier | gates |',
    '|---|---|---|---|---|---|---|---|',
  );

  for (const candidate of evaluation.candidates) {
    lines.push(
      `| ${candidate.record.id} | ${candidate.record.title} | ${candidate.x.toFixed(1)} | ${candidate.y.toFixed(1)} | ${(candidate.dc * 100).toFixed(0)}% | ${flag(candidate.feasible)} | ${flag(candidate.onFrontier)} | ${flag(candidate.passesGates)} |`,
    );
  }

  return lines.join('\n');
}

function flag(value: boolean): string {
  return value ? 'yes' : 'no';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add solution-system/apps/api/src/app/evaluation/
git commit -m "feat(api): deterministic report rendering from evaluation results"
```

---

### Task 7: AgentService integration

**Files:**
- Modify: `apps/api/src/app/agent.service.ts` (full rewrite below)
- Modify: `apps/api/src/app/agent.dto.ts`
- Test: `apps/api/src/app/agent.service.spec.ts` (full rewrite below)

**Interfaces:**
- Consumes: `parseRun` (Task 4), `parseCandidateRecords`/`scoreCandidate`/`selectWinner` (Tasks 2–3), `runChecks` (Task 5), `renderReport` (Task 6), `AgentTrace` (Task 1).
- Produces (used by Task 8):
  - `AgentService.runTracedMessage(sessionId: string, message: string): Promise<{ text: string; trace: AgentTrace }>`
  - `AgentService.createSession(): Promise<string>` (unchanged)
  - `AgentMessageResponseDto` gains `trace: AgentTrace`
  - **Removed:** `extractModelText` — `ChatService` switches to `runTracedMessage` in Task 8. Tasks 7 and 8 must land together (the build is broken between them), so run the Task 8 tests before committing if executing sequentially without intermediate commits — or accept the intermediate commit compiling only after both: to keep every commit green, Task 7 keeps a thin compatibility shim (see Step 3) that Task 8 deletes.

- [ ] **Step 1: Rewrite the AgentService spec**

Replace the entire `apps/api/src/app/agent.service.spec.ts` with:

````ts
// apps/api/src/app/agent.service.spec.ts
import axios from 'axios';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { AgentService } from './agent.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const sse = (events: unknown[]): string =>
  events.map((event) => `data: ${JSON.stringify(event)}`).join('\n\n') + '\n\n';

const extractorDoc = [
  '# Reasoning',
  'Framed around intake clogging.',
  '',
  '# Core Problem',
  'Filters clog too quickly.',
  '',
  '# Downstream Symptoms',
  '1. Pump cavitation alarms',
  '2. Weekly manual cleaning',
  '3. Pressure drops',
  '',
  '# Success Criteria',
  '- Longer cleaning interval',
].join('\n');

const chainDoc = JSON.stringify({
  chain: [
    { why: 'Why clog?', because: 'Sediment overload.', link_validity: 4, reasoning: 'Measured.' },
    { why: 'Why overload?', because: 'Intake at sediment peak depth.', link_validity: 4, reasoning: 'Surveys.' },
  ],
  root_cause_reached: true,
});

const candidateRecord = (id: string) => ({
  id,
  title: `Candidate ${id}`,
  summary: `Summary ${id}`,
  causal_chain: JSON.parse(chainDoc).chain,
  intervention_index: 1,
  rcd: 4,
  ccv: 4,
  triz: { benefit: 4, cost: 1, harm: 1, contradiction_resolution: 4 },
  downstream_symptoms_total: 3,
  downstream_symptoms_resolved: 2,
  feasibility: { buildable_48h: true, deployable: true },
  contradiction_sentence: `Contradiction for ${id}.`,
});

const trizText = [
  '# Reasoning',
  'Matrix pointed to segmentation.',
  '',
  '```json',
  JSON.stringify([candidateRecord('c1'), candidateRecord('c2'), candidateRecord('c3')]),
  '```',
].join('\n');

const fullStream = sse([
  {
    author: 'problem_extractor',
    invocationId: 'inv-1',
    timestamp: 1,
    content: { parts: [{ text: extractorDoc }] },
    actions: { stateDelta: { core_problem: extractorDoc } },
  },
  {
    author: 'why_step',
    invocationId: 'inv-1',
    timestamp: 2,
    content: { parts: [{ text: chainDoc }, { functionCall: { name: 'exit_loop', args: {} } }] },
    actions: { stateDelta: { causal_chain: chainDoc } },
  },
  {
    author: 'triz_solver',
    invocationId: 'inv-1',
    timestamp: 3,
    content: { parts: [{ functionCall: { name: 'search_parameter', args: { query: 'flow' } } }] },
  },
  {
    author: 'triz_solver',
    invocationId: 'inv-1',
    timestamp: 4,
    content: { parts: [{ functionResponse: { name: 'search_parameter', response: { matches: [13] } } }] },
  },
  {
    author: 'triz_solver',
    invocationId: 'inv-1',
    timestamp: 5,
    content: { parts: [{ text: trizText }] },
    actions: { stateDelta: { candidate_records: trizText } },
  },
]);

describe('AgentService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      ADK_AGENT_URL: 'http://adk-agent:8081',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates a session when no sessionId is provided and returns text + trace', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'new-session' } })
      .mockResolvedValueOnce({ data: fullStream });

    const service = new AgentService();
    const response = await service.sendMessage({ message: 'Solve this' });

    expect(response.sessionId).toBe('new-session');
    expect(response.text).toContain('# Decision');
    expect(response.text).toContain('## Winner:');
    expect(response.trace.steps.length).toBe(6);
    expect(response.trace.causalChain).toHaveLength(2);
    expect(response.trace.candidates).toHaveLength(3);
    expect(response.trace.evaluation?.winnerId).toBe('c1');
    expect(response.trace.checks.every((check) => check.passed)).toBe(true);

    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      'http://adk-agent:8081/apps/agent/users/user/sessions',
      {},
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      'http://adk-agent:8081/run_sse',
      {
        appName: 'agent',
        userId: 'user',
        sessionId: 'new-session',
        newMessage: { role: 'user', parts: [{ text: 'Solve this' }] },
      },
      { headers: { Accept: 'text/event-stream' }, responseType: 'text' },
    );
  });

  it('reuses a provided sessionId', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: fullStream });

    const service = new AgentService();
    const response = await service.sendMessage({
      message: 'Continue',
      sessionId: 'existing-session',
    });

    expect(response.sessionId).toBe('existing-session');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('rejects empty messages', async () => {
    const service = new AgentService();

    await expect(service.sendMessage({ message: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('degrades to a failure report when the chain is missing', async () => {
    const streamWithoutChain = sse([
      {
        author: 'problem_extractor',
        content: { parts: [{ text: extractorDoc }] },
        actions: { stateDelta: { core_problem: extractorDoc } },
      },
      {
        author: 'triz_solver',
        content: { parts: [{ text: trizText }] },
        actions: { stateDelta: { candidate_records: trizText } },
      },
    ]);
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 's' } })
      .mockResolvedValueOnce({ data: streamWithoutChain });

    const service = new AgentService();
    const response = await service.sendMessage({ message: 'Solve this' });

    expect(response.text).toContain('# Evaluation Unavailable');
    expect(response.text).toContain('no valid causal chain');
    expect(response.trace.evaluation).toBeNull();
    expect(response.trace.steps.length).toBeGreaterThan(0);
  });

  it('maps upstream session failures to BadGatewayException', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('connection refused'));

    const service = new AgentService();

    await expect(service.sendMessage({ message: 'Question' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('surfaces ADK error events from the stream', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'new-session' } })
      .mockResolvedValueOnce({
        data: sse([
          { author: 'root_agent', errorCode: '429', errorMessage: 'Quota exceeded' },
        ]),
      });

    const service = new AgentService();

    await expect(service.sendMessage({ message: 'Question' })).rejects.toMatchObject({
      response: { message: 'ADK error 429: Quota exceeded' },
    });
  });

  it('maps streams without model output to BadGatewayException', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'new-session' } })
      .mockResolvedValueOnce({ data: 'data: {"author":"root_agent"}\n\n' });

    const service = new AgentService();

    await expect(service.sendMessage({ message: 'Question' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
````

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test api`
Expected: FAIL — `sendMessage` result has no `trace`; `runTracedMessage` missing.

- [ ] **Step 3: Rewrite AgentService and the DTO**

Replace `apps/api/src/app/agent.dto.ts` with:

```ts
import { AgentTrace } from './trace/trace.types';

export interface AgentMessageRequestDto {
  message: string;
  sessionId?: string;
}

export interface AgentMessageResponseDto {
  sessionId: string;
  text: string;
  trace: AgentTrace;
}
```

Replace `apps/api/src/app/agent.service.ts` with:

```ts
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import axios from 'axios';
import {
  AgentMessageRequestDto,
  AgentMessageResponseDto,
} from './agent.dto';
import { runChecks } from './evaluation/conformance';
import {
  parseCandidateRecords,
  scoreCandidate,
  selectWinner,
} from './evaluation/evaluation.engine';
import { renderReport } from './evaluation/report-renderer';
import { parseRun } from './trace/trace-parser';
import { AgentTrace } from './trace/trace.types';

interface AdkSessionResponse {
  id?: string;
  sessionId?: string;
}

@Injectable()
export class AgentService {
  private readonly adkAgentUrl =
    process.env.ADK_AGENT_URL ?? 'http://localhost:8081';

  async sendMessage(
    request: AgentMessageRequestDto,
  ): Promise<AgentMessageResponseDto> {
    const message = request.message?.trim();

    if (!message) {
      throw new BadRequestException('Message is required.');
    }

    const sessionId = request.sessionId?.trim() || (await this.createSession());
    const { text, trace } = await this.runTracedMessage(sessionId, message);

    return { sessionId, text, trace };
  }

  async runTracedMessage(
    sessionId: string,
    message: string,
  ): Promise<{ text: string; trace: AgentTrace }> {
    const eventStream = await this.runAgent(sessionId, message);
    const run = parseRun(eventStream);
    const chain = run.causalChain;
    const records = parseCandidateRecords(run.candidateRecordsRaw);
    const canEvaluate = chain !== null && records !== null;
    const candidates = canEvaluate
      ? records.map((record) => scoreCandidate(record, chain))
      : [];
    const evaluation = canEvaluate ? selectWinner(candidates) : null;
    const checks = runChecks(run, records);
    const failureReason =
      chain === null
        ? 'Evaluation unavailable: no valid causal chain.'
        : records === null
          ? 'Evaluation unavailable: no valid candidate records.'
          : undefined;
    const text = renderReport(evaluation, chain, failureReason);

    return {
      text,
      trace: { steps: run.steps, causalChain: chain, candidates, evaluation, checks },
    };
  }

  async createSession(): Promise<string> {
    try {
      const response = await axios.post<AdkSessionResponse>(
        `${this.adkAgentUrl}/apps/agent/users/user/sessions`,
        {},
      );
      const sessionId = response.data.id ?? response.data.sessionId;

      if (!sessionId) {
        throw new Error('ADK session response did not include a session id.');
      }

      return sessionId;
    } catch {
      throw new BadGatewayException('Unable to create an ADK session.');
    }
  }

  async runAgent(sessionId: string, message: string): Promise<string> {
    try {
      const response = await axios.post<string>(
        `${this.adkAgentUrl}/run_sse`,
        {
          appName: 'agent',
          userId: 'user',
          sessionId,
          newMessage: {
            role: 'user',
            parts: [{ text: message }],
          },
        },
        {
          headers: {
            Accept: 'text/event-stream',
          },
          responseType: 'text',
        },
      );

      return response.data;
    } catch {
      throw new BadGatewayException('Unable to run the ADK agent.');
    }
  }
}
```

Note: `extractModelText` and its private helpers are deleted. `ChatService` still calls
`runAgent` + `extractModelText` until Task 8 — to keep this commit compiling and green,
Task 8's `chat.service.ts`/spec changes are folded into the same verification cycle if
`npx nx test api` fails here on `chat.service.ts`. Practically: apply Task 7 and Task 8
Steps 1–3 back-to-back, then run the suite once; commit separately if both are green, or
as one commit `feat(api): traced agent runs with deterministic evaluation` if not
separable. (TypeScript will fail the chat spec's `extractModelText` mock typing — that is
the expected forcing function.)

- [ ] **Step 4: Run tests**

Run: `npx nx test api`
Expected: `agent.service.spec` PASSES; `chat.service.spec` FAILS to compile (references removed `extractModelText`). Proceed directly to Task 8 — do not commit yet.

---

### Task 8: Chat persistence — JSONB trace column, ChatService, DTOs

**Files:**
- Modify: `apps/api/src/app/chat/db/chat-message.model.ts`
- Modify: `apps/api/src/app/chat/chat.dto.ts`
- Modify: `apps/api/src/app/chat/chat.service.ts`
- Modify: `apps/api/src/app/app.module.ts`
- Test: `apps/api/src/app/chat/chat.service.spec.ts`

**Interfaces:**
- Consumes: `AgentService.runTracedMessage` (Task 7), `AgentTrace` (Task 1).
- Produces: `ChatMessageDto.trace?: AgentTrace`; assistant `chat_messages` rows persist `trace` JSONB; `SendChatMessageResponseDto` carries traces via its `messages`.

- [ ] **Step 1: Update the ChatService spec**

In `apps/api/src/app/chat/chat.service.spec.ts`:

Replace the mock type and setup (lines 18–37 in the current file):

```ts
  let agentService: jest.Mocked<
    Pick<AgentService, 'createSession' | 'runTracedMessage'>
  >;
```

```ts
    agentService = {
      createSession: jest.fn(),
      runTracedMessage: jest.fn(),
    };
```

Add a stub trace near the top of the file (after the `iso` helper):

```ts
import { AgentTrace } from '../trace/trace.types';

const stubTrace: AgentTrace = {
  steps: [
    {
      index: 0,
      agent: 'problem_extractor',
      type: 'model_output',
      content: 'doc',
    },
  ],
  causalChain: null,
  candidates: [],
  evaluation: null,
  checks: [],
};
```

Replace the `rejects empty messages` assertion on `runAgent`:

```ts
    expect(agentService.runTracedMessage).not.toHaveBeenCalled();
```

Replace the `persists user and assistant messages for an existing chat` test body's agent mocking and assertions:

```ts
    agentService.runTracedMessage.mockResolvedValue({
      text: 'Answer',
      trace: stubTrace,
    });
```

The `bulkCreate` resolved value's assistant entry gains `trace: stubTrace`, and the expected response's assistant message gains `trace: stubTrace`:

```ts
    messageModel.bulkCreate.mockResolvedValue([
      {
        id: 10,
        role: 'user',
        text: 'Question',
        createdAt: iso('2026-07-04T10:01:00.000Z'),
      },
      {
        id: 11,
        role: 'assistant',
        text: 'Answer',
        trace: stubTrace,
        createdAt: iso('2026-07-04T10:01:01.000Z'),
      },
    ]);

    await expect(
      service.sendMessage(1, { message: ' Question ' }),
    ).resolves.toEqual({
      chatId: 1,
      title: 'Question',
      messages: [
        {
          id: 10,
          role: 'user',
          text: 'Question',
          createdAt: '2026-07-04T10:01:00.000Z',
        },
        {
          id: 11,
          role: 'assistant',
          text: 'Answer',
          trace: stubTrace,
          createdAt: '2026-07-04T10:01:01.000Z',
        },
      ],
    });

    expect(agentService.runTracedMessage).toHaveBeenCalledWith('adk-1', 'Question');
    expect(messageModel.bulkCreate).toHaveBeenCalledWith(
      [
        { chatId: 1, role: 'user', text: 'Question' },
        { chatId: 1, role: 'assistant', text: 'Answer', trace: stubTrace },
      ],
      { transaction: { id: 'tx' } },
    );
```

Replace the failing-ADK test's mock:

```ts
    agentService.runTracedMessage.mockRejectedValue(
      new BadGatewayException('ADK down'),
    );
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test api`
Expected: FAIL — `runTracedMessage` not used by `ChatService`, bulkCreate shape mismatch.

- [ ] **Step 3: Implement persistence changes**

`apps/api/src/app/chat/db/chat-message.model.ts` — add after the `text` column:

```ts
  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare trace: AgentTrace | null;
```

with import:

```ts
import { AgentTrace } from '../../trace/trace.types';
```

`apps/api/src/app/chat/chat.dto.ts` — extend the message DTO:

```ts
import { AgentTrace } from '../trace/trace.types';
```

```ts
export interface ChatMessageDto {
  id: number;
  role: ChatRole;
  text: string;
  createdAt: string;
  trace?: AgentTrace;
}
```

`apps/api/src/app/chat/chat.service.ts` — in `sendMessage`, replace

```ts
    const eventStream = await this.agentService.runAgent(
      chat.adkSessionId,
      message,
    );
    const assistantText = this.agentService.extractModelText(eventStream);
```

with

```ts
    const { text: assistantText, trace } = await this.agentService.runTracedMessage(
      chat.adkSessionId,
      message,
    );
```

and in the `bulkCreate` call, the assistant row becomes:

```ts
            { chatId: chat.id, role: 'assistant', text: assistantText, trace },
```

and `toMessage` becomes:

```ts
  private toMessage(message: ChatMessage): ChatMessageDto {
    return {
      id: message.id,
      role: message.role,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      ...(message.trace ? { trace: message.trace } : {}),
    };
  }
```

`apps/api/src/app/app.module.ts` — `synchronize: true` alone does **not** add columns to
existing tables; add `alter` sync so the new JSONB column appears in existing dev databases:

```ts
      autoLoadModels: true,
      synchronize: true,
      sync: { alter: true },
```

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npx nx test api`
Expected: PASS — all suites including the Task 7 agent.service.spec.

- [ ] **Step 5: Type-check and commit Tasks 7+8**

Run: `npx tsc -p apps/api/tsconfig.app.json --noEmit`
Expected: exits 0.

```bash
git add solution-system/apps/api/src/app/
git commit -m "feat(api): traced agent runs, JSONB trace persistence, evaluation-backed responses"
```

---

### Task 9: Agent pipeline rewrite (fiveY loop + TRIZ candidate records)

**Files:**
- Modify: `adg-agents/agent.ts` (full rewrite below)

**Interfaces:**
- Consumes: `@google/adk` exports `LlmAgent`, `LoopAgent`, `SequentialAgent`, `MCPToolset`, `EXIT_LOOP`.
- Produces: event stream whose authors are `problem_extractor`, `why_step`, `triz_solver`; state keys `core_problem`, `causal_chain`, `candidate_records` — exactly what the Task 4 parser and Task 5 checks expect.

- [ ] **Step 1: Rewrite `adg-agents/agent.ts`**

````ts
import {
  EXIT_LOOP,
  LlmAgent,
  LoopAgent,
  MCPToolset,
  SequentialAgent,
  type StreamableHTTPConnectionParams,
} from '@google/adk';

const model = 'gemini-2.5-flash';
const mcpUrl = process.env.MCP_SERVER_URL ?? 'http://localhost:8000/mcp';

const connectionParams: StreamableHTTPConnectionParams = {
  type: 'StreamableHTTPConnectionParams',
  url: mcpUrl,
};

const trizToolset = new MCPToolset(connectionParams);

const problemExtractorInstruction = `
You are a precise problem-framing agent.

Your job is to extract the core problem from the user's request so downstream solver agents solve the right thing.

Return only this structure:
# Reasoning
2-4 sentences explaining why you framed the problem this way and what you deliberately excluded.

# Core Problem
A one-sentence statement of the real problem to solve.

# Key Constraints
- The concrete constraints that shape acceptable solutions.

# Downstream Symptoms
1. First observable symptom of the problem.
2. Second observable symptom.
(3 to 6 numbered, concrete, observable symptoms. Downstream agents score symptom coverage against exactly this list, so include every symptom the user reported or that necessarily follows.)

# Success Criteria
- The signals that would make a solution successful.

Preserve domain-specific details. Remove incidental wording and emotional phrasing.
`;

const whyStepInstruction = `
You are the "why" step of a 5 Whys root-cause analysis loop.

Problem under analysis:
{core_problem}

Causal chain so far (JSON; empty on the first iteration):
{causal_chain?}

Do exactly one thing this turn:
1. Take the most recent "because" (or the Core Problem if the chain is empty) and ask WHY it happens.
2. Answer with the single most defensible direct cause.
3. Rate link_validity as an integer 1-5 (5 = direct verified mechanism, 1 = correlation dressed as cause) and justify the rating in that link's "reasoning" field.
4. Decide whether this cause is a terminal root cause: a process, design, or policy choice where asking "why" again would leave the problem domain.

Output ONLY a raw JSON object — no markdown fences, no prose before or after — containing the FULL chain (all previous links copied unchanged, plus exactly one new link):
{"chain":[{"why":"...","because":"...","link_validity":4,"reasoning":"..."}],"root_cause_reached":false}

If the new cause is a terminal root cause, set "root_cause_reached" to true and call the exit_loop tool.
Never add more than one new link per turn. Never modify previous links.
`;

const trizInstruction = `
You are BuildWithAI-TRIZ, an engineering problem solver specialized in TRIZ (Theory of Inventive Problem Solving).

Extracted problem (includes the numbered Downstream Symptoms list):
{core_problem}

Validated causal chain from the 5 Whys loop (JSON):
{causal_chain}

Work in this order:
1. Identify the core technical contradiction behind the root cause: the improving parameter versus the worsening or preserved parameter.
2. Query the TRIZ MCP tools before writing candidates: call search_parameter to find engineering parameter IDs, then browse_contradiction_matrix with the improving and preserving IDs, then get_principle_by_id or search_principle for details. Never pretend a tool succeeded when it failed.
3. Generate 3 to 5 candidate solutions. Each candidate acts on one specific link of the causal chain: intervention_index is the 0-based index into the chain (0 = surface symptom link, last index = root cause link).

Output format — first the reasoning section:
# Reasoning
3-6 sentences: which contradiction you chose and why, which principles the matrix suggested, and why you picked these intervention points.

Then a fenced json code block containing ONLY the candidate array:
\`\`\`json
[
  {
    "id": "c1",
    "title": "concise title",
    "summary": "2-3 sentence concrete implementation idea",
    "causal_chain": [exact copy of the chain links from the 5 Whys JSON],
    "intervention_index": 1,
    "rcd": 4,
    "ccv": 4,
    "triz": {"benefit": 4, "cost": 2, "harm": 1, "contradiction_resolution": 4},
    "downstream_symptoms_total": 3,
    "downstream_symptoms_resolved": 2,
    "feasibility": {"buildable_48h": true, "deployable": true},
    "contradiction_sentence": "One sentence naming the contradiction this candidate resolves.",
    "principles_used": ["#1 Segmentation"],
    "reasoning": "Why these scores and this intervention point."
  }
]
\`\`\`

Scoring discipline (all integers 1-5):
- rcd: how deep the fix bites into the chain (5 = acts on the terminal root cause).
- ccv: MUST equal the minimum link_validity across the causal chain.
- benefit, cost, harm: practical magnitudes for this problem context.
- contradiction_resolution: 1 = mere trade-off, 5 = contradiction fully dissolved.
- downstream_symptoms_total: MUST equal the number of items in the extractor's Downstream Symptoms list; downstream_symptoms_resolved counts how many of those this candidate eliminates.
- feasibility.buildable_48h: a working prototype fits in 48 hours; feasibility.deployable: usable in the target operational environment.
`;

const problemExtractorAgent = new LlmAgent({
  name: 'problem_extractor',
  model,
  instruction: problemExtractorInstruction,
  outputKey: 'core_problem',
});

const whyStepAgent = new LlmAgent({
  name: 'why_step',
  model,
  instruction: whyStepInstruction,
  tools: [EXIT_LOOP],
  outputKey: 'causal_chain',
});

const fiveYAgent = new LoopAgent({
  name: 'fiveY',
  maxIterations: 5,
  subAgents: [whyStepAgent],
});

const trizAgent = new LlmAgent({
  name: 'triz_solver',
  model,
  instruction: trizInstruction,
  tools: [trizToolset],
  outputKey: 'candidate_records',
});

export const rootAgent = new SequentialAgent({
  name: 'root_agent',
  subAgents: [problemExtractorAgent, fiveYAgent, trizAgent],
});
````

Notes for the implementer:
- `{causal_chain?}` (trailing `?`) is ADK's optional-state syntax — it resolves to an empty string on the first loop iteration instead of throwing (verified in `@google/adk` 1.3 `agents/instructions.js`).
- Literal braces in the JSON examples are safe: ADK only substitutes `{...}` whose inner text is a valid state name; `{"id": "c1"...}` is left untouched.
- `five_ways_solver`, `solution_evaluator`, and `ParallelAgent` are gone on purpose — scoring/selection now happens deterministically in the API.

- [ ] **Step 2: Boot-check the agent server**

```bash
cd adg-agents && npx adk api_server agent.ts --port 8082 &
sleep 8
curl -s http://localhost:8082/list-apps
kill %1
```

Expected: `["agent"]` (server builds the agent tree without import/type errors). If `list-apps` errors, read the server log — the usual cause is a typo in an import or agent config key.

- [ ] **Step 3: Commit**

```bash
git add solution-system/adg-agents/agent.ts
git commit -m "feat(agents): fiveY 5-Whys LoopAgent and TRIZ candidate-record pipeline"
```

---

### Task 10: Frontend type mirror

**Files:**
- Modify: `apps/frontend/src/app/chat/chat.types.ts`

**Interfaces:**
- Consumes: shape of `AgentTrace` (Task 1) and `ChatMessageDto.trace?` (Task 8) — mirrored manually, matching the existing convention of duplicating API DTOs in this file.
- Produces: `ChatMessage.trace?: AgentTrace` for future plane/trace UI. No component changes.

- [ ] **Step 1: Append trace types and extend ChatMessage**

Append to `apps/frontend/src/app/chat/chat.types.ts`:

```ts
export type TraceStepType = 'model_output' | 'tool_call' | 'tool_response';

export interface TraceStep {
  index: number;
  agent: string;
  type: TraceStepType;
  content: string;
  reasoning?: string;
  toolName?: string;
  timestamp?: number;
  invocationId?: string;
  iteration?: number;
}

export interface CausalLink {
  why: string;
  because: string;
  link_validity: number;
  reasoning?: string;
}

export interface TrizScores {
  benefit: number;
  cost: number;
  harm: number;
  contradiction_resolution: number;
}

export interface Feasibility {
  buildable_48h: boolean;
  deployable: boolean;
}

export interface CandidateRecord {
  id: string;
  title: string;
  summary: string;
  causal_chain: CausalLink[];
  intervention_index: number;
  rcd: number;
  ccv: number;
  triz: TrizScores;
  downstream_symptoms_total: number;
  downstream_symptoms_resolved: number;
  feasibility: Feasibility;
  contradiction_sentence: string;
  principles_used?: string[];
  reasoning?: string;
}

export interface ScoredCandidate {
  record: CandidateRecord;
  x: number;
  y: number;
  dc: number;
  ccvComputed: number;
  feasible: boolean;
  onFrontier: boolean;
  passesGates: boolean;
}

export interface EvaluationResult {
  gateX: number;
  gateY: number;
  candidates: ScoredCandidate[];
  frontierIds: string[];
  gatedIds: string[];
  winnerId: string | null;
  verdict: string;
}

export interface ConformanceCheck {
  id: string;
  agent: string;
  passed: boolean;
  details: string;
}

export interface AgentTrace {
  steps: TraceStep[];
  causalChain: CausalLink[] | null;
  candidates: ScoredCandidate[];
  evaluation: EvaluationResult | null;
  checks: ConformanceCheck[];
}
```

and extend the existing `ChatMessage` interface with:

```ts
  trace?: AgentTrace;
```

- [ ] **Step 2: Build the frontend to verify types compile**

Run: `npx nx build frontend`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add solution-system/apps/frontend/src/app/chat/chat.types.ts
git commit -m "feat(frontend): mirror agent trace types for future rendering"
```

---

### Task 11: Manual end-to-end verification

**Files:** none (verification only). Precondition: `.env` with a valid `GOOGLE_API_KEY` (see `.env.example`).

- [ ] **Step 1: Start the stack**

```bash
cd solution-system && docker-compose up --build -d
docker-compose ps
```

Expected: `postgres`, `mcp-server`, `adk-agent`, `api` (and `frontend`) all `Up`.

- [ ] **Step 2: Run a traced agent call**

```bash
curl -s -X POST http://localhost:3000/api/agent/messages \
  -H 'Content-Type: application/json' \
  -d '{"message":"Our ballast water intake filters clog within days in sediment-heavy ports; cleaning needs divers and the pumps cavitate. We can only retrofit existing vessels."}' \
  > /tmp/trace-run.json
jq '{text: .text[0:200], steps: [.trace.steps[] | {agent, type, iteration, toolName}], checks: .trace.checks, winner: .trace.evaluation.winnerId, verdict: .trace.evaluation.verdict}' /tmp/trace-run.json
```

Verify by inspection:
1. `steps` contains `problem_extractor` output, 1–5 `why_step` iterations with increasing `iteration`, `triz_solver` `tool_call`/`tool_response` pairs, and a final `triz_solver` output.
2. Every step that is a `model_output` has non-empty `reasoning` (spot-check `jq '.trace.steps[0].reasoning'`).
3. `checks` — ideally all `passed: true`; failed checks with sensible `details` are acceptable output (that is the evaluation data), crashes are not.
4. `text` starts with `# Decision` (or `# Evaluation Unavailable` with an explanation if the model misbehaved — rerun once if so).

- [ ] **Step 3: Verify chat flow persistence**

```bash
CHAT_ID=$(curl -s -X POST http://localhost:3000/api/chats | jq '.id')
curl -s -X POST "http://localhost:3000/api/chats/$CHAT_ID/messages" \
  -H 'Content-Type: application/json' \
  -d '{"message":"Same filter clogging problem — what should we build?"}' | jq '.messages[1].trace.evaluation.verdict'
docker-compose exec -T postgres psql -U postgres -d solution_system \
  -c "select id, role, (trace is not null) as has_trace from chat_messages order by id desc limit 2;"
```

Expected: verdict string printed; DB shows the assistant row with `has_trace = t`, user row `has_trace = f`.

- [ ] **Step 4: Record results**

Note any failed conformance checks and rough why-loop lengths in the PR/summary — that is the first real "are the agents making the right moves" data point.

---

## Self-Review (completed)

- **Spec coverage:** trace steps w/ reasoning (T1/T4), fiveY loop (T9), candidate records (T9/T2), engine formulas + selection (T2/T3), conformance (T5), deterministic report (T6), API integration + degradation (T7), persistence + DTO + `sync alter` (T8), frontend mirror (T10), manual e2e (T11). Non-goals untouched.
- **Placeholder scan:** none — every step has full code/commands.
- **Type consistency:** `runTracedMessage`, `parseRun`/`ParsedRun`, `parseCandidateRecords`, `scoreCandidate`, `selectWinner`, `runChecks`, `renderReport`, `AgentTrace` names match across Tasks 2–8; agent/state names match Task 4 constants and Task 9 pipeline.
