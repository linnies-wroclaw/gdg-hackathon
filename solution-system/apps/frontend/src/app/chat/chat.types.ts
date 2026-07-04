export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

// Mirrors apps/api/src/app/agent.dto.ts — keep in sync manually.
export interface AgentMessageRequest {
  message: string;
  sessionId?: string;
}

export interface AgentMessageResponse {
  sessionId: string;
  text: string;
}

export * from '@solution-system/api-interfaces';
