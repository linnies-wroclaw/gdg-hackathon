import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { ChatMessage } from './chat/db/chat-message.model';
import { Chat } from './chat/db/chat.model';
import { DatabaseService } from './db.service';

@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'solution_system',
      models: [Chat, ChatMessage],
      autoLoadModels: true,
      synchronize: true,
      sync: { alter: true },
    }),
    ChatModule,
  ],
  controllers: [AppController, AgentController],
  providers: [AppService, AgentService, DatabaseService],
})
export class AppModule {}
