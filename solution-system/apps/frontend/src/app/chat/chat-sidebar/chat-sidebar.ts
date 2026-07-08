import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  output,
  viewChildren,
} from '@angular/core';
import { ChatService } from '../chat.service';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  templateUrl: './chat-sidebar.html',
  styleUrl: './chat-sidebar.scss',
  host: {
    'role': 'complementary',
    'aria-label': 'Conversations',
    'class': 'chat__sidebar',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatSidebarComponent {
  protected readonly chat = inject(ChatService);

  chatSelected = output<void>();
  chatCreated = output<void>();

  private readonly chatButtons = viewChildren<ElementRef<HTMLButtonElement>>('chatButton');

  protected createChat(): void {
    void this.chat.createChat();
    this.chatCreated.emit();
  }

  protected selectChat(chatId: number): void {
    if (this.chat.selectedChatId() === chatId || this.chat.pending()) {
      return;
    }

    void this.chat.selectChat(chatId);
    this.chatSelected.emit();
  }

  protected isFocusable(itemId: number, index: number): boolean {
    const selectedId = this.chat.selectedChatId();
    if (selectedId !== undefined && selectedId !== null) {
      return selectedId === itemId;
    }
    return index === 0;
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const buttons = this.chatButtons();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (index + 1) % buttons.length;
      buttons[nextIndex]?.nativeElement.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = (index - 1 + buttons.length) % buttons.length;
      buttons[prevIndex]?.nativeElement.focus();
    }
  }
}
