// server/src/database/database.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema, Tender, TenderSchema, Invoice, InvoiceSchema } from './schemas';
import { SeedService } from './seed.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Tender.name, schema: TenderSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
  ],
  providers: [SeedService],
  exports: [MongooseModule],
})
export class DatabaseModule {}