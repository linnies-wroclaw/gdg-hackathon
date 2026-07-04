import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

describe('AgentController', () => {
  let controller: AgentController;
  let service: jest.Mocked<Pick<AgentService, 'sendMessage'>>;

  beforeEach(async () => {
    service = {
      sendMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: service }],
    }).compile();

    controller = module.get<AgentController>(AgentController);
  });

  it('delegates message requests to the agent service', async () => {
    service.sendMessage.mockResolvedValue({
      sessionId: 'session-123',
      text: 'Use segmentation to isolate the slow path.',
      trace: {
        steps: [],
        causalChain: null,
        candidates: [],
        topTrizCandidates: [],
        topFiveYCandidates: [],
        evaluation: null,
        checks: [],
      },
    });

    await expect(
      controller.sendMessage({
        message: 'Improve latency without increasing cost',
        sessionId: 'session-123',
      }),
    ).resolves.toEqual({
      sessionId: 'session-123',
      text: 'Use segmentation to isolate the slow path.',
      trace: {
        steps: [],
        causalChain: null,
        candidates: [],
        topTrizCandidates: [],
        topFiveYCandidates: [],
        evaluation: null,
        checks: [],
      },
    });

    expect(service.sendMessage).toHaveBeenCalledWith({
      message: 'Improve latency without increasing cost',
      sessionId: 'session-123',
    });
  });
});
