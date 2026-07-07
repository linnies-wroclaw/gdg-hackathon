import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ChatDetail,
  ChatMessage,
  ChatSummary,
  SendChatMessageResponse,
} from './chat.types';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);

  private readonly chatsState = signal<ChatSummary[]>([]);
  private readonly selectedChatIdState = signal<number | null>(null);
  private readonly messagesState = signal<ChatMessage[]>([]);
  private readonly pendingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly chats = this.chatsState.asReadonly();
  readonly selectedChatId = this.selectedChatIdState.asReadonly();
  readonly messages = this.messagesState.asReadonly();
  readonly pending = this.pendingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  async loadChats(): Promise<void> {
    this.errorState.set(null);
    this.pendingState.set(true);

    try {
      const chats = await firstValueFrom(
        this.http.get<ChatSummary[]>('/api/chats'),
      );
      this.chatsState.set(chats);

      if (chats.length === 0) {
        this.selectedChatIdState.set(null);
        this.messagesState.set([]);
        return;
      }

      await this.selectChat(chats[0].id);
    } catch {
      this.errorState.set('Could not load chats.');
    } finally {
      this.pendingState.set(false);
    }
  }

  async createChat(): Promise<number | null> {
    this.errorState.set(null);

    try {
      const chat = await firstValueFrom(
        this.http.post<ChatSummary>('/api/chats', {}),
      );
      this.chatsState.update((chats) => [
        chat,
        ...chats.filter((existing) => existing.id !== chat.id),
      ]);
      this.selectedChatIdState.set(chat.id);
      this.messagesState.set([]);
      return chat.id;
    } catch {
      this.errorState.set('Could not create a new chat.');
      return null;
    }
  }

  async selectChat(chatId: number): Promise<void> {
    this.errorState.set(null);
    const chat = await firstValueFrom(
      this.http.get<ChatDetail>(`/api/chats/${chatId}`),
    );
    this.selectedChatIdState.set(chat.id);
    this.messagesState.set(chat.messages);
    this.upsertChatSummary(chat);
  }

  async send(text: string): Promise<void> {
    const message = text.trim();
    if (!message || this.pendingState()) {
      return;
    }

    this.errorState.set(null);
    this.pendingState.set(true);
    
    // Add user message optimistically (without an id yet)
    this.messagesState.update((messages) => [
      ...messages,
      { role: 'user', text: message },
    ]);

    try {
      const chatId =
        this.selectedChatIdState() ?? (await this.createChat());
      if (!chatId) {
        this.pendingState.set(false);
        return;
      }

      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No stream reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let assistantMessageIndex = -1;

      const updateAssistantText = (newText: string, trace?: any) => {
        this.messagesState.update((messages) => {
          const updated = [...messages];
          if (assistantMessageIndex === -1) {
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant') {
              assistantMessageIndex = updated.length - 1;
              updated[assistantMessageIndex] = { role: 'assistant', text: newText, trace };
            } else {
              updated.push({ role: 'assistant', text: newText, trace });
              assistantMessageIndex = updated.length - 1;
            }
          } else {
            updated[assistantMessageIndex] = { role: 'assistant', text: newText, trace };
          }
          return updated;
        });
      };

      const stepsStatus: Record<string, string> = {
        problem_extractor: 'pending',
        why_step: 'pending',
        triz_solver: 'pending',
        fiveY_solver: 'pending',
      };

      const renderProgress = () => {
        const getStepHtml = (label: string, key: string) => {
          const status = stepsStatus[key];
          let statusClass = '';
          let badgeClass = '';
          let badgeLabel = 'Waiting';

          if (status === 'active') {
            statusClass = 'agent-progress__step--active';
            badgeClass = 'agent-progress__badge--running';
            badgeLabel = 'Running';
          } else if (status === 'done') {
            statusClass = 'agent-progress__step--done';
            badgeClass = 'agent-progress__badge--done';
            badgeLabel = 'Done';
          } else {
            badgeClass = 'agent-progress__badge--waiting';
          }

          return `<div class="agent-progress__step ${statusClass}">` +
            `<span>${label}</span>` +
            `<span class="agent-progress__badge ${badgeClass}">${badgeLabel}</span>` +
            `</div>`;
        };

        return `<div class="agent-progress">` +
          `<h3 class="agent-progress__title">Orchestrating Solution Engineering Agents...</h3>` +
          `<div class="agent-progress__steps">` +
          `${getStepHtml('Problem Extractor Agent', 'problem_extractor')}` +
          `${getStepHtml('5-Whys Analysis Agent', 'why_step')}` +
          `${getStepHtml('TRIZ Solver Agent', 'triz_solver')}` +
          `${getStepHtml('5-Whys Solver Agent', 'fiveY_solver')}` +
          `</div>` +
          `<p class="agent-progress__footer">Please stand by, generating TRIZ & 5-Whys evaluation report...</p>` +
          `</div>`;
      };

      // Set initial progress state
      updateAssistantText(renderProgress());

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) {
            continue;
          }

          const payloadStr = trimmed.substring(6);
          if (!payloadStr) {
            continue;
          }

          try {
            const payload = JSON.parse(payloadStr);

            if (payload.type === 'user_message') {
              // Update user message with the persisted one containing database ID
              this.messagesState.update((messages) => {
                const updated = [...messages];
                let userIdx = -1;
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].role === 'user') {
                    userIdx = i;
                    break;
                  }
                }
                if (userIdx !== -1) {
                  updated[userIdx] = payload.message;
                }
                return updated;
              });
              this.updateChatTitle(payload.chatId, payload.title);
            } 
            else if (payload.type === 'final_result') {
              // Complete, overwrite with final report and evaluation trace
              updateAssistantText(payload.message.text, payload.message.trace);
            } 
            else if (payload.type === 'error') {
              this.errorState.set(payload.error);
              updateAssistantText(`❌ Error: ${payload.error}`);
            } 
            else {
              // Handle agent progress event
              const author = payload.author;
              if (author) {
                if (author === 'problem_extractor') {
                  stepsStatus['problem_extractor'] = 'active';
                } else if (author === 'why_step') {
                  stepsStatus['problem_extractor'] = 'done';
                  stepsStatus['why_step'] = 'active';
                } else if (author === 'triz_solver') {
                  stepsStatus['why_step'] = 'done';
                  stepsStatus['triz_solver'] = 'active';
                } else if (author === 'fiveY_solver') {
                  stepsStatus['triz_solver'] = 'done';
                  stepsStatus['fiveY_solver'] = 'active';
                }

                if (payload.finishReason === 'STOP') {
                  if (author === 'problem_extractor') stepsStatus['problem_extractor'] = 'done';
                  if (author === 'why_step') stepsStatus['why_step'] = 'done';
                  if (author === 'triz_solver') stepsStatus['triz_solver'] = 'done';
                  if (author === 'fiveY_solver') stepsStatus['fiveY_solver'] = 'done';
                }

                // Update the typed thinking output with latest status
                if (assistantMessageIndex === -1 || !this.messagesState()[assistantMessageIndex]?.trace) {
                  updateAssistantText(renderProgress());
                }
              }
            }
          } catch {
            // Ignore JSON parsing errors for incomplete chunks
          }
        }
      }

      this.errorState.set(null);
    } catch (err: any) {
      this.errorState.set(err.message || 'Something went wrong - try again.');
    } finally {
      this.pendingState.set(false);
    }
  }

  private upsertChatSummary(chat: ChatSummary): void {
    this.chatsState.update((chats) => [
      chat,
      ...chats.filter((existing) => existing.id !== chat.id),
    ]);
  }

  private updateChatTitle(chatId: number, title: string): void {
    this.chatsState.update((chats) =>
      chats.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)),
    );
  }
}
