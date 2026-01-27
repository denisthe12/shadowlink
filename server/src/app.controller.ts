// server/src/app.controller.ts
import { Body, Controller, Get, Param, Post, Put, Delete, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, Tender, Bid, Invoice, Employee } from './database/schemas';

// Данные ботов для авто-ставок
const MOCK_BOTS = [
    { wallet: 'BotWalletAlphaX123456789', name: 'Alpha Construction', industry: 'Construction', employees: 150 },
    { wallet: 'BotWalletBetaSoft98765432', name: 'Beta Software', industry: 'IT', employees: 45 },
    { wallet: 'BotWalletGammaLogistics77', name: 'Gamma Logistics', industry: 'Logistics', employees: 300 },
    { wallet: 'BotWalletDeltaDesigns555', name: 'Delta Designs', industry: 'Architecture', employees: 12 },
];

@Controller('api')
export class AppController {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Tender.name) private tenderModel: Model<Tender>,
    @InjectModel(Bid.name) private bidModel: Model<Bid>,
    @InjectModel(Invoice.name) private invoiceModel: Model<Invoice>,
    @InjectModel(Employee.name) private employeeModel: Model<Employee>,
  ) {
    this.initBots();
  }

  // Создаем ботов в БД, если их нет
  async initBots() {
      for (const bot of MOCK_BOTS) {
          const exists = await this.userModel.findOne({ walletAddress: bot.wallet });
          if (!exists) {
              await this.userModel.create({
                  walletAddress: bot.wallet,
                  isRegistered: true,
                  company: {
                      name: bot.name,
                      industry: bot.industry,
                      description: `Leading company in ${bot.industry}`,
                      employeesCount: bot.employees,
                      tendersCreated: Math.floor(Math.random() * 20),
                      tendersWon: Math.floor(Math.random() * 10)
                  }
              });
          }
      }
  }

  // ==========================================
  // USERS & CONTACTS (New Logic)
  // ==========================================

  // 1. "Логин" или получение профиля. Если нет - создаем.
  @Post('users/profile')
  async getUserProfile(@Body() body: { wallet: string }) {
    let user = await this.userModel.findOne({ walletAddress: body.wallet });
    if (!user) {
      user = await this.userModel.create({
        walletAddress: body.wallet,
        isRegistered: false,
        contacts: [],
        company: { name: '', description: '', industry: '', employeesCount: 0 }
      });
    }
    return user;
  }

  // НОВЫЙ МЕТОД: Обновление профиля компании
  @Put('users/profile')
  async updateCompanyProfile(@Body() body: { wallet: string, company: any }) {
    return this.userModel.findOneAndUpdate(
        { walletAddress: body.wallet },
        { company: body.company },
        { new: true }
    );
  }

  // 2. Проверка статуса ЛЮБОГО кошелька (для валидации Internal Transfer)
  @Get('users/:wallet/status')
  async getUserStatus(@Param('wallet') wallet: string) {
    const user = await this.userModel.findOne({ walletAddress: wallet });
    return { 
      exists: !!user, 
      isRegistered: user ? user.isRegistered : false 
    };
  }

  // 3. Активация пользователя после Депозита
  @Put('users/:wallet/register')
  async registerUser(@Param('wallet') wallet: string) {
    return this.userModel.findOneAndUpdate(
      { walletAddress: wallet },
      { isRegistered: true },
      { new: true, upsert: true } // Создаст, если не было
    );
  }

  // 4. Добавление контакта в адресную книгу
  @Post('users/:wallet/contacts')
  async addContact(@Param('wallet') wallet: string, @Body() body: { name: string, contactWallet: string }) {
    const user = await this.userModel.findOne({ walletAddress: wallet });
    if (!user) return null;

    // Проверяем дубликаты
    const exists = user.contacts.some(c => c.walletAddress === body.contactWallet);
    if (!exists) {
      user.contacts.push({ name: body.name, walletAddress: body.contactWallet });
      await user.save();
    }
    return user.contacts;
  }

  // 5. Получение контактов
  @Get('users/:wallet/contacts')
  async getContacts(@Param('wallet') wallet: string) {
    const user = await this.userModel.findOne({ walletAddress: wallet });
    return user ? user.contacts : [];
  }

  // ==========================================
  // OTHER MODULES (Existing Logic)
  // ==========================================

  // --- Tenders ---
  @Get('tenders')
  async getTenders() {
    return this.tenderModel.find().sort({ createdAt: -1 }).exec();
  }

  @Post('tenders')
  async createTender(@Body() body: any) {
    const tender = await this.tenderModel.create(body);
    
    // АВТО-ГЕНЕРАЦИЯ СТАВОК ОТ БОТОВ
    // Генерируем 4 ставки в диапазоне $10 - $85
    for (const bot of MOCK_BOTS) {
        // Случайная сумма (целое число или с копейками)
        const randomAmount = Math.floor(Math.random() * (85 - 10 + 1) + 10);
        
        await this.bidModel.create({
            tenderId: tender._id,
            bidderWallet: bot.wallet,
            bidderName: bot.name, // Сохраняем имя компании для удобства
            amount: randomAmount,
            isDepositPaid: true // Считаем, что боты оплатили депозит
        });
    }

    // Обновляем статистику создателя (+1 созданный тендер)
    await this.userModel.findOneAndUpdate(
        { walletAddress: body.creatorWallet },
        { $inc: { 'company.tendersCreated': 1 } }
    );

    return tender;
  }

  @Put('tenders/:id/close')
  async closeTender(@Param('id') id: string, @Body() body: { winnerWallet: string, amount: number }) {
    return this.tenderModel.findByIdAndUpdate(id, {
        status: 'in_progress',
        winnerWallet: body.winnerWallet,
        finalAmount: body.amount
    }, { new: true });
  }

  @Put('tenders/:id/submit')
  async submitWork(@Param('id') id: string, @Body() body: { submission: string, type: string, wallet: string }) {
    return this.tenderModel.findByIdAndUpdate(id, {
        workSubmission: body.submission,
        preferredPaymentType: body.type,
        preferredPaymentWallet: body.wallet,
        submittedAt: new Date(),
    }, { new: true });
  }

  @Put('tenders/:id/pay')
  async payTender(@Param('id') id: string) {
    const tender = await this.tenderModel.findByIdAndUpdate(id, { status: 'paid' }, { new: true });
    
    // Обновляем статистику победителя (+1 выигранный тендер)
    if (tender && tender.winnerWallet) {
        await this.userModel.findOneAndUpdate(
            { walletAddress: tender.winnerWallet },
            { $inc: { 'company.tendersWon': 1 } }
        );
    }
    return tender;
  }

  // --- Bids ---
  @Get('tenders/:id/bids')
  async getBids(@Param('id') id: string) {
    return this.bidModel.find({ tenderId: id }).exec();
  }

  @Post('bids')
  async createBid(@Body() body: any) {
    return this.bidModel.create({ ...body, isDepositPaid: true });
  }

  @Put('bids/:id')
  async updateBid(@Param('id') id: string, @Body() body: { amount: number }) {
    return this.bidModel.findByIdAndUpdate(id, { amount: body.amount }, { new: true });
  }

  @Delete('bids/:id')
  async deleteBid(@Param('id') id: string) {
    return this.bidModel.findByIdAndDelete(id);
  }

  // --- Invoices ---
  @Get('invoices')
  async getInvoices(@Query('wallet') wallet: string, @Query('type') type: 'incoming' | 'outgoing') {
    if (type === 'outgoing') {
        return this.invoiceModel.find({ supplierWallet: wallet }).sort({ createdAt: -1 }).exec();
    } else {
        return this.invoiceModel.find({ buyerWallet: wallet }).sort({ createdAt: -1 }).exec();
    }
  }

@ Post('invoices')
  async createInvoice(@Body() body: any) {
    return this.invoiceModel.create({
        ...body,
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        status: 'pending'
        // type придет в body автоматически
    });
  }

  @Put('invoices/:id/pay')
  async payInvoice(@Param('id') id: string, @Body() body: { txHash: string }) {
    return this.invoiceModel.findByIdAndUpdate(id, { status: 'paid' }, { new: true });
  }

  @Put('invoices/:id/cancel')
  async cancelInvoice(@Param('id') id: string) {
    return this.invoiceModel.findByIdAndUpdate(id, { status: 'cancelled' }, { new: true });
  }

  // --- Payroll ---
  @Get('employees')
  async getEmployees(@Query('employer') employer: string) {
    return this.employeeModel.find({ employerWallet: employer }).exec();
  }

  @Post('employees')
  async addEmployee(@Body() body: any) {
    // Валидация типа уже будет на фронте, но можно и тут добавить
    return this.employeeModel.create(body);
  }

  // НОВЫЙ МЕТОД: Редактирование сотрудника
  @Put('employees/:id')
  async updateEmployee(@Param('id') id: string, @Body() body: any) {
    return this.employeeModel.findByIdAndUpdate(id, body, { new: true });
  }

  @Delete('employees/:id')
  async removeEmployee(@Param('id') id: string) {
    return this.employeeModel.findByIdAndDelete(id);
  }
}