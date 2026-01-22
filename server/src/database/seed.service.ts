// server/src/database/seed.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, Tender, TenderDocument, Invoice, InvoiceDocument } from './schemas';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Tender.name) private tenderModel: Model<TenderDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
  ) {}

  async onModuleInit() {
    // Очистка
    //await this.tenderModel.deleteMany({});
    //await this.invoiceModel.deleteMany({});
    // await this.bidModel.deleteMany({}); // Если хочешь чистить и ставки тоже

    const tendersCount = await this.tenderModel.countDocuments();
    if (tendersCount === 0) {
      console.log('🌱 Seeding fake tenders...');
      
      const today = new Date();
      const nextMonth = new Date(today); nextMonth.setDate(today.getDate() + 30);
      const nextMonth2 = new Date(today); nextMonth2.setDate(today.getDate() + 43);

      await this.tenderModel.create([
        {
          title: 'Construction of New High School',
          description: 'Full cycle construction tender. Region: Texas.',
          maxBudget: 5000000,
          creatorWallet: 'GovWallet1111111111111111',
          status: 'open',
          deadline: nextMonth, // +30 дней
        },
        {
          title: 'IT Hardware Supply (MacBooks)',
          description: 'Supply of 50 M3 MacBook Pro for Dev Dept.',
          maxBudget: 150000,
          creatorWallet: 'GovWallet1111111111111111', // Пусть тоже Gov создал
          status: 'open',
          deadline: nextMonth2, // +43 дня
        },
      ]);
      
      // Можно тут создать фейковые ставки (Bids), чтобы счетчик участников не был 0
      // Но для чистоты эксперимента оставим 0, мы их создадим через UI
    }
    
    console.log('✅ Database seeded with demo data');
  }
}