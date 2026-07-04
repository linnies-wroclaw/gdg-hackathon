import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import axios from 'axios';
import {
  SubmitProblemRequestDto,
  ReasoningTrailResponseDto,
  AgentMessageRequestDto,
  AgentMessageResponseDto,
} from './agent.dto';

interface AdkSessionResponse {
  id?: string;
  sessionId?: string;
}

interface AdkEventPart {
  text?: string;
}

interface AdkEvent {
  author?: string;
  errorCode?: string;
  errorMessage?: string;
  content?: {
    parts?: AdkEventPart[];
  };
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
    const eventStream = await this.runAgent(sessionId, message);

    return {
      sessionId,
      text: this.extractModelText(eventStream),
    };
  }

  async solveProblem(
    request: SubmitProblemRequestDto,
    onProgress?: (
      step: string,
      status: 'START' | 'COMPLETED' | 'FAILED',
      data?: any,
    ) => void,
  ): Promise<ReasoningTrailResponseDto> {
    const context = request.problemContext?.trim();
    if (!context) {
      throw new BadRequestException('Problem context is required.');
    }

    const sessionId = await this.createSession();

    // Step 1: Goal Extraction
    onProgress?.('GOAL_EXTRACTION', 'START');
    const step1Prompt = `
[SUB-TASK: GOAL_EXTRACTION]
Problem Context: ${context}
Domain Parameters: ${JSON.stringify(request.domainParameters || {})}
`;
    let step1: any;
    try {
      const step1Stream = await this.runAgent(sessionId, step1Prompt);
      const step1Text = this.extractModelText(step1Stream);
      step1 = JSON.parse(this.cleanJsonString(step1Text));
      onProgress?.('GOAL_EXTRACTION', 'COMPLETED', step1);
    } catch (e: any) {
      onProgress?.('GOAL_EXTRACTION', 'FAILED', { error: e.message || String(e) });
      throw e;
    }

    // Step 2: Contradiction Identification
    onProgress?.('CONTRADICTION_SOLVER', 'START');
    const step2Prompt = `
[SUB-TASK: CONTRADICTION_SOLVER]
Problem Context: ${context}
Domain Parameters: ${JSON.stringify(request.domainParameters || {})}
Goal: ${step1.parsedGoal}
`;
    let step2: any;
    try {
      const step2Stream = await this.runAgent(sessionId, step2Prompt);
      const step2Text = this.extractModelText(step2Stream);
      step2 = JSON.parse(this.cleanJsonString(step2Text));
      onProgress?.('CONTRADICTION_SOLVER', 'COMPLETED', step2);
    } catch (e: any) {
      onProgress?.('CONTRADICTION_SOLVER', 'FAILED', { error: e.message || String(e) });
      throw e;
    }

    // Step 3: Candidate Generation (Parallel)
    onProgress?.('CANDIDATE_GENERATION', 'START');
    const candidateTasks = [
      { id: 'candidate-1', category: 'SHORT_TERM_EASY' },
      { id: 'candidate-2', category: 'LONG_TERM_HIGH_IMPACT' },
      { id: 'candidate-3', category: 'LONG_TERM_HIGH_IMPACT' },
    ];

    let step3: any;
    let candidates: any[];
    try {
      const candidatePromises = candidateTasks.map(async (task) => {
        const candidatePrompt = `
[SUB-TASK: CANDIDATE_GENERATION]
Problem Context: ${context}
Domain Parameters: ${JSON.stringify(request.domainParameters || {})}
Contradiction: Improving: ${step2.keyContradiction.improvingParameter}, Worsening: ${step2.keyContradiction.worseningParameter}
Category: ${task.category}
Candidate ID: ${task.id}
`;
        const taskSessionId = await this.createSession();
        const stream = await this.runAgent(taskSessionId, candidatePrompt);
        const text = this.extractModelText(stream);
        try {
          const parsed = JSON.parse(this.cleanJsonString(text));
          parsed.candidateId = task.id; // Ensure consistent candidateId
          parsed.category = task.category; // Ensure consistent category
          return parsed;
        } catch (e) {
          throw new BadGatewayException(`Candidate generation parsing failed for ${task.id}. Raw: ${text}`);
        }
      });

      candidates = await Promise.all(candidatePromises);
      step3 = {
        stepId: 3 as const,
        status: 'COMPLETED' as const,
        candidates,
      };
      onProgress?.('CANDIDATE_GENERATION', 'COMPLETED', step3);
    } catch (e: any) {
      onProgress?.('CANDIDATE_GENERATION', 'FAILED', { error: e.message || String(e) });
      throw e;
    }

    // Step 4: Deep Evaluation
    onProgress?.('EVALUATION', 'START');
    const step4Prompt = `
[SUB-TASK: EVALUATION]
Problem Context: ${context}
Hard Constraints: ${JSON.stringify(request.hardConstraints || [])}
Domain Parameters: ${JSON.stringify(request.domainParameters || {})}
Candidates: ${JSON.stringify(candidates)}
`;
    let step4: any;
    try {
      const step4Stream = await this.runAgent(sessionId, step4Prompt);
      const step4Text = this.extractModelText(step4Stream);
      step4 = JSON.parse(this.cleanJsonString(step4Text));
      onProgress?.('EVALUATION', 'COMPLETED', step4);
    } catch (e: any) {
      onProgress?.('EVALUATION', 'FAILED', { error: e.message || String(e) });
      throw e;
    }

    // Step 5: Final Recommendation
    onProgress?.('FINAL_RECOMMENDATION', 'START');
    const step5Prompt = `
[SUB-TASK: FINAL_RECOMMENDATION]
Candidates: ${JSON.stringify(candidates)}
Evaluations: ${JSON.stringify(step4.evaluations)}
Hard Constraints: ${JSON.stringify(request.hardConstraints || [])}
`;
    let step5: any;
    try {
      const step5Stream = await this.runAgent(sessionId, step5Prompt);
      const step5Text = this.extractModelText(step5Stream);
      step5 = JSON.parse(this.cleanJsonString(step5Text));
      onProgress?.('FINAL_RECOMMENDATION', 'COMPLETED', step5);
    } catch (e: any) {
      onProgress?.('FINAL_RECOMMENDATION', 'FAILED', { error: e.message || String(e) });
      throw e;
    }

    return {
      pipelineId: `pipe-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date().toISOString(),
      isSuccess: true,
      trail: {
        step1_problem: step1,
        step2_contradiction: step2,
        step3_candidates: step3,
        step4_evaluation: step4,
        step5_choice: step5,
      },
    };
  }

  private cleanJsonString(text: string): string {
    let clean = text.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    }
    return clean;
  }

  private async createSession(): Promise<string> {
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

  private async runAgent(sessionId: string, message: string): Promise<string> {
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

  private extractModelText(eventStream: string): string {
    const modelTexts = eventStream
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .filter((payload) => payload && payload !== '[DONE]')
      .flatMap((payload) => this.parseEventText(payload));

    const text = modelTexts[modelTexts.length - 1];

    if (!text) {
      throw new BadGatewayException('ADK response did not include model text.');
    }

    return text;
  }

  private parseEventText(payload: string): string[] {
    let event: AdkEvent;

    try {
      event = JSON.parse(payload) as AdkEvent;
    } catch {
      return [];
    }

    if (event.errorCode || event.errorMessage) {
      throw new BadGatewayException(this.formatAdkError(event));
    }

    if (!event.author || event.author === 'user') {
      return [];
    }

    return (
      event.content?.parts
        ?.map((part) => part.text?.trim())
        .filter((text): text is string => Boolean(text)) ?? []
    );
  }

  private formatAdkError(event: AdkEvent): string {
    const code = event.errorCode ? ` ${event.errorCode}` : '';
    const message = event.errorMessage ? `: ${event.errorMessage}` : '';

    return `ADK error${code}${message}`;
  }
}
