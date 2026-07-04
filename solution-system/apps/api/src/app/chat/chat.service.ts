import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AgentService } from '../agent.service';
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
