import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
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
import { correlationStorage } from './logging/correlation-storage';

interface AdkSessionResponse {
  id?: string;
  sessionId?: string;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly adkAgentUrl =
    process.env.ADK_AGENT_URL ?? 'http://localhost:8081';

  private getTraceHeaders(): Record<string, string> {
    const correlationId = correlationStorage.getStore();
    return correlationId ? { 'x-correlation-id': correlationId } : {};
  }

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
    this.logger.log(`Starting non-streamed agent run for session: ${sessionId}`);
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

    this.logger.log(`Non-streamed agent run completed. Candidates count: ${candidates.length}`);

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
    this.logger.log('Creating new ADK agent session...');
    try {
      const response = await axios.post<AdkSessionResponse>(
        `${this.adkAgentUrl}/apps/agent/users/user/sessions`,
        {},
        {
          headers: this.getTraceHeaders(),
        },
      );
      const sessionId = response.data.id ?? response.data.sessionId;

      if (!sessionId) {
        throw new Error('ADK session response did not include a session id.');
      }

      this.logger.log(`Successfully created ADK session: ${sessionId}`);
      return sessionId;
    } catch (error: any) {
      this.logger.error(`Failed to create ADK session: ${error.message}`);
      throw new BadGatewayException('Unable to create an ADK session.');
    }
  }

  async runAgent(sessionId: string, message: string): Promise<string> {
    this.logger.log(`Executing ADK agent runner for session: ${sessionId}`);
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
            ...this.getTraceHeaders(),
          },
          responseType: 'text',
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`ADK agent run execution failed: ${error.message}`);
      throw new BadGatewayException('Unable to run the ADK agent.');
    }
  }

  async runAgentStream(sessionId: string, message: string): Promise<any> {
    this.logger.log(`Initiating streaming ADK agent run for session: ${sessionId}`);
    try {
      const response = await axios.post<any>(
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
            ...this.getTraceHeaders(),
          },
          responseType: 'stream',
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`ADK agent stream initiation failed: ${error.message}`);
      throw new BadGatewayException('Unable to run the ADK agent.');
    }
  }
}

