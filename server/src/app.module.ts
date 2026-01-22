// server/src/app.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller'; // <--- Импорт контроллера

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://127.0.0.1:27017/shadowlink_db'),
    DatabaseModule,
  ],
  controllers: [AppController], // <--- Контроллер должен быть здесь!
  providers: [],
})
export class AppModule {}