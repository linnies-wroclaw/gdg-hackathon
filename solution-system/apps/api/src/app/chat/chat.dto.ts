import { AgentTrace } from '../trace/trace.types';

export type ChatRole = 'user' | 'assistant';

export interface ChatSummaryDto {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageDto {
  id: number;
  role: ChatRole;
  text: string;
  createdAt: string;
  trace?: AgentTrace;
}

export interface ChatDetailDto extends ChatSummaryDto {
  messages: ChatMessageDto[];
}

export interface SendChatMessageRequestDto {
  message: string;
}

export interface SendChatMessageResponseDto {
  chatId: number;
  title: string;
  messages: ChatMessageDto[];
}
