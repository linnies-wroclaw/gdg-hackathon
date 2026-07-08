import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  viewChild,
} from '@angular/core';
import { ChatService } from './chat.service';
import { MarkdownPipe } from './markdown.pipe';
import { SolutionTraceComponent } from './solution-trace/solution-trace';
import { AgentTrace } from './chat.types';

@Component({
  selector: 'app-chat-page',
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
  imports: [MarkdownPipe, SolutionTraceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPage {
  protected readonly chat = inject(ChatService);

  private readonly logRef = viewChild.required<ElementRef<HTMLElement>>('log');
  private readonly inputRef =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('input');

  constructor() {
    void this.chat.loadChats();

    afterRenderEffect(() => {
      this.chat.messages();
      this.chat.pending();
      const log = this.logRef().nativeElement;
      log.scrollTo?.({ top: log.scrollHeight });
    });
  }

  protected hasTraceView(trace: AgentTrace | undefined): trace is AgentTrace {
    return Boolean(
      trace &&
        (trace.topTrizCandidates.length > 0 ||
          trace.topFiveYCandidates.length > 0 ||
          trace.candidates.length > 0),
    );
  }

  protected createChat(): void {
    void this.chat.createChat();
    this.focusInput();
  }

  protected selectChat(chatId: number): void {
    if (this.chat.selectedChatId() === chatId || this.chat.pending()) {
      return;
    }

    void this.chat.selectChat(chatId);
    this.focusInput();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.sendCurrent();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendCurrent();
    }
  }

  protected onInput(): void {
    this.resizeInput();
  }

  private sendCurrent(): void {
    const textarea = this.inputRef().nativeElement;
    if (!textarea.value.trim() || this.chat.pending()) {
      return;
    }
    void this.chat.send(textarea.value);
    textarea.value = '';
    this.resizeInput();
    this.focusInput();
  }

  private resizeInput(): void {
    const textarea = this.inputRef().nativeElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  private focusInput(): void {
    this.inputRef().nativeElement.focus();
  }
}

