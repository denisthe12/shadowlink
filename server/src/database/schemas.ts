// server/src/database/schemas.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// --- User Schema ---
export type UserDocument = User & Document;
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  walletAddress: string;

  @Prop()
  name: string;

  @Prop()
  companyName: string;

  @Prop({ enum: ['admin', 'user'], default: 'user' })
  role: string;
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
  maxBudget: number; // Видимый бюджет (максимум)

  @Prop({ enum: ['open', 'closed'], default: 'open' })
  status: string;

  @Prop({ required: true })
  creatorWallet: string;
}
export const TenderSchema = SchemaFactory.createForClass(Tender);

// --- Bid Schema (Ставки) ---
export type BidDocument = Bid & Document;
@Schema({ timestamps: true })
export class Bid {
  @Prop({ required: true })
  tenderId: string;

  @Prop({ required: true })
  bidderWallet: string;

  // Сумма здесь НЕ хранится в открытом виде для честности,
  // либо хранится зашифрованной. Ссылка на транзакцию - главное доказательство.
  @Prop()
  txSignature: string; 
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