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
  source: 'triz',
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
    const checks = runChecks(baseRun(), [
      record(),
      record({ id: 'c2' }),
      record({ id: 'c3' }),
    ]);

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
    run.steps = [trizToolCall];
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
    run.steps = [whyStep(1), whyStep(2)];

    const checks = runChecks(run, [
      record({ ccv: 5, intervention_index: 7, downstream_symptoms_total: 9 }),
    ]);

    expect(byId(checks, 'triz.mcp_tool_used').passed).toBe(false);
    expect(byId(checks, 'triz.candidate_count_in_range').passed).toBe(false);
    expect(byId(checks, 'triz.ccv_matches_chain').passed).toBe(false);
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
