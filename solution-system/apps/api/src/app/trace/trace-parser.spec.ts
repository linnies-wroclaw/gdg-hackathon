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
  source: 'triz',
  principles_used: ['#1 Segmentation'],
  reasoning: 'Acts on the root link with a matrix-backed principle.',
});

const trizText = [
  '# Reasoning',
  'The matrix suggested segmentation for the depth vs sediment contradiction.',
  '',
  '```json',
  JSON.stringify([
    candidateRecord('c1'),
    candidateRecord('c2'),
    candidateRecord('c3'),
  ]),
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
