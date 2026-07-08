import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  viewChild,
} from '@angular/core';
import { ChatService } from './chat.service';
import { ChatSidebarComponent } from './chat-sidebar/chat-sidebar';
import { ChatMessageComponent } from './chat-message/chat-message';

@Component({
  selector: 'app-chat-page',
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
  imports: [ChatSidebarComponent, ChatMessageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPage {
  protected readonly chat = inject(ChatService);

  private readonly logRef = viewChild.required<ElementRef<HTMLElement>>('log');
  private readonly inputRef =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('input');
  private readonly sidebarRef = viewChild.required(ChatSidebarComponent);

  constructor() {
    void this.chat.loadChats();

    afterRenderEffect(() => {
      this.chat.messages();
      this.chat.pending();
      const log = this.logRef().nativeElement;
      log.scrollTo?.({ top: log.scrollHeight });
    });
  }

  protected focusInput(): void {
    this.inputRef().nativeElement.focus();
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

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLInputElement;

      if (isInput) {
        const textEl = activeEl as HTMLTextAreaElement | HTMLInputElement;
        if (textEl.selectionStart !== 0) {
          return;
        }
      }

      event.preventDefault();
      this.sidebarRef().focusActiveItem();
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
}
