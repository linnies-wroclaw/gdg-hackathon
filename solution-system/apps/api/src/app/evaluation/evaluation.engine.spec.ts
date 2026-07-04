import {
  CandidateRecord,
  CausalLink,
  ScoredCandidate,
} from '../trace/trace.types';
import {
  computeCcv,
  parseCandidateRecords,
  scoreCandidate,
  selectWinner,
  topCandidatesBySource,
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
  source: 'triz',
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
    const scored = scoreCandidate(record({ ccv: 5 }), chain);
    expect(scored.ccvComputed).toBe(3);
    expect(scored.x).toBeCloseTo(45.8333, 3);
  });

  it('computes Y from ideality and contradiction resolution', () => {
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
    const weakChain: CausalLink[] = [
      { why: 'w', because: 'b', link_validity: 1 },
    ];
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
        record({
          downstream_symptoms_total: 0,
          downstream_symptoms_resolved: 0,
        }),
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

describe('topCandidatesBySource', () => {
  const scored = (
    id: string,
    source: 'triz' | 'fiveY',
    x: number,
    y: number,
    dc = 0.5,
  ): ScoredCandidate => ({
    record: record({ id, title: id, source }),
    x,
    y,
    dc,
    ccvComputed: 3,
    feasible: true,
    onFrontier: false,
    passesGates: false,
  });

  it('returns the top three candidates per source by X then Y then dc', () => {
    const candidates = [
      scored('triz-low', 'triz', 40, 90),
      scored('triz-1', 'triz', 90, 60),
      scored('triz-2', 'triz', 80, 70),
      scored('triz-3', 'triz', 70, 80),
      scored('triz-4', 'triz', 60, 90),
      scored('fiveY-1', 'fiveY', 85, 65),
      scored('fiveY-2', 'fiveY', 75, 75),
      scored('fiveY-3', 'fiveY', 75, 70, 0.9),
      scored('fiveY-4', 'fiveY', 30, 95),
    ];

    expect(topCandidatesBySource(candidates, 'triz').map((candidate) => candidate.record.id)).toEqual([
      'triz-1',
      'triz-2',
      'triz-3',
    ]);
    expect(topCandidatesBySource(candidates, 'fiveY').map((candidate) => candidate.record.id)).toEqual([
      'fiveY-1',
      'fiveY-2',
      'fiveY-3',
    ]);
  });
});

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
    const c = scored('c', 60, 60);

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
