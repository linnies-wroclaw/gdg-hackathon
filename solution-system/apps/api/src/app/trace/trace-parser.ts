import { BadGatewayException } from '@nestjs/common';
import { CausalLink, TraceStep, TraceStepType } from './trace.types';

export const EXTRACTOR_AGENT = 'problem_extractor';
export const WHY_AGENT = 'why_step';
export const TRIZ_AGENT = 'triz_solver';
export const FIVEY_SOLVER_AGENT = 'fiveY_solver';
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

    if (event.author === TRIZ_AGENT || event.author === FIVEY_SOLVER_AGENT) {
      const json = extractJson(text);

      if (Array.isArray(json)) {
        run.candidateRecordsRaw = mergeCandidateRecords(
          run.candidateRecordsRaw,
          json,
        );
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
      run.candidateRecordsRaw = mergeCandidateRecords(
        run.candidateRecordsRaw,
        json,
      );
    }
  }

  const fiveYCandidateRecords = delta['fiveY_candidate_records'];

  if (typeof fiveYCandidateRecords === 'string') {
    const json = extractJson(fiveYCandidateRecords);

    if (json !== null) {
      run.candidateRecordsRaw = mergeCandidateRecords(
        run.candidateRecordsRaw,
        json,
      );
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

function candidateRecordsArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function mergeCandidateRecords(existing: unknown, incoming: unknown): unknown[] {
  const merged = [...candidateRecordsArray(existing)];

  for (const record of candidateRecordsArray(incoming)) {
    const id =
      record && typeof record === 'object' && 'id' in record
        ? String(record.id)
        : null;
    const exists =
      id !== null &&
      merged.some(
        (candidate) =>
          candidate &&
          typeof candidate === 'object' &&
          'id' in candidate &&
          String(candidate.id) === id,
      );

    if (!exists) {
      merged.push(record);
    }
  }

  return merged;
}
