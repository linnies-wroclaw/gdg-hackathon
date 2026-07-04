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
    this.messagesState.update((messages) => [
      ...messages,
      { role: 'user', text: message },
    ]);

    try {
      const chatId =
        this.selectedChatIdState() ?? (await this.createChat());
      if (!chatId) {
        return;
      }

      const response = await firstValueFrom(
        this.http.post<SendChatMessageResponse>(
          `/api/chats/${chatId}/messages`,
          { message },
        ),
      );
      this.messagesState.update((messages) => [
        ...messages.filter((entry) => entry.id !== undefined),
        ...response.messages,
      ]);
      this.errorState.set(null);
      this.updateChatTitle(response.chatId, response.title);
    } catch {
      this.errorState.set('Something went wrong - try again.');
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
