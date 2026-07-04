# Traceable Agent Pipeline with Deterministic TRIZ × 5-Whys XY Evaluation — Design

Date: 2026-07-04
Status: Draft for review
Scope: `solution-system` (adg-agents, apps/api, apps/frontend)

## 1. Context

The Maritime R&D Assistant currently runs an ADK JS (`@google/adk` 1.3) pipeline served by
`adk api_server` on :8081:

```
problem_extractor → ParallelAgent(triz_solver + MCP tools, five_ways_solver) → solution_evaluator (LLM)
```

The NestJS API (`apps/api`) calls `POST /run_sse`, receives the full SSE event stream —
which already contains every agent's outputs, tool calls, and tool responses — and then
**discards everything except the last text** (`AgentService.extractModelText`). Chats and
messages are persisted in Postgres (Sequelize, `synchronize: true`).

Three problems this design fixes:

1. **No traceability.** Intermediate agent steps are thrown away, so there is no data to
   evaluate whether agents "make the right moves".
2. **Wrong second solver.** `five_ways_solver` (five solution angles) does not match the
   product intent: the agent is **fiveY — a 5 Whys root-cause loop** that asks one "why"
   per iteration and produces an explicit causal chain.
3. **LLM-judged evaluation.** The final ranking is an LLM opinion. The product spec
   requires a **deterministic TRIZ × 5-Whys evaluation engine** on two orthogonal axes
   (X = targeting, Y = quality) with fixed gates and a Pareto-based selection — pure
   functions, never an LLM's arithmetic.

This partially supersedes the "parallel candidate generation + deep evaluation" flow in
`docs/agent_workflow.md` for Release 1: candidate generation stays in TRIZ, but scoring
and selection become deterministic code.

## 2. Goals

1. **Trace every step of every agent**: an ordered `steps[]` array capturing what each
   agent did *and why* (explicit reasoning), including tool calls/responses and timestamps.
2. **fiveY loop**: internal `LoopAgent` asking exactly one "why" per iteration (max 5),
   emitting `{ why, because, link_validity }` links, exiting when a terminal root cause is
   reached.
3. **Structured candidate records**: TRIZ agent emits machine-readable candidate records
   (exact schema below) bound to causal-chain links.
4. **Deterministic XY engine** in the API: exact formulas, Pareto frontier, fixed 60/60
   gates, exact selection order and verdicts.
5. **Conformance checks per run**: cheap deterministic verdicts on agent behavior
   (loop discipline, tool usage, record validity) stored with the trace.
6. **Persist and expose**: trace stored with the assistant message and returned to the
   frontend (no UI rendering yet).

## 3. Non-Goals

- Frontend visualization of the decision plane (data is returned, display comes later).
- Cross-run aggregate evaluation endpoints (pass rates per agent across runs).
- Release 2/3 features (interactive clarification loop, dynamic tool routing, export).
- Token-level streaming to the frontend.

## 4. Architecture Overview

```
User → API POST /chats/:id/messages
         │
         ▼
   AgentService ── POST /run_sse ──► ADK api_server (adg-agents)
         │                             SequentialAgent:
         │                               1. problem_extractor   → state.core_problem
         │                               2. fiveY (LoopAgent≤5) → state.causal_chain
         │                                    └ why_step (+ exit_loop tool)
         │                               3. triz_solver (+MCP)  → state.candidate_records
         │   SSE event stream (ALL events)
         ▼
   TraceParser        → steps[] (what + why, tool calls, timestamps)
   EvaluationEngine   → scored candidates, frontier, gates, winner, verdict
   ConformanceChecks  → checks[]
   ReportRenderer     → final assistant text (deterministic)
         │
         ├─► Postgres: chat_messages.trace (JSONB) on the assistant message
         ▼
   Response DTO: { text, trace: { steps, causalChain, candidates, evaluation, checks } }
```

The LLM pipeline **produces data**; the API **computes the decision**. No LLM output is
trusted for arithmetic: derived values are recomputed, and agent-claimed values are only
cross-checked (conformance).

## 5. Agent Pipeline (`adg-agents/agent.ts`)

Root agent becomes fully sequential — TRIZ needs the causal chain so candidates can bind
to chain links (`intervention_index`), matching the product pipeline order (5 Whys before
TRIZ). `ParallelAgent`, `five_ways_solver`, and `solution_evaluator` are removed.

Every LLM agent's output **starts with a `# Reasoning` section** (why it framed/chose
things this way). The TraceParser extracts it into the step's `reasoning` field and strips
it from user-facing content.

### 5.1 problem_extractor (kept, extended)

Output contract:

```
# Reasoning
Why the problem was framed this way (2-4 sentences).

# Core Problem
One sentence.

# Key Constraints
- ...

# Downstream Symptoms
1. <observable symptom>
2. ...

# Success Criteria
- ...
```

`# Downstream Symptoms` is new: a single shared, numbered list of observable symptoms of
the problem. It fixes `downstream_symptoms_total` for **all** candidates, making the
symptom-coverage ratio `dc` comparable across candidates (each candidate then reports how
many of *these* symptoms it resolves). `outputKey: 'core_problem'` (whole document).

### 5.2 fiveY (new: LoopAgent, maxIterations: 5)

```ts
const whyStepAgent = new LlmAgent({
  name: 'why_step',
  outputKey: 'causal_chain',
  tools: [EXIT_LOOP],           // built-in ExitLoopTool instance exported by @google/adk
  ...
});
const fiveYAgent = new LoopAgent({ name: 'fiveY', maxIterations: 5, subAgents: [whyStepAgent] });
```

Each iteration, `why_step`:
1. Reads `{core_problem}` and the chain so far (`{causal_chain?}`).
2. Asks **exactly one** next "why" about the most recent "because" (or the core problem on
   iteration 1) and answers it.
3. Emits the **full chain so far** as fenced JSON (last write wins in state):

```json
{
  "chain": [
    { "why": "...", "because": "...", "link_validity": 4, "reasoning": "why this link and this validity score" }
  ],
  "root_cause_reached": false
}
```

4. If the latest "because" is a terminal root cause (process/design/policy level — asking
   "why" again would leave the problem domain), sets `root_cause_reached: true` and calls
   `exit_loop`. Otherwise the loop continues (hard stop at 5 iterations).

`link_validity` (1–5) states how defensible the causal link is (5 = direct verified
mechanism, 1 = correlation dressed as cause). Each iteration is a **separate traced step**,
satisfying "an internal loop asking each time a question why".

### 5.3 triz_solver (kept, reworked output)

Input: `{core_problem}` (incl. symptoms) and `{causal_chain}`. Keeps the MCP toolset and
current tool-usage guidance (search_parameter → browse_contradiction_matrix →
principle lookups). New responsibilities:

1. Identify the **core contradiction** behind the root cause.
2. Generate **3–5 candidates**, each acting on a specific chain link.
3. Emit `# Reasoning`, then a fenced JSON array of candidate records,
   `outputKey: 'candidate_records'`.

### 5.4 Candidate record schema

Exactly the product spec's record, plus three authoring fields (`contradiction_sentence`
— needed for the final output's "one sentence naming the contradiction it resolves",
`principles_used`, `reasoning`):

```jsonc
{
  "id": "c1",
  "title": "string",
  "summary": "string",
  "causal_chain": [ { "why": "...", "because": "...", "link_validity": 4 } ], // copy of fiveY chain
  "intervention_index": 2,          // which chain link this fix acts on (0 = surface)
  "rcd": 4,                         // Root-Cause Depth 1-5 (5 = terminal root)
  "ccv": 3,                         // agent-claimed; engine RECOMPUTES as MIN(link_validity)
  "triz": { "benefit": 4, "cost": 2, "harm": 1, "contradiction_resolution": 4 },
  "downstream_symptoms_total": 4,   // MUST equal extractor's symptom count
  "downstream_symptoms_resolved": 3,
  "feasibility": { "buildable_48h": true, "deployable": true },
  "contradiction_sentence": "Resolves X vs Y by ...",
  "principles_used": ["#1 Segmentation"],
  "reasoning": "why these scores and this intervention point"
}
```

## 6. TraceParser (`apps/api/src/app/trace/`)

Replaces the "take last text" logic. Parses the SSE text into ADK events, then into:

```ts
export type TraceStepType = 'model_output' | 'tool_call' | 'tool_response';

export interface TraceStep {
  index: number;              // global order
  agent: string;              // event author: problem_extractor | why_step | triz_solver ...
  type: TraceStepType;
  reasoning?: string;         // extracted "# Reasoning" section (model_output only)
  content: string;            // remaining text, or JSON string of tool args/response
  toolName?: string;          // tool_call / tool_response
  timestamp?: number;         // from ADK event
  invocationId?: string;
  iteration?: number;         // for why_step: 1-based loop iteration (ordinal of its outputs)
}
```

Rules:
- One ADK event may yield several steps (a part with text + a part with functionCall).
- `# Reasoning` extraction: from the heading to the next `#` heading; stripped from `content`.
- State values (`core_problem`, `causal_chain`, `candidate_records`) are read from event
  `actions.stateDelta` when present, with fenced-JSON text parsing as fallback.
- Events with `errorCode`/`errorMessage` still throw `BadGatewayException` (unchanged).
- Malformed JSON lines are skipped (unchanged).
- The final user answer no longer comes from the stream — it is rendered by the engine.

## 7. EvaluationEngine (`apps/api/src/app/evaluation/`)

Pure TypeScript, exported as plain functions (wrapped by an injectable for Nest DI), fully
unit-testable without ADK.

### 7.1 Derived metrics (exact; recomputed, never trusted)

```
ccv           = MIN(link_validity over final causal chain)        // 1..5
X_targeting   = ((rcd * ccv) - 1) / 24 * 100                      // 0..100
ideality_raw  = benefit / (cost + harm)                           // 0.1..2.5 given 1..5 ints
ideality_norm = (ideality_raw - 0.1) / 2.4 * 100                  // 0..100
Y_quality     = ideality_norm * (contradiction_resolution / 5)    // 0..100
dc            = downstream_symptoms_resolved / downstream_symptoms_total  // 0..1; total=0 → dc=0 + failed check
feasible      = buildable_48h AND deployable
```

Hard rules preserved: `ccv` uses MIN, not average (weakest link poisons the chain);
`contradiction_resolution` multiplies Y (a mere trade-off is discounted, not rewarded).
Out-of-range inputs are **not clamped** — the candidate is scored as-is and a conformance
check fails (we want to *see* agent misbehavior, not mask it).

### 7.2 Selection algorithm (exact order)

```
1. eligible = candidates where feasible == true
2. frontier = Pareto-non-dominated subset of eligible on (X, Y)
              (A dominates B iff A.X >= B.X AND A.Y >= B.Y AND (A.X > B.X OR A.Y > B.Y))
3. gated    = frontier where X >= 60 AND Y >= 60
4. gated empty  → verdict: "No candidate clears both gates. Strongest frontier point: <id>."
                  (strongest = max X, tie-break max dc; if eligible itself is empty →
                   "No feasible candidate (none is buildable in 48h and deployable).")
5. one gated    → winner
6. several      → winner = max X_targeting; tie-break: max dc
```

Gates are fixed constants `GATE_X = 60`, `GATE_Y = 60` — not configurable via env or
request ("never move the lines").

### 7.3 Output types

```ts
export interface ScoredCandidate {
  record: CandidateRecord;
  x: number; y: number; dc: number;
  ccvComputed: number;
  feasible: boolean;
  onFrontier: boolean;
  passesGates: boolean;
}

export interface EvaluationResult {
  gateX: number; gateY: number;
  candidates: ScoredCandidate[];      // all, with coordinates → future plane rendering
  frontierIds: string[];
  gatedIds: string[];
  winnerId: string | null;
  verdict: string;                    // human-readable selection outcome
}
```

### 7.4 ReportRenderer

Deterministic markdown for the assistant message: winner id/title + coordinates, the
causal chain it acts on (with the intervention link marked), its contradiction sentence,
then a compact table of all candidates (id, X, Y, dc, feasible, frontier, gates) and the
verdict path. On evaluation failure (§10) it renders the failure verdict instead.

## 8. Conformance Checks (`checks[]`)

Shape: `{ id: string; agent: string; passed: boolean; details: string }`. Initial set:

| id | verifies |
|---|---|
| `fiveY.iterations_in_range` | 1–5 why_step iterations ran |
| `fiveY.one_why_per_iteration` | each iteration added exactly one link to the chain |
| `fiveY.link_validity_in_range` | all link_validity values are integers 1–5 |
| `fiveY.exit_reason_recorded` | loop ended via `root_cause_reached`+exit_loop or maxIterations, and which |
| `triz.mcp_tool_used` | ≥1 MCP tool call happened before candidates were emitted |
| `triz.candidates_parse` | candidate JSON parsed successfully |
| `triz.candidate_count_in_range` | 3–5 candidates |
| `triz.fields_in_range` | all record scores in declared ranges, required fields present |
| `triz.ccv_matches_chain` | agent-claimed ccv == MIN(link_validity) of final chain |
| `triz.intervention_index_in_bounds` | 0 ≤ intervention_index < chain length |
| `triz.symptoms_total_consistent` | downstream_symptoms_total == extractor's symptom count, same for all candidates |
| `extractor.symptoms_listed` | extractor produced a non-empty symptom list |

Checks are *recorded*, not enforced — a failed check never blocks the response; it is the
evaluation data ("is fiveY asking one why per iteration?", "is TRIZ using the matrix?").

## 9. API, Persistence, Frontend

### 9.1 Trace payload (returned + stored)

```ts
export interface AgentTrace {
  steps: TraceStep[];
  causalChain: CausalLink[];          // final chain from fiveY
  candidates: ScoredCandidate[];
  evaluation: EvaluationResult | null; // null when evaluation could not run (§10)
  checks: ConformanceCheck[];
}
```

### 9.2 Changes

- `AgentService.sendMessage` → `{ sessionId, text, trace }`; internals split into
  transport (unchanged), `TraceParserService`, `EvaluationEngineService`, renderer.
- `agent.dto.ts` / `chat.dto.ts`: response DTOs gain `trace` (assistant `ChatMessageDto`
  gets optional `trace`); shared trace types live in `apps/api/src/app/trace/trace.types.ts`.
- `ChatMessage` model: new nullable `trace` column, `DataType.JSONB`
  (`synchronize: true` auto-adds it; existing rows keep `NULL` — acceptable for hackathon).
- `ChatService.sendMessage`: stores trace on the assistant message; response includes it.
- `apps/frontend/src/app/chat/chat.types.ts`: mirrors the trace types; `ChatMessage.trace?`.
  **No UI rendering this stage.**

## 10. Error Handling

| failure | behavior |
|---|---|
| ADK transport error / error event | `BadGatewayException` (unchanged) |
| stream contains no model output at all | `BadGatewayException` (unchanged) |
| causal chain missing/unparseable | trace kept; related checks fail; evaluation aborted with verdict "Evaluation unavailable: no valid causal chain." |
| candidate JSON unparseable / empty | trace kept; `triz.candidates_parse` fails; verdict "Evaluation unavailable: no valid candidate records." |
| no feasible candidate | evaluation runs; verdict per §7.2 step 4 |
| symptom total = 0 or missing | dc = 0 for all; check fails |

Principle: **transport failures throw; content failures degrade** — the run and its trace
are always preserved for evaluation, and the rendered text states what happened.

## 11. Testing

- `evaluation-engine.spec.ts` — hand-computed fixtures, e.g. `rcd=4, links=[4,3,5] → ccv=3,
  X=((4·3)−1)/24·100 = 45.83`; `benefit=4,cost=1,harm=1 → raw=2.0, norm=79.17, cr=4 →
  Y=63.33`; Pareto domination/non-domination cases; empty-gate verdict; strongest-frontier
  fallback; tie-breaks (max X, then max dc); infeasible filtering; total=0 dc guard.
- `trace-parser.spec.ts` — fixture SSE stream covering all three LLM authors
  (problem_extractor, why_step, triz_solver), loop iterations
  with `iteration` numbering, tool call/response pairing, `# Reasoning` extraction and
  stripping, stateDelta extraction, error-event propagation, malformed-line skipping.
- `conformance.spec.ts` — each check's pass and fail path.
- Updated `agent.service.spec.ts` / `chat.service.spec.ts` (new response shape, JSONB save).
- Manual e2e: `docker-compose up`, real prompt, inspect stored trace + rendered winner.

## 12. Decisions & Defaults (resolved)

- Reasoning source: instructed `# Reasoning` sections, not Gemini thinking traces (user choice).
- Engine home: pure TS in NestJS API (user choice).
- 5 Whys realized as a real `LoopAgent` (verified available in `@google/adk` 1.3 together
  with `ExitLoopTool`) so each "why" is a traced event — not a single-shot chain dump.
- Candidate count target 3–5 (checked, not enforced).
- Sequential pipeline (fiveY before TRIZ) — required by `intervention_index` binding.
- Old `/agent/messages` endpoint keeps working and gains the same trace payload.
