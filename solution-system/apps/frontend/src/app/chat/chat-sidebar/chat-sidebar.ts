import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from '@angular/core';
import { ChatService } from '../chat.service';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  templateUrl: './chat-sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatSidebarComponent {
  protected readonly chat = inject(ChatService);

  chatSelected = output<void>();
  chatCreated = output<void>();

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
}
