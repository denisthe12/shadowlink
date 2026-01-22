// server/src/database/schemas.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// --- User Schema ---
export type UserDocument = User & Document;
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  walletAddress: string;

  @Prop({ required: true })
  name: string; // "Builder Bob"

  @Prop()
  role: 'gov' | 'supplier' | 'employee'; // Основная роль
}
export const UserSchema = SchemaFactory.createForClass(User);

// --- Tender Schema ---
export type TenderDocument = Tender & Document;
@Schema({ timestamps: true })
export class Tender {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  maxBudget: number;

  @Prop({ default: 'open' })
  status: string;

  @Prop({ required: true })
  creatorWallet: string;

  @Prop()
  winnerWallet: string;

  @Prop()
  finalAmount: number;

  @Prop({ required: true }) // НОВОЕ ПОЛЕ
  deadline: Date;

  @Prop()
  workSubmission: string; // Отчет о выполненной работе
  
  @Prop()
  submittedAt: Date; // Дата сдачи
}
export const TenderSchema = SchemaFactory.createForClass(Tender);

// --- Bid Schema ---
export type BidDocument = Bid & Document;
@Schema({ timestamps: true })
export class Bid {
  @Prop({ required: true })
  tenderId: string;

  @Prop({ required: true })
  bidderWallet: string;

  @Prop({ required: true })
  bidderName: string; // Для удобства отображения

  @Prop({ required: true })
  amount: number; // Предложенная цена

  @Prop({ default: false })
  isDepositPaid: boolean; // Оплачен ли взнос за участие
}
export const BidSchema = SchemaFactory.createForClass(Bid);

// --- Invoice Schema ---
export type InvoiceDocument = Invoice & Document;
@Schema({ timestamps: true })
export class Invoice {
  @Prop({ required: true })
  invoiceNumber: string;

  @Prop({ required: true })
  supplierWallet: string;

  @Prop({ required: true })
  buyerWallet: string;

  @Prop({ required: true })
  totalAmount: number; // Для отображения поставщику, в блокчейне скроем

  @Prop({ enum: ['pending', 'paid'], default: 'pending' })
  status: string;
}
export const InvoiceSchema = SchemaFactory.createForClass(Invoice);