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

const chainDoc1 = JSON.stringify({
  chain: [
    {
      why: 'Why clog?',
      because: 'Sediment overload.',
      link_validity: 4,
      reasoning: 'Measured.',
    },
  ],
  root_cause_reached: false,
});

const chainDoc2 = JSON.stringify({
  chain: [
    {
      why: 'Why clog?',
      because: 'Sediment overload.',
      link_validity: 4,
      reasoning: 'Measured.',
    },
    {
      why: 'Why overload?',
      because: 'Intake at sediment peak depth.',
      link_validity: 4,
      reasoning: 'Surveys.',
    },
  ],
  root_cause_reached: true,
});

const candidateRecord = (id: string) => ({
  id,
  title: `Candidate ${id}`,
  summary: `Summary ${id}`,
  causal_chain: JSON.parse(chainDoc2).chain,
  intervention_index: 1,
  rcd: id.startsWith('fy') ? 3 : 4,
  ccv: 4,
  triz: { benefit: 4, cost: 1, harm: 1, contradiction_resolution: 4 },
  downstream_symptoms_total: 3,
  downstream_symptoms_resolved: 2,
  feasibility: { buildable_48h: true, deployable: true },
  contradiction_sentence: `Contradiction for ${id}.`,
  source: id.startsWith('fy') ? 'fiveY' : 'triz',
});

const trizText = [
  '# Reasoning',
  'Matrix pointed to segmentation.',
  '',
  '```json',
  JSON.stringify([
    candidateRecord('c1'),
    candidateRecord('c2'),
    candidateRecord('c3'),
  ]),
  '```',
].join('\n');

const fiveYText = [
  '# Reasoning',
  'The causal chain points to practical root-cause interventions.',
  '',
  '```json',
  JSON.stringify([
    candidateRecord('fy1'),
    candidateRecord('fy2'),
    candidateRecord('fy3'),
  ]),
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
    content: { parts: [{ text: chainDoc1 }] },
    actions: { stateDelta: { causal_chain: chainDoc1 } },
  },
  {
    author: 'why_step',
    invocationId: 'inv-1',
    timestamp: 3,
    content: {
      parts: [{ text: chainDoc2 }, { functionCall: { name: 'exit_loop', args: {} } }],
    },
    actions: { stateDelta: { causal_chain: chainDoc2 } },
  },
  {
    author: 'triz_solver',
    invocationId: 'inv-1',
    timestamp: 4,
    content: {
      parts: [{ functionCall: { name: 'search_parameter', args: { query: 'flow' } } }],
    },
  },
  {
    author: 'triz_solver',
    invocationId: 'inv-1',
    timestamp: 5,
    content: {
      parts: [{ functionResponse: { name: 'search_parameter', response: { matches: [13] } } }],
    },
  },
  {
    author: 'fiveY_solver',
    invocationId: 'inv-1',
    timestamp: 6,
    content: { parts: [{ text: fiveYText }] },
    actions: { stateDelta: { fiveY_candidate_records: fiveYText } },
  },
  {
    author: 'triz_solver',
    invocationId: 'inv-1',
    timestamp: 7,
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
    expect(response.trace.steps.length).toBe(8);
    expect(response.trace.causalChain).toHaveLength(2);
    expect(response.trace.candidates).toHaveLength(6);
    expect(response.trace.topTrizCandidates).toHaveLength(3);
    expect(response.trace.topFiveYCandidates).toHaveLength(3);
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
