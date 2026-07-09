import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AgentService } from '../agent.service';
import { runChecks } from '../evaluation/conformance';
import {
  parseCandidateRecords,
  scoreCandidate,
  selectWinner,
  topCandidatesBySource,
} from '../evaluation/evaluation.engine';
import { renderReport } from '../evaluation/report-renderer';
import { parseRun } from '../trace/trace-parser';
import { DEMO_USER_ID, NEW_CHAT_TITLE } from './chat.constants';
import {
  ChatDetailDto,
  ChatMessageDto,
  ChatSummaryDto,
  SendChatMessageRequestDto,
  SendChatMessageResponseDto,
} from './chat.dto';
import { ChatMessage } from './db/chat-message.model';
import { Chat } from './db/chat.model';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Chat) private readonly chatModel: typeof Chat,
    @InjectModel(ChatMessage)
    private readonly chatMessageModel: typeof ChatMessage,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly agentService: AgentService,
  ) {}

  async createChat(): Promise<ChatSummaryDto> {
    const adkSessionId = await this.agentService.createSession();
    const chat = await this.chatModel.create({
      adkSessionId,
      userId: DEMO_USER_ID,
      title: NEW_CHAT_TITLE,
    });

    return this.toSummary(chat);
  }

  async listChats(): Promise<ChatSummaryDto[]> {
    const chats = await this.chatModel.findAll({
      where: { userId: DEMO_USER_ID },
      order: [['updatedAt', 'DESC']],
    });

    return chats.map((chat) => this.toSummary(chat));
  }

  async getChat(chatId: number): Promise<ChatDetailDto> {
    const chat = await this.findChat(chatId, true);

    return {
      ...this.toSummary(chat),
      messages: (chat.messages ?? []).map((message) =>
        this.toMessage(message),
      ),
    };
  }

  async sendMessage(
    chatId: number,
    request: SendChatMessageRequestDto,
  ): Promise<SendChatMessageResponseDto> {
    const message = request.message?.trim();

    if (!message) {
      throw new BadRequestException('Message is required.');
    }

    const chat = await this.findChat(chatId, false);
    const { text: assistantText, trace } = await this.agentService.runTracedMessage(
      chat.adkSessionId,
      message,
    );
    const title =
      chat.title === NEW_CHAT_TITLE
        ? this.createTitle(message)
        : chat.title;

    const persistedMessages = await this.sequelize.transaction(
      async (transaction) => {
        if (title !== chat.title) {
          await chat.update({ title }, { transaction });
        } else {
          await chat.update({ updatedAt: new Date() }, { transaction });
        }

        return this.chatMessageModel.bulkCreate(
          [
            { chatId: chat.id, role: 'user', text: message },
            { chatId: chat.id, role: 'assistant', text: assistantText, trace },
          ],
          { transaction },
        );
      },
    );

    return {
      chatId: chat.id,
      title,
      messages: persistedMessages.map((persistedMessage) =>
        this.toMessage(persistedMessage),
      ),
    };
  }

  async sendMessageStream(
    chatId: number,
    request: SendChatMessageRequestDto,
    res: any,
  ): Promise<void> {
    const message = request.message?.trim();
    if (!message) {
      throw new BadRequestException('Message is required.');
    }

    this.logger.log(`Handling sendMessageStream for chatId: ${chatId}`);
    const chat = await this.findChat(chatId, false);

    // Set headers for SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const title =
      chat.title === NEW_CHAT_TITLE
        ? this.createTitle(message)
        : chat.title;

    const userMessage = await this.sequelize.transaction(async (transaction) => {
      if (title !== chat.title) {
        await chat.update({ title }, { transaction });
      } else {
        await chat.update({ updatedAt: new Date() }, { transaction });
      }
      return this.chatMessageModel.create(
        { chatId: chat.id, role: 'user', text: message },
        { transaction },
      );
    });

    this.logger.log(`User message persisted with ID: ${userMessage.id}`);
    const escapeHtml = (unsafe: string): string => {
      return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const sanitizedTitle = escapeHtml(title);
    const sanitizedUserMessage = {
      ...this.toMessage(userMessage),
      text: escapeHtml(userMessage.text),
    };

    // Send an initial event with the user message and updated chat info
    res.write(`data: ${JSON.stringify({
      type: 'user_message',
      chatId: chat.id,
      title: sanitizedTitle,
      message: sanitizedUserMessage,
    })}\n\n`);


    let buffer = '';
    try {
      this.logger.log(`Starting ADK agent stream. Session ID: ${chat.adkSessionId}`);
      const stream = await this.agentService.runAgentStream(chat.adkSessionId, message);
      
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: any) => {
          const textChunk = chunk.toString();
          buffer += textChunk;
          // Forward raw SSE chunk to the client
          res.write(textChunk);
        });

        stream.on('end', () => {
          resolve();
        });

        stream.on('error', (err: any) => {
          reject(err);
        });
      });

      this.logger.log(`ADK stream completed. Processing response buffer (${buffer.length} chars)...`);

      // Stream completed. Process the accumulated buffer.
      const run = parseRun(buffer);
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
      
      this.logger.log(`Causal chain valid: ${chain !== null}, Candidates parsed: ${records?.length ?? 0}`);
      this.logger.log(`Conformance checks passed: ${checks.filter(c => c.passed).length}/${checks.length}`);

      const failureReason =
        chain === null
          ? 'Evaluation unavailable: no valid causal chain.'
          : records === null
            ? 'Evaluation unavailable: no valid candidate records.'
            : undefined;
      const assistantText = renderReport(evaluation, chain, failureReason);

      const trace = {
        steps: run.steps,
        causalChain: chain,
        candidates,
        topTrizCandidates,
        topFiveYCandidates,
        evaluation,
        checks,
      };

      // Persist assistant message in database
      this.logger.log(`Persisting assistant message for chatId: ${chat.id}`);
      const assistantMessage = await this.chatMessageModel.create({
        chatId: chat.id,
        role: 'assistant',
        text: assistantText,
        trace,
      });

      // Send the final processed result to the client
      res.write(`data: ${JSON.stringify({
        type: 'final_result',
        message: this.toMessage(assistantMessage),
      })}\n\n`);

    } catch (error: any) {
      const errorMsg = error.message || 'An error occurred during agent run';
      this.logger.error(`Error in sendMessageStream for chatId ${chatId}: ${errorMsg}`, error.stack);
      // Stream error event to client
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: errorMsg,
      })}\n\n`);
    } finally {
      res.end();
    }
  }

  private async findChat(
    chatId: number,
    includeMessages: boolean,
  ): Promise<Chat> {
    const chat = await this.chatModel.findOne({
      where: { id: chatId, userId: DEMO_USER_ID },
      include: includeMessages
        ? [
            {
              model: ChatMessage,
              separate: true,
              order: [['createdAt', 'ASC']],
            },
          ]
        : undefined,
    });

    if (!chat) {
      throw new NotFoundException(`Chat with id ${chatId} not found.`);
    }

    return chat;
  }

  private createTitle(message: string): string {
    return message.length > 48
      ? `${message.slice(0, 45).trim()}...`
      : message;
  }

  private toSummary(chat: Chat): ChatSummaryDto {
    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
    };
  }

  private toMessage(message: ChatMessage): ChatMessageDto {
    return {
      id: message.id,
      role: message.role,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      ...(message.trace ? { trace: message.trace } : {}),
    };
  }
}
