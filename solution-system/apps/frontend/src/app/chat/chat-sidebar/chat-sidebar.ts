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
  focusComposer = output<void>();

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

  public focusActiveItem(): void {
    const buttons = this.chatButtons();
    const selectedId = this.chat.selectedChatId();
    
    // Знаходимо індекс активного елемента
    const activeIndex = this.chat.chats().findIndex(item => item.id === selectedId);
    const targetIndex = activeIndex !== -1 ? activeIndex : 0;
    
    buttons[targetIndex]?.nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const buttons = this.chatButtons();
    if (buttons.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        buttons[(index + 1) % buttons.length]?.nativeElement.focus();
        break;

      case 'ArrowUp':
        event.preventDefault();
        buttons[(index - 1 + buttons.length) % buttons.length]?.nativeElement.focus();
        break;

      case 'PageDown':
        event.preventDefault();
        // Пропускаємо 5 елементів вперед (або до кінця)
        buttons[Math.min(index + 5, buttons.length - 1)]?.nativeElement.focus();
        break;

      case 'PageUp':
        event.preventDefault();
        // Пропускаємо 5 елементів назад (або до початку)
        buttons[Math.max(index - 5, 0)]?.nativeElement.focus();
        break;

      case 'Home':
        event.preventDefault();
        buttons[0]?.nativeElement.focus();
        break;

      case 'End':
        event.preventDefault();
        buttons[buttons.length - 1]?.nativeElement.focus();
        break;

      case 'ArrowRight':
        event.preventDefault();
        this.focusComposer.emit();
        break;
    }
  }
}
