import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from '../agent.service';
import { AgentTrace } from '../trace/trace.types';
import { NEW_CHAT_TITLE } from './chat.constants';
import { ChatService } from './chat.service';
import { ChatMessage } from './db/chat-message.model';
import { Chat } from './db/chat.model';

const iso = (value: string) => new Date(value);
const stubTrace: AgentTrace = {
  steps: [
    {
      index: 0,
      agent: 'problem_extractor',
      type: 'model_output',
      content: 'doc',
    },
  ],
  causalChain: null,
  candidates: [],
  topTrizCandidates: [],
  topFiveYCandidates: [],
  evaluation: null,
  checks: [],
};

describe('ChatService', () => {
  let service: ChatService;
  let agentService: jest.Mocked<
    Pick<AgentService, 'createSession' | 'runTracedMessage'>
  >;
  let chatModel: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let messageModel: {
    bulkCreate: jest.Mock;
  };
  let transaction: jest.Mock;

  beforeEach(async () => {
    agentService = {
      createSession: jest.fn(),
      runTracedMessage: jest.fn(),
    };
    chatModel = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    messageModel = {
      bulkCreate: jest.fn(),
    };
    transaction = jest.fn(async (callback) => callback({ id: 'tx' }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: AgentService, useValue: agentService },
        { provide: getModelToken(Chat), useValue: chatModel },
        { provide: getModelToken(ChatMessage), useValue: messageModel },
        { provide: getConnectionToken(), useValue: { transaction } },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  it('creates a chat with a new ADK session', async () => {
    agentService.createSession.mockResolvedValue('adk-1');
    chatModel.create.mockResolvedValue({
      id: 1,
      title: NEW_CHAT_TITLE,
      createdAt: iso('2026-07-04T10:00:00.000Z'),
      updatedAt: iso('2026-07-04T10:00:00.000Z'),
    });

    await expect(service.createChat()).resolves.toEqual({
      id: 1,
      title: NEW_CHAT_TITLE,
      createdAt: '2026-07-04T10:00:00.000Z',
      updatedAt: '2026-07-04T10:00:00.000Z',
    });

    expect(chatModel.create).toHaveBeenCalledWith({
      adkSessionId: 'adk-1',
      userId: 'user',
      title: NEW_CHAT_TITLE,
    });
  });

  it('lists chats newest first', async () => {
    chatModel.findAll.mockResolvedValue([
      {
        id: 2,
        title: 'Second',
        createdAt: iso('2026-07-04T11:00:00.000Z'),
        updatedAt: iso('2026-07-04T11:05:00.000Z'),
      },
    ]);

    await expect(service.listChats()).resolves.toEqual([
      {
        id: 2,
        title: 'Second',
        createdAt: '2026-07-04T11:00:00.000Z',
        updatedAt: '2026-07-04T11:05:00.000Z',
      },
    ]);

    expect(chatModel.findAll).toHaveBeenCalledWith({
      where: { userId: 'user' },
      order: [['updatedAt', 'DESC']],
    });
  });

  it('returns a chat with ordered messages', async () => {
    chatModel.findOne.mockResolvedValue({
      id: 1,
      title: 'Question',
      createdAt: iso('2026-07-04T10:00:00.000Z'),
      updatedAt: iso('2026-07-04T10:05:00.000Z'),
      messages: [
        {
          id: 1,
          role: 'user',
          text: 'Question',
          createdAt: iso('2026-07-04T10:01:00.000Z'),
        },
      ],
    });

    await expect(service.getChat(1)).resolves.toEqual({
      id: 1,
      title: 'Question',
      createdAt: '2026-07-04T10:00:00.000Z',
      updatedAt: '2026-07-04T10:05:00.000Z',
      messages: [
        {
          id: 1,
          role: 'user',
          text: 'Question',
          createdAt: '2026-07-04T10:01:00.000Z',
        },
      ],
    });
  });

  it('rejects empty messages', async () => {
    await expect(
      service.sendMessage(1, { message: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(agentService.runTracedMessage).not.toHaveBeenCalled();
  });

  it('maps missing chats to NotFoundException', async () => {
    chatModel.findOne.mockResolvedValue(null);

    await expect(
      service.sendMessage(404, { message: 'Hello' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persists user and assistant messages for an existing chat', async () => {
    chatModel.findOne.mockResolvedValue({
      id: 1,
      title: NEW_CHAT_TITLE,
      adkSessionId: 'adk-1',
      update: chatModel.update,
    });
    agentService.runTracedMessage.mockResolvedValue({
      text: 'Answer',
      trace: stubTrace,
    });
    chatModel.update.mockResolvedValue(undefined);
    messageModel.bulkCreate.mockResolvedValue([
      {
        id: 10,
        role: 'user',
        text: 'Question',
        createdAt: iso('2026-07-04T10:01:00.000Z'),
      },
      {
        id: 11,
        role: 'assistant',
        text: 'Answer',
        trace: stubTrace,
        createdAt: iso('2026-07-04T10:01:01.000Z'),
      },
    ]);

    await expect(
      service.sendMessage(1, { message: ' Question ' }),
    ).resolves.toEqual({
      chatId: 1,
      title: 'Question',
      messages: [
        {
          id: 10,
          role: 'user',
          text: 'Question',
          createdAt: '2026-07-04T10:01:00.000Z',
        },
        {
          id: 11,
          role: 'assistant',
          text: 'Answer',
          trace: stubTrace,
          createdAt: '2026-07-04T10:01:01.000Z',
        },
      ],
    });

    expect(agentService.runTracedMessage).toHaveBeenCalledWith('adk-1', 'Question');
    expect(messageModel.bulkCreate).toHaveBeenCalledWith(
      [
        { chatId: 1, role: 'user', text: 'Question' },
        { chatId: 1, role: 'assistant', text: 'Answer', trace: stubTrace },
      ],
      { transaction: { id: 'tx' } },
    );
  });

  it('does not persist messages when ADK fails', async () => {
    chatModel.findOne.mockResolvedValue({
      id: 1,
      title: 'Existing',
      adkSessionId: 'adk-1',
    });
    agentService.runTracedMessage.mockRejectedValue(
      new BadGatewayException('ADK down'),
    );

    await expect(
      service.sendMessage(1, { message: 'Question' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(messageModel.bulkCreate).not.toHaveBeenCalled();
  });
});
