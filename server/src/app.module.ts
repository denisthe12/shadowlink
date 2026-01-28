// server/src/app.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller'; // <--- Импорт контроллера
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    // 1. Загружаем .env файл (isGlobal делает его доступным везде)
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // 2. Подключаем Mongo асинхронно, чтобы успел загрузиться конфиг
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}