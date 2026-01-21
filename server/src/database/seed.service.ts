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
    // Очищаем базу при рестарте (для демо удобно)
    await this.tenderModel.deleteMany({});
    await this.invoiceModel.deleteMany({});

    const tendersCount = await this.tenderModel.countDocuments();
    if (tendersCount === 0) {
      console.log('🌱 Seeding fake tenders...');
      await this.tenderModel.create([
        {
          title: 'Construction of New High School',
          description: 'Full cycle construction tender. Region: Texas.',
          maxBudget: 5000000,
          creatorWallet: 'GovWallet123...',
          status: 'open',
        },
        {
          title: 'IT Hardware Supply (MacBooks)',
          description: 'Supply of 50 M3 MacBook Pro for Dev Dept.',
          maxBudget: 150000,
          creatorWallet: 'CorpWalletXYZ...',
          status: 'open',
        },
      ]);
    }
    
    console.log('✅ Database seeded with demo data');
  }
}