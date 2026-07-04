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
  const trizCount = records.filter((record) => record.source === 'triz').length;
  const fiveYCount = records.filter((record) => record.source === 'fiveY').length;
  const sourceCountsInRange =
    trizCount >= MIN_CANDIDATES &&
    trizCount <= MAX_CANDIDATES &&
    (fiveYCount === 0 ||
      (fiveYCount >= MIN_CANDIDATES && fiveYCount <= MAX_CANDIDATES));
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
      sourceCountsInRange,
      `${trizCount} TRIZ and ${fiveYCount} Five-Whys candidates (target ${MIN_CANDIDATES}-${MAX_CANDIDATES} per source)`,
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
