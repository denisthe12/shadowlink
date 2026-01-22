// server/src/app.controller.ts
import { Body, Controller, Get, Param, Post, Put, Delete, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, Tender, Bid, Employee, Invoice } from './database/schemas';

// Префикс 'api' означает, что все методы будут доступны по /api/...
@Controller('api')
export class AppController {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Tender.name) private tenderModel: Model<Tender>,
    @InjectModel(Bid.name) private bidModel: Model<Bid>,
    @InjectModel(Employee.name) private employeeModel: Model<Employee>,
    @InjectModel(Invoice.name) private invoiceModel: Model<Invoice>,
  ) {}

  // --- Users ---
  @Get('users') // GET /api/users
  async getUsers() {
    return this.userModel.find().exec();
  }

  @Post('users/login') // POST /api/users/login
  async loginOrRegister(@Body() body: { wallet: string; role?: string }) {
    console.log('Login request:', body); // Лог для отладки
    let user = await this.userModel.findOne({ walletAddress: body.wallet });
    if (!user && body.role) {
      user = await this.userModel.create({
        walletAddress: body.wallet,
        name: `User ${body.wallet.slice(0, 4)}`,
        role: body.role,
      });
    }
    return user;
  }

  // --- Tenders ---
  @Get('tenders') // GET /api/tenders
  async getTenders() {
    console.log('Fetching tenders...'); // Лог для отладки
    return this.tenderModel.find().sort({ createdAt: -1 }).exec();
  }

  @Post('tenders') // POST /api/tenders
  async createTender(@Body() body: any) {
    console.log('Creating tender:', body);
    return this.tenderModel.create(body);
  }

  @Put('tenders/:id/close') // PUT /api/tenders/:id/close
  async closeTender(@Param('id') id: string, @Body() body: { winnerWallet: string, amount: number }) {
    return this.tenderModel.findByIdAndUpdate(id, {
        status: 'in_progress',
        winnerWallet: body.winnerWallet,
        finalAmount: body.amount
    }, { new: true });
  }

  @Put('tenders/:id/pay') // PUT /api/tenders/:id/pay
  async payTender(@Param('id') id: string) {
    return this.tenderModel.findByIdAndUpdate(id, { status: 'paid' }, { new: true });
  }

  @Put('tenders/:id/submit') // PUT /api/tenders/:id/submit
  async submitWork(@Param('id') id: string, @Body() body: { submission: string }) {
    console.log(`Work submitted for tender ${id}`);
    return this.tenderModel.findByIdAndUpdate(id, {
        workSubmission: body.submission,
        submittedAt: new Date(),
    }, { new: true });
  }

  // --- Bids ---
  @Get('tenders/:id/bids') // GET /api/tenders/:id/bids
  async getBids(@Param('id') id: string) {
    return this.bidModel.find({ tenderId: id }).exec();
  }

  @Post('bids') // POST /api/bids
  async createBid(@Body() body: any) {
    console.log('Creating bid:', body);
    return this.bidModel.create({ ...body, isDepositPaid: true });
  }

    // НОВЫЙ МЕТОД: Обновление ставки (без списания депозита)
  @Put('bids/:id')
  async updateBid(@Param('id') id: string, @Body() body: { amount: number }) {
    console.log(`Updating bid ${id} to amount: ${body.amount}`);
    return this.bidModel.findByIdAndUpdate(id, { amount: body.amount }, { new: true });
  }

  // НОВЫЙ МЕТОД: Отмена ставки
  @Delete('bids/:id')
  async deleteBid(@Param('id') id: string) {
    console.log(`Deleting bid ${id}`);
    return this.bidModel.findByIdAndDelete(id);
  }

  // --- Payroll ---
  @Get('employees')
  async getEmployees(@Query('employer') employer: string) {
    return this.employeeModel.find({ employerWallet: employer }).exec();
  }

  @Post('employees')
  async addEmployee(@Body() body: any) {
    return this.employeeModel.create(body);
  }

  @Delete('employees/:id')
  async removeEmployee(@Param('id') id: string) {
    return this.employeeModel.findByIdAndDelete(id);
  }

  // --- Invoices ---
  
  // Получить инвойсы (входящие или исходящие)
  @Get('invoices')
  async getInvoices(@Query('wallet') wallet: string, @Query('type') type: 'incoming' | 'outgoing') {
    if (type === 'outgoing') {
        return this.invoiceModel.find({ supplierWallet: wallet }).sort({ createdAt: -1 }).exec();
    } else {
        return this.invoiceModel.find({ buyerWallet: wallet }).sort({ createdAt: -1 }).exec();
    }
  }

  @Post('invoices')
  async createInvoice(@Body() body: any) {
    return this.invoiceModel.create({
        ...body,
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        status: 'pending'
    });
  }

  @Put('invoices/:id/pay')
  async payInvoice(@Param('id') id: string, @Body() body: { txHash: string }) {
    return this.invoiceModel.findByIdAndUpdate(id, { 
        status: 'paid',
        // В реале мы бы сохранили сюда txHash для верификации
    }, { new: true });
  }

  @Put('invoices/:id/cancel')
  async cancelInvoice(@Param('id') id: string) {
    return this.invoiceModel.findByIdAndUpdate(id, { status: 'cancelled' }, { new: true });
  }

}