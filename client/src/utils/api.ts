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
};