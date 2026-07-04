import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AgentMessageRequest,
  AgentMessageResponse,
  ChatMessage,
  SubmitProblemRequestDto,
  ReasoningTrailResponseDto,
} from './chat.types';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);

  private readonly messagesState = signal<ChatMessage[]>([]);
  private readonly pendingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly progressStepsState = signal<Array<{ step: string; status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'; error?: string }>>([
    { step: 'GOAL_EXTRACTION', status: 'PENDING' },
    { step: 'CONTRADICTION_SOLVER', status: 'PENDING' },
    { step: 'CANDIDATE_GENERATION', status: 'PENDING' },
    { step: 'EVALUATION', status: 'PENDING' },
    { step: 'FINAL_RECOMMENDATION', status: 'PENDING' },
  ]);
  private readonly trailState = signal<ReasoningTrailResponseDto | null>(null);
  private sessionId: string | null = null;

  readonly messages = this.messagesState.asReadonly();
  readonly pending = this.pendingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly trail = this.trailState.asReadonly();
  readonly progressSteps = this.progressStepsState.asReadonly();

  async send(text: string): Promise<void> {
    const message = text.trim();
    if (!message || this.pendingState()) {
      return;
    }

    this.errorState.set(null);
    this.pendingState.set(true);
    this.messagesState.update((messages: ChatMessage[]) => [
      ...messages,
      { role: 'user', text: message },
    ]);

    const request: AgentMessageRequest = this.sessionId
      ? { message, sessionId: this.sessionId }
      : { message };

    try {
      const response = await firstValueFrom(
        this.http.post<AgentMessageResponse>('/api/agent/messages', request),
      );
      this.sessionId = response.sessionId;
      this.messagesState.update((messages: ChatMessage[]) => [
        ...messages,
        { role: 'assistant', text: response.text },
      ]);
    } catch {
      this.errorState.set('Something went wrong — try again.');
    } finally {
      this.pendingState.set(false);
    }
  }

  async solve(request: SubmitProblemRequestDto): Promise<void> {
    if (this.pendingState()) {
      return;
    }

    this.errorState.set(null);
    this.pendingState.set(true);
    this.trailState.set(null);
    this.progressStepsState.set([
      { step: 'GOAL_EXTRACTION', status: 'PENDING' },
      { step: 'CONTRADICTION_SOLVER', status: 'PENDING' },
      { step: 'CANDIDATE_GENERATION', status: 'PENDING' },
      { step: 'EVALUATION', status: 'PENDING' },
      { step: 'FINAL_RECOMMENDATION', status: 'PENDING' },
    ]);

    try {
      const response = await fetch('/api/agent/solve-problem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.body) {
        throw new Error('No response body received.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          try {
            const event = JSON.parse(payload);
            if (event.type === 'progress') {
              this.progressStepsState.update(steps =>
                steps.map(s => {
                  if (s.step === event.step) {
                    return {
                      step: s.step,
                      status: event.status === 'START' ? 'RUNNING' : event.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
                      error: event.status === 'FAILED' ? event.data?.error : undefined
                    };
                  }
                  return s;
                })
              );
            } else if (event.type === 'result') {
              this.trailState.set(event.data);
            } else if (event.type === 'error') {
              this.errorState.set(event.message);
              this.progressStepsState.update(steps =>
                steps.map(s => s.status === 'RUNNING' ? { ...s, status: 'FAILED', error: event.message } : s)
              );
            }
          } catch (e) {
            // Ignore parsing errors on partial chunks
          }
        }
      }
    } catch (err: any) {
      this.errorState.set(err.message || 'Не вдалося розв\'язати суперечність. Будь ласка, спробуйте ще раз.');
      this.progressStepsState.update(steps =>
        steps.map(s => s.status === 'RUNNING' ? { ...s, status: 'FAILED' } : s)
      );
    } finally {
      this.pendingState.set(false);
    }
  }
}

