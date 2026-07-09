import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { ChatMessage, AgentTrace } from '../chat.types';
import { MarkdownPipe } from '../markdown.pipe';
import { SolutionTraceComponent } from '../solution-trace/solution-trace';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  templateUrl: './chat-message.html',
  host: {
    'role': 'article',
    '[class]': '"chat__message chat__message--" + message().role',
  },
  imports: [MarkdownPipe, SolutionTraceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageComponent {
  message = input.required<ChatMessage>();

  protected hasTraceView(trace: AgentTrace | undefined): trace is AgentTrace {
    return Boolean(
      trace &&
        (trace.topTrizCandidates.length > 0 ||
          trace.topFiveYCandidates.length > 0 ||
          trace.candidates.length > 0),
    );
  }
}
