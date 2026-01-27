import axios from 'axios';

const API_URL = 'http://localhost:3000/api'; 

export interface Contact {
    name: string;
    walletAddress: string;
}

export interface CompanyProfile {
    name: string;
    description: string;
    industry: string;
    employeesCount: number;
    tendersCreated: number;
    tendersWon: number;
}

export interface User {
    _id: string;
    walletAddress: string;
    isRegistered: boolean;
    contacts: Contact[];
    company?: CompanyProfile; // ДОБАВИЛИ ЭТО ПОЛЕ
}

// ... Остальные интерфейсы (Tender, Bid, Invoice, Employee) без изменений ...
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
    deadline: string;
    workSubmission?: string;
    preferredPaymentType?: 'internal' | 'external';
    preferredPaymentWallet?: string;
}

export interface Bid {
    _id: string;
    tenderId: string;
    bidderWallet: string;
    bidderName: string;
    amount: number;
    isDepositPaid: boolean;
}

export interface Invoice {
    _id: string;
    invoiceNumber: string;
    supplierWallet: string;
    buyerWallet: string;
    totalAmount: number;
    status: 'pending' | 'paid' | 'cancelled';
    description: string;
    type: 'internal' | 'external';
    createdAt: string;
}

export interface Employee {
    _id: string;
    name: string;
    walletAddress: string;
    salary: number;
    employerWallet: string;
}

export const api = {
    // Users
    getProfile: (wallet: string) => axios.post<User>(`${API_URL}/users/profile`, { wallet }),
    updateProfile: (wallet: string, company: any) => axios.put<User>(`${API_URL}/users/profile`, { wallet, company }), // ДОБАВИЛИ ЭТОТ МЕТОД
    checkUserStatus: (wallet: string) => axios.get<{ exists: boolean, isRegistered: boolean }>(`${API_URL}/users/${wallet}/status`),
    registerUser: (wallet: string) => axios.put(`${API_URL}/users/${wallet}/register`),
    addContact: (wallet: string, name: string, contactWallet: string) => axios.post<Contact[]>(`${API_URL}/users/${wallet}/contacts`, { name, contactWallet }),
    getContacts: (wallet: string) => axios.get<Contact[]>(`${API_URL}/users/${wallet}/contacts`),

    // Tenders
    getTenders: () => axios.get<Tender[]>(`${API_URL}/tenders`),
    createTender: (data: any) => axios.post<Tender>(`${API_URL}/tenders`, data),
    selectWinner: (tenderId: string, winnerWallet: string, amount: number) => axios.put(`${API_URL}/tenders/${tenderId}/close`, { winnerWallet, amount }),
    payTender: (tenderId: string) => axios.put(`${API_URL}/tenders/${tenderId}/pay`),
    submitWork: (tenderId: string, submission: string, type: string, wallet: string) => 
        axios.put(`${API_URL}/tenders/${tenderId}/submit`, { submission, type, wallet }),

    // Bids
    getBids: (tenderId: string) => axios.get<Bid[]>(`${API_URL}/tenders/${tenderId}/bids`),
    placeBid: (data: Partial<Bid>) => axios.post<Bid>(`${API_URL}/bids`, data),
    updateBid: (bidId: string, amount: number) => axios.put<Bid>(`${API_URL}/bids/${bidId}`, { amount }),
    deleteBid: (bidId: string) => axios.delete(`${API_URL}/bids/${bidId}`),

    // Invoices
    getInvoices: (wallet: string, type: 'incoming' | 'outgoing') => axios.get<Invoice[]>(`${API_URL}/invoices?wallet=${wallet}&type=${type}`),
    createInvoice: (data: Partial<Invoice>) => axios.post<Invoice>(`${API_URL}/invoices`, data),
    payInvoice: (id: string, txHash: string) => axios.put(`${API_URL}/invoices/${id}/pay`, { txHash }),
    cancelInvoice: (id: string) => axios.put(`${API_URL}/invoices/${id}/cancel`),

    // Payroll
    getEmployees: (employerWallet: string) => axios.get<Employee[]>(`${API_URL}/employees?employer=${employerWallet}`),
    addEmployee: (data: Partial<Employee>) => axios.post<Employee>(`${API_URL}/employees`, data),
    
    // НОВЫЙ МЕТОД:
    updateEmployee: (id: string, data: Partial<Employee>) => axios.put<Employee>(`${API_URL}/employees/${id}`, data),
    
    removeEmployee: (id: string) => axios.delete(`${API_URL}/employees/${id}`),
};