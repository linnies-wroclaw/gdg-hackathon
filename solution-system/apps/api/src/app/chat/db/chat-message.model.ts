import {
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ChatRole } from '../chat.dto';
import { AgentTrace } from '../../trace/trace.types';
import { Chat } from './chat.model';

@Table({
  tableName: 'chat_messages',
  timestamps: true,
})
export class ChatMessage extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Chat)
  @Column({
    field: 'chat_id',
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare chatId: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare role: ChatRole;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare text: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  declare trace: AgentTrace | null;

  @BelongsTo(() => Chat)
  declare chat?: Chat;

  declare createdAt: Date;
  declare updatedAt: Date;
}
