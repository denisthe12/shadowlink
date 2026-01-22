// client/src/utils/api.ts
import axios from 'axios';

const API_URL = 'http://localhost:3000/api'; 

export interface Tender {
    _id: string;
    title: string;
    description: string;
    maxBudget: number;
    status: 'open' | 'in_progress' | 'completed' | 'paid';
    creatorWallet: string;
    winnerWallet?: string;
    finalAmount?: number;
    createdAt: string;
    deadline: string; // НОВОЕ ПОЛЕ (приходит строкой из JSON)
    workSubmission?: string; // Добавляем опциональное поле
    submittedAt?: string;
}

export interface Bid {
    _id: string;
    tenderId: string;
    bidderWallet: string;
    bidderName: string;
    amount: number;
    isDepositPaid: boolean;
}

export interface User {
    _id: string;
    walletAddress: string;
    name: string;
    role: 'gov' | 'supplier' | 'employee';
}

export interface Employee {
    _id: string;
    name: string;
    walletAddress: string;
    salary: number;
    employerWallet: string;
}

export interface Invoice {
    _id: string;
    invoiceNumber: string;
    supplierWallet: string;
    buyerWallet: string;
    totalAmount: number;
    status: 'pending' | 'paid' | 'cancelled';
    description: string; // Нужно добавить в схему на бэке, если нет
    createdAt: string;
}

export const api = {
    // Users
    getUsers: () => axios.get<User[]>(`${API_URL}/users`),
    login: (wallet: string, role?: string) => axios.post<User>(`${API_URL}/users/login`, { wallet, role }),

    // Tenders
    getTenders: () => axios.get<Tender[]>(`${API_URL}/tenders`),
    createTender: (data: Omit<Tender, '_id' | 'createdAt'> | { deadline: Date | string }) => axios.post<Tender>(`${API_URL}/tenders`, data),
    selectWinner: (tenderId: string, winnerWallet: string, amount: number) => 
        axios.put(`${API_URL}/tenders/${tenderId}/close`, { winnerWallet, amount }),
    payTender: (tenderId: string) => axios.put(`${API_URL}/tenders/${tenderId}/pay`),

    // Bids
    getBids: (tenderId: string) => axios.get<Bid[]>(`${API_URL}/tenders/${tenderId}/bids`),
    placeBid: (data: Partial<Bid>) => axios.post<Bid>(`${API_URL}/bids`, data),

    // НОВЫЕ МЕТОДЫ:
    updateBid: (bidId: string, amount: number) => axios.put<Bid>(`${API_URL}/bids/${bidId}`, { amount }),
    deleteBid: (bidId: string) => axios.delete(`${API_URL}/bids/${bidId}`),
    submitWork: (tenderId: string, submission: string) => axios.put(`${API_URL}/tenders/${tenderId}/submit`, { submission }),

    // Payroll
    getEmployees: (employerWallet: string) => axios.get<Employee[]>(`${API_URL}/employees?employer=${employerWallet}`),
    addEmployee: (data: Partial<Employee>) => axios.post<Employee>(`${API_URL}/employees`, data),
    removeEmployee: (id: string) => axios.delete(`${API_URL}/employees/${id}`),
    getInvoices: (wallet: string, type: 'incoming' | 'outgoing') => 
        axios.get<Invoice[]>(`${API_URL}/invoices?wallet=${wallet}&type=${type}`),
    createInvoice: (data: Partial<Invoice>) => axios.post<Invoice>(`${API_URL}/invoices`, data),
    payInvoice: (id: string, txHash: string) => axios.put(`${API_URL}/invoices/${id}/pay`, { txHash }),
    cancelInvoice: (id: string) => axios.put(`${API_URL}/invoices/${id}/cancel`),
};