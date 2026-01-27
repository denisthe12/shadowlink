// server/src/database/schemas.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// --- Sub-schema for Address Book ---
@Schema({ _id: false }) // Не создаем отдельный _id для контакта
export class Contact {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  walletAddress: string;
}
export const ContactSchema = SchemaFactory.createForClass(Contact);

@Schema({ _id: false })
export class CompanyProfile {
  @Prop({ default: '' })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  industry: string;

  @Prop({ default: 0 })
  employeesCount: number;

  // Statistics (можно считать динамически, но для MVP храним тут)
  @Prop({ default: 0 })
  tendersCreated: number;

  @Prop({ default: 0 })
  tendersWon: number;
}
export const CompanyProfileSchema = SchemaFactory.createForClass(CompanyProfile);

// --- User Schema (Updated) ---
export type UserDocument = User & Document;
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  walletAddress: string; // Главный ID

  @Prop({ default: false })
  isRegistered: boolean; // True, если сделал хоть один Deposit в ShadowWire

  // "Телефонная книга" пользователя
  @Prop({ type: [ContactSchema], default: [] })
  contacts: Contact[];

  @Prop({ type: CompanyProfileSchema, default: () => ({}) })
  company: CompanyProfile;
}
export const UserSchema = SchemaFactory.createForClass(User);

// --- Остальные схемы оставляем без изменений ---
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

  @Prop() // Сделал optional, чтобы старый код не падал, но в логике будем использовать
  deadline: Date;

  @Prop()
  workSubmission: string;
  
  @Prop()
  submittedAt: Date;

  // НОВЫЕ ПОЛЯ
  @Prop({ default: 'external' })
  preferredPaymentType: string; // 'internal' | 'external'

  @Prop()
  preferredPaymentWallet: string; // Кошелек для выплаты
}
export const TenderSchema = SchemaFactory.createForClass(Tender);

export type BidDocument = Bid & Document;
@Schema({ timestamps: true })
export class Bid {
  @Prop({ required: true })
  tenderId: string;

  @Prop({ required: true })
  bidderWallet: string;

  @Prop({ required: true })
  bidderName: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: false })
  isDepositPaid: boolean;
}
export const BidSchema = SchemaFactory.createForClass(Bid);

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
  totalAmount: number;

  @Prop()
  description: string;

  @Prop({ enum: ['pending', 'paid', 'cancelled'], default: 'pending' })
  status: string;

  @Prop({ required: true, enum: ['internal', 'external'], default: 'external' })
  type: string; // НОВОЕ ПОЛЕ
}
export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

export type EmployeeDocument = Employee & Document;
@Schema({ timestamps: true })
export class Employee {
  @Prop({ required: true })
  employerWallet: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  walletAddress: string;

  @Prop({ required: true })
  salary: number;

  @Prop({ default: 'active' })
  status: string;

  // НОВОЕ ПОЛЕ
  @Prop({ required: true, default: 'external', enum: ['internal', 'external'] })
  paymentType: string;

}
export const EmployeeSchema = SchemaFactory.createForClass(Employee);

