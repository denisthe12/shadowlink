// server/src/app.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from './database/database.module';


@Module({
  imports: [
    // Подключаемся к локальной базе shadowlink_db
    MongooseModule.forRoot('mongodb://127.0.0.1:27017/shadowlink_db'),
    DatabaseModule,
  ],
})
export class AppModule {}