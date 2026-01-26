import React, { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { api } from '../utils/api';
import type {Invoice} from '../utils/api';
import { Plus, ArrowUpRight, ArrowDownLeft, CheckCircle, Search, XCircle, User, PiggyBank, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { ShadowWireClient } from '@radr/shadowwire';
import { Transaction } from '@solana/web3.js'; // Важно для подписи

const MOCK_USERS = [
    { wallet: '6AExadw4VtyHvC6p9B9n2LLBWz7MemzPb9V6kkkgrTkX', name: 'Government Corp' }, // Твой первый кошелек
    { wallet: '28dVMg5xb6B21herXZKCXoXd64y76FuUKKxHoWBYYZ8H', name: 'Bob Construction' }, // Твой второй кошелек
];

export const InvoiceModule = () => {
    const { connection } = useConnection();
    const { publicKey, signTransaction, signMessage } = useWallet();
    const [shadowClient] = useState(() => new ShadowWireClient({ debug: true }));

    const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [currentUser, setCurrentUser] = useState(MOCK_USERS[0]); 
    
    const [showCreate, setShowCreate] = useState(false);
    const [newInv, setNewInv] = useState({ buyerWallet: MOCK_USERS[1].wallet, amount: '', description: '' });

    useEffect(() => {
        if(currentUser) loadInvoices();
    }, [activeTab, currentUser]);

    const loadInvoices = async () => {
        try {
            const res = await api.getInvoices(currentUser.wallet, activeTab);
            setInvoices(res.data);
        } catch (e) { console.error(e); }
    };
    
    // --- НОВЫЕ ФУНКЦИИ: DEPOSIT и BALANCE CHECK ---
    
    const handleDeposit = async () => {
        if (!publicKey || !signTransaction) return toast.error("Connect wallet first!");
        
        const toastId = toast.loading("Creating deposit transaction...");
        try {
            // Адрес контракта USD1
            const USD1_MINT = 'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB';

            // 1. SDK создает неподписанную транзакцию
            const depositData = await shadowClient.deposit({
                wallet: publicKey.toBase58(),
                amount: 8200000, // 0.1 USD1 
                token_mint: USD1_MINT
            });

            // 2. "Оживляем" транзакцию
            const transaction = Transaction.from(Buffer.from(depositData.unsigned_tx_base64, 'base64'));
            
            // 3. Получаем свежий blockhash (ТРЕБОВАНИЕ НОВОГО API)
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey; // Явно указываем плательщика комиссии

            // 4. Просим Phantom подписать
            toast.loading("Please sign in your wallet...", { id: toastId });
            const signedTransaction = await signTransaction(transaction);

            // 5. Отправляем в блокчейн
            toast.loading("Sending to Solana Mainnet...", { id: toastId });
            const signature = await connection.sendRawTransaction(signedTransaction.serialize());

            // 6. Ждем подтверждения (НОВЫЙ СИНТАКСИС)
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed');

            toast.success("Deposit successful! You are now in the shielded pool.", { id: toastId });
            handleCheckBalance();
        } catch (e: any) {
            console.error(e);
            toast.error("Deposit failed: " + e.message, { id: toastId });
        }
    };

    const handleCheckBalance = async () => {
        if (!publicKey) return toast.error("Connect wallet first!");
        try {
            const balance = await shadowClient.getBalance(publicKey.toBase58(), 'USD1');
            const depositedAmount = balance.deposited / 1e6; // У USD1 6 знаков
            toast.success(`Shielded Balance: ${depositedAmount.toFixed(2)} USD1`);
        } catch (e: any) {
            toast.error("Failed to fetch balance.");
        }
    };

    // --- ОБНОВЛЕННАЯ ФУНКЦИЯ ОПЛАТЫ ---

    const handlePay = async (inv: Invoice) => {
        if (!publicKey || !signMessage) return toast.error("Connect wallet first!");
        const toastId = toast.loading("Initiating INTERNAL (Private) Transfer...");
        
        try {
            // Теперь используем `internal`
            const result = await shadowClient.transfer({
                sender: publicKey.toBase58(),
                recipient: inv.supplierWallet,
                amount: inv.totalAmount, // Отправляем реальную сумму
                token: 'USD1',
                type: 'external', // <--- ГЛАВНОЕ ИЗМЕНЕНИЕ
                wallet: { signMessage }  // Передаем подпись
            });

            console.log('AMOUNT:', inv.totalAmount)
            console.log (result)
            
            if (result.success && result.tx_signature) {
                await api.payInvoice(inv._id, result.tx_signature);
                loadInvoices();
                toast.success(`Private payment sent! Tx: ${result.tx_signature.slice(0, 8)}...`, { id: toastId });
            } else {
                throw new Error((result as any).error || "Transaction failed");
            }
        } catch (e: any) {
            console.error(e);
            toast.error(`Transfer Failed: ${e.message}`, { id: toastId });
        }
    };

    // ... (остальные функции handleCreate, handleCancel, getUserName без изменений)
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await api.createInvoice({
            supplierWallet: currentUser.wallet,
            buyerWallet: newInv.buyerWallet,
            totalAmount: Number(newInv.amount),
            description: newInv.description
        });
        setShowCreate(false);
        setNewInv({ buyerWallet: MOCK_USERS[0].wallet, amount: '', description: '' });
        loadInvoices();
        toast.success("Invoice sent!");
    };
    const handleCancel = async (inv: Invoice) => {
        if (!confirm("Cancel this invoice?")) return;
        await api.cancelInvoice(inv._id);
        loadInvoices();
        toast.success("Invoice cancelled");
    };
    const getUserName = (wallet: string) => MOCK_USERS.find(u => u.wallet === wallet)?.name || wallet.slice(0,8)+'...';


    return (
        <div className="space-y-6">
            {/* ... (Переключатель юзеров) */}
            <div className="bg-slate-800 text-white p-3 rounded-lg flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm">
                    <User size={16} className="text-emerald-400"/>
                    <span className="text-slate-400">Invoice View as:</span>
                    <select 
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-emerald-400 font-bold outline-none cursor-pointer"
                        value={currentUser.wallet}
                        onChange={(e) => setCurrentUser(MOCK_USERS.find(u => u.wallet === e.target.value) || MOCK_USERS[1])}
                    >
                        {MOCK_USERS.map(u => (
                            <option key={u.wallet} value={u.wallet}>{u.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* --- НОВЫЙ БЛОК: Управление Депозитом --- */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-600 font-medium">To use private transfers, deposit funds into the Shielded Pool first.</p>
                <div className="flex gap-2">
                    <button onClick={handleCheckBalance} className="text-slate-500 hover:text-emerald-600 px-4 py-2 font-bold text-sm flex items-center gap-2">
                        <Wallet size={16}/> Check Shielded Balance
                    </button>
                    <button onClick={handleDeposit} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-emerald-700">
                        <PiggyBank size={16}/> Deposit 0.1 USD1
                    </button>
                </div>
            </div>
            
            {/* ... (остальной JSX без изменений: Header Controls, Invoices List, Modals) ... */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('incoming')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'incoming' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                        Incoming
                    </button>
                    <button onClick={() => setActiveTab('outgoing')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'outgoing' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>
                        Outgoing
                    </button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowCreate(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200">
                        <Plus size={16}/> New Invoice
                    </button>
                </div>
            </div>

            <div className="grid gap-4">
                {invoices.map(inv => (
                    <div key={inv._id} className={`bg-white p-5 rounded-xl border flex justify-between items-center transition-all ${inv.status === 'cancelled' ? 'opacity-60 border-slate-100' : 'border-slate-200 hover:border-emerald-300 hover:shadow-md'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${activeTab === 'incoming' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                {activeTab === 'incoming' ? <ArrowDownLeft /> : <ArrowUpRight />}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-lg">{inv.description}</h4>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                    <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">#{inv.invoiceNumber}</span>
                                    <span>• {new Date(inv.createdAt).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-1">
                                        • <User size={12}/> {activeTab === 'incoming' ? `From: ${getUserName(inv.supplierWallet)}` : `To: ${getUserName(inv.buyerWallet)}`}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="text-right flex items-center gap-6">
                            <div>
                                <p className="font-black text-xl text-slate-900">${inv.totalAmount.toLocaleString()}</p>
                                <p className={`text-xs font-bold uppercase tracking-wider ${
                                    inv.status === 'paid' ? 'text-emerald-500' : 
                                    inv.status === 'cancelled' ? 'text-slate-400' : 'text-amber-500'
                                }`}>{inv.status}</p>
                            </div>

                            {/* ACTIONS */}
                            {inv.status === 'pending' && (
                                <div className="flex gap-2">
                                    {activeTab === 'incoming' ? (
                                        <button onClick={() => handlePay(inv)} className="bg-slate-900 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 shadow-lg">
                                            Pay Now
                                        </button>
                                    ) : (
                                        <button onClick={() => handleCancel(inv)} className="text-slate-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors" title="Cancel Invoice">
                                            <XCircle />
                                        </button>
                                    )}
                                    {/* Получатель тоже может отменить, если это ошибочный счет */}
                                    {activeTab === 'incoming' && (
                                         <button onClick={() => handleCancel(inv)} className="text-slate-400 hover:text-red-500 p-2" title="Decline">
                                            <XCircle size={20}/>
                                         </button>
                                    )}
                                </div>
                            )}
                            
                            {inv.status === 'paid' && <div className="text-emerald-500"><CheckCircle size={28} /></div>}
                        </div>
                    </div>
                ))}
                {invoices.length === 0 && <div className="text-center py-12 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-300">No invoices found in this category.</div>}
            </div>

            {showCreate && (
                <div className="fixed top-0 left-0 w-full h-full z-[100] flex items-center justify-center p-4 !m-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}></div>
                    <form onSubmit={handleCreate} className="bg-white p-8 rounded-2xl w-full max-w-md relative z-10 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-xl text-slate-800">New Invoice</h3>
                            <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Bill To</label>
                            <select 
                                className="w-full border p-3 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500"
                                value={newInv.buyerWallet}
                                onChange={e => setNewInv({...newInv, buyerWallet: e.target.value})}
                            >
                                {MOCK_USERS.filter(u => u.wallet !== currentUser.wallet).map(u => (
                                    <option key={u.wallet} value={u.wallet}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                            <input required placeholder="e.g. Server Hosting (April)" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" value={newInv.description} onChange={e => setNewInv({...newInv, description: e.target.value})} />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Amount (USD)</label>
                            <input required type="number" placeholder="5000" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-mono" value={newInv.amount} onChange={e => setNewInv({...newInv, amount: e.target.value})} />
                        </div>

                        <button className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 shadow-lg mt-2">Create & Send Invoice</button>
                    </form>
                </div>
            )}
        </div>
    );
};