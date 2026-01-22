// server/src/database/database.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
// Добавляем Bid и BidSchema в импорт
import { User, UserSchema, Tender, TenderSchema, Invoice, InvoiceSchema, Bid, BidSchema } from './schemas';
import { SeedService } from './seed.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Tender.name, schema: TenderSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      // ВОТ ЭТОЙ СТРОКИ НЕ ХВАТАЛО:
      { name: Bid.name, schema: BidSchema }, 
    ]),
  ],
  providers: [SeedService],
  exports: [MongooseModule],
})
export class DatabaseModule {}