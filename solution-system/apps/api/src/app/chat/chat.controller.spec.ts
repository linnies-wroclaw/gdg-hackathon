import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  let service: jest.Mocked<
    Pick<ChatService, 'createChat' | 'listChats' | 'getChat' | 'sendMessageStream'>
  >;

  beforeEach(async () => {
    service = {
      createChat: jest.fn(),
      listChats: jest.fn(),
      getChat: jest.fn(),
      sendMessageStream: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: service }],
    }).compile();

    controller = module.get(ChatController);
  });

  it('lists chats', async () => {
    service.listChats.mockResolvedValue([]);

    await expect(controller.listChats()).resolves.toEqual([]);
    expect(service.listChats).toHaveBeenCalled();
  });

  it('creates a chat', async () => {
    service.createChat.mockResolvedValue({
      id: 1,
      title: 'New chat',
      createdAt: '2026-07-04T10:00:00.000Z',
      updatedAt: '2026-07-04T10:00:00.000Z',
    });

    await expect(controller.createChat()).resolves.toMatchObject({ id: 1 });
  });

  it('loads a chat by numeric id', async () => {
    service.getChat.mockResolvedValue({
      id: 1,
      title: 'Chat',
      createdAt: '2026-07-04T10:00:00.000Z',
      updatedAt: '2026-07-04T10:00:00.000Z',
      messages: [],
    });

    await expect(controller.getChat('1')).resolves.toMatchObject({ id: 1 });
    expect(service.getChat).toHaveBeenCalledWith(1);
  });

  it('sends a message to a chat by numeric id', async () => {
    service.sendMessageStream.mockResolvedValue(undefined);
    const mockRes = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;

    await expect(
      controller.sendMessage('1', { message: 'Hello' }, mockRes),
    ).resolves.toBeUndefined();
    expect(service.sendMessageStream).toHaveBeenCalledWith(1, { message: 'Hello' }, mockRes);
  });
});
