import {
  CandidateRecord,
  CandidateSource,
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
  const x = (((record.rcd * ccvComputed) - 1) / 24) * 100;
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

export function topCandidatesBySource(
  scored: ScoredCandidate[],
  source: CandidateSource,
): ScoredCandidate[] {
  return scored
    .filter((candidate) => candidate.record.source === source)
    .sort((a, b) => b.x - a.x || b.y - a.y || b.dc - a.dc)
    .slice(0, 3);
}

function isCandidateRecord(value: unknown): value is CandidateRecord {
  const record = value as CandidateRecord;

  return Boolean(
    record &&
      typeof record === 'object' &&
      typeof record.id === 'string' &&
      typeof record.title === 'string' &&
      typeof record.summary === 'string' &&
      (record.source === 'triz' || record.source === 'fiveY') &&
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

function dominates(a: ScoredCandidate, b: ScoredCandidate): boolean {
  return a.x >= b.x && a.y >= b.y && (a.x > b.x || a.y > b.y);
}

function pickByXThenDc(candidates: ScoredCandidate[]): ScoredCandidate {
  return [...candidates].sort((a, b) => b.x - a.x || b.dc - a.dc)[0];
}
