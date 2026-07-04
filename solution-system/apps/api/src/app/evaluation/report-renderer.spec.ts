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
    source: 'triz',
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
    expect(report).toContain('<- intervention point');
    expect(report).toContain('| c2 | Candidate c2 |');
  });

  it('renders the verdict without a winner section when gates fail', () => {
    const report = renderReport(evaluation(null), chain);

    expect(report).toContain('No candidate clears both gates.');
    expect(report).not.toContain('## Winner:');
    expect(report).toContain('## Candidate plane');
  });

  it('renders a failure explanation when evaluation is unavailable', () => {
    const report = renderReport(
      null,
      null,
      'Evaluation unavailable: no valid causal chain.',
    );

    expect(report).toContain('# Evaluation Unavailable');
    expect(report).toContain('no valid causal chain');
  });
});
