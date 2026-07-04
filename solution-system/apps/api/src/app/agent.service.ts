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
  topCandidatesBySource,
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
    const topTrizCandidates = topCandidatesBySource(candidates, 'triz');
    const topFiveYCandidates = topCandidatesBySource(candidates, 'fiveY');
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
      trace: {
        steps: run.steps,
        causalChain: chain,
        candidates,
        topTrizCandidates,
        topFiveYCandidates,
        evaluation,
        checks,
      },
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
