import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  AgentMessageRequestDto,
  AgentMessageResponseDto,
  SubmitProblemRequestDto,
} from './agent.dto';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('messages')
  sendMessage(
    @Body() request: AgentMessageRequestDto,
  ): Promise<AgentMessageResponseDto> {
    return this.agentService.sendMessage(request);
  }

  @Post('solve-problem')
  async solveProblem(
    @Body() request: SubmitProblemRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (event: any) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const result = await this.agentService.solveProblem(
        request,
        (step, status, data) => {
          sendEvent({ type: 'progress', step, status, data });
        },
      );
      sendEvent({ type: 'result', data: result });
    } catch (error: any) {
      sendEvent({
        type: 'error',
        message: error.message || 'An unknown error occurred.',
      });
    } finally {
      res.end();
    }
  }
}
