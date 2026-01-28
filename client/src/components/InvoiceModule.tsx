import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '../utils/api'; // Переименовали тип User в ApiUser
import type {Invoice, User as ApiUser, Contact} from '../utils/api';
import { Plus, ArrowUpRight, ArrowDownLeft, CheckCircle, Search, XCircle, User as UserIcon, Book, UserPlus, Globe, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useShadowWire } from '../hooks/useShadowWire';
import { useUser } from '../hooks/useUser';
import { saveTxToHistory } from './TransactionHistory'; // Импортируй

interface InvoiceModuleProps {
    user: ApiUser | null;
}

export const InvoiceModule = ({ user }: InvoiceModuleProps) => {
    const { publicKey, signMessage } = useWallet();
    const { client: shadowClient } = useShadowWire();
    const { refreshUser } = useUser(); // Достаем функцию обновления юзера

    const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    
    // Форма создания
    const [showCreate, setShowCreate] = useState(false);
    const [newInv, setNewInv] = useState({ buyerWallet: '', amount: '', description: '', type: 'external' as 'internal' | 'external' });
    const [recipientName, setRecipientName] = useState<string | null>(null);

    // Контакты
    const [showContacts, setShowContacts] = useState(false);
    const [newContact, setNewContact] = useState({ name: '', address: '' });

    // Верификация
    const [showVerify, setShowVerify] = useState(false);
    const [verifyHash, setVerifyHash] = useState('');

    useEffect(() => {
        if(user) loadInvoices();
    }, [activeTab, user]);

    // Авто-определение имени при вводе адреса (Пункт 5)
    useEffect(() => {
        if (newInv.buyerWallet && user) {
            const contact = user.contacts.find(c => c.walletAddress === newInv.buyerWallet);
            setRecipientName(contact ? contact.name : null);
        } else {
            setRecipientName(null);
        }
    }, [newInv.buyerWallet, user]);

    const loadInvoices = async () => {
        if (!user) return;
        try {
            const res = await api.getInvoices(user.walletAddress, activeTab);
            setInvoices(res.data);
        } catch (e) { console.error(e); }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // ПРОВЕРКА ДЛЯ INTERNAL ПЕРЕВОДА
        if (newInv.type === 'internal') {
            const toastId = toast.loading("Verifying participants...");
            
            // 1. Проверяем СЕБЯ (Создателя инвойса / Получателя денег)
            if (!user.isRegistered) {
                toast.error("YOU are not registered in ShadowWire. Make a deposit first to accept Internal transfers.", { id: toastId });
                return;
            }

            // 2. Проверяем ПЛАТЕЛЬЩИКА (Того, кому выставляем)
            try {
                const status = await api.checkUserStatus(newInv.buyerWallet);
                
                if (!status.data.exists || !status.data.isRegistered) {
                    toast.error("Recipient (Payer) is NOT registered. They cannot pay via Internal Transfer.", { id: toastId });
                    return;
                }
                toast.success("Both parties verified!", { id: toastId });
            } catch (e) {
                toast.error("Verification failed", { id: toastId });
                return;
            }
        }

        await api.createInvoice({
            supplierWallet: user.walletAddress,
            buyerWallet: newInv.buyerWallet,
            totalAmount: Number(newInv.amount),
            description: newInv.description,
            type: newInv.type
        });
        
        setShowCreate(false);
        setNewInv({ buyerWallet: '', amount: '', description: '', type: 'external' });
        loadInvoices();
        toast.success("Invoice sent!");
    };

    const handlePay = async (inv: Invoice) => {
        if (!publicKey || !signMessage) return toast.error("Connect wallet first!");
        
        // Берем тип ИЗ ИНВОЙСА. Никакой самодеятельности.
        const transferType = inv.type; 

        const toastId = toast.loading(`Initiating ${transferType.toUpperCase()} Transfer...`);
        
        try {
            console.log(`🚀 Starting ShadowWire ${transferType} transfer...`);
            
            const result = await shadowClient.transfer({
                sender: publicKey.toBase58(),
                recipient: inv.supplierWallet,
                amount: Number(inv.totalAmount), 
                token: 'USD1',
                type: transferType, // Используем тип из инвойса
                wallet: { signMessage }
            });

            console.log("✅ SDK Result:", result);
            
            if (result.tx_signature) {
                await api.payInvoice(inv._id, result.tx_signature);
                loadInvoices();
                
                if (result.success) {
                     toast.success(`Payment successful!`, { id: toastId });
                     saveTxToHistory(result.tx_signature, 'Invoice Payment');
                } else {
                     console.warn("Tx broadcasted with warnings:", (result as any).error);
                     toast.success(`Transaction Broadcasted!`, { id: toastId });
                }
            } else {
                throw new Error((result as any).error || "Transaction failed");
            }
        } catch (e: any) {
            console.error(e);
            toast.error(`Transfer Failed: ${e.message}`, { id: toastId });
        }
    };

    const handleCancel = async (inv: Invoice) => {
        if (!confirm("Cancel this invoice?")) return;
        await api.cancelInvoice(inv._id);
        loadInvoices();
        toast.success("Invoice cancelled");
    };

    const handleAddContact = async () => {
        if (!user || !newContact.name || !newContact.address) return;
        await api.addContact(user.walletAddress, newContact.name, newContact.address);
        
        // ПРАВКА (Пункт 4): Обновляем юзера через хук, чтобы список обновился сразу
        await refreshUser(); 
        
        setShowContacts(false);
        setNewInv({...newInv, buyerWallet: newContact.address});
        setNewContact({ name: '', address: '' });
        toast.success("Contact added!");
    };

    const getContactName = (wallet: string) => {
        const contact = user?.contacts.find(c => c.walletAddress === wallet);
        return contact ? contact.name : wallet.slice(0, 6) + '...' + wallet.slice(-4);
    };

    return (
        <div className="space-y-6">
            
            {/* Header Controls */}
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
                    <button onClick={() => setShowVerify(true)} className="text-slate-500 hover:text-emerald-600 px-4 py-2 font-bold text-sm flex items-center gap-2">
                        <Search size={16}/> Verify Proof
                    </button>
                    <button onClick={() => setShowCreate(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200">
                        <Plus size={16}/> New Invoice
                    </button>
                </div>
            </div>

            {/* Invoices List */}
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
                                    <span className={`px-2 py-0.5 rounded uppercase font-bold text-[10px] ${inv.type === 'internal' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {inv.type}
                                    </span>
                                    <span>• {new Date(inv.createdAt).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-1">
                                        • <UserIcon size={12}/> {activeTab === 'incoming' ? `From: ${getContactName(inv.supplierWallet)}` : `To: ${getContactName(inv.buyerWallet)}`}
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

            {/* CREATE MODAL */}
            {showCreate && (
                <div className="fixed top-0 left-0 w-full h-full z-[100] flex items-center justify-center p-4 !m-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}></div>
                    <form onSubmit={handleCreate} className="bg-white p-8 rounded-2xl w-full max-w-md relative z-10 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-xl text-slate-800">New Invoice</h3>
                            <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        
                        {/* ПУНКТ 2 и 5: Улучшенный Input с кнопкой внутри и авто-именем */}
                        <div className="space-y-1 relative">
                            <div className="flex justify-between items-end mb-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Bill To (Wallet Address)</label>
                                {recipientName && (
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                                        <CheckCircle size={10}/> {recipientName}
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <input 
                                    required 
                                    placeholder="Paste Solana Address" 
                                    className="w-full border p-3 pr-10 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs" 
                                    value={newInv.buyerWallet} 
                                    onChange={e => setNewInv({...newInv, buyerWallet: e.target.value})} 
                                />
                                <button type="button" onClick={() => setShowContacts(true)} className="absolute right-2 top-2.5 text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-slate-100 transition-colors">
                                    <Book size={18}/>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                            <input required placeholder="e.g. Server Hosting (April)" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" value={newInv.description} onChange={e => setNewInv({...newInv, description: e.target.value})} />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Amount (USD1)</label>
                            <input required type="number" placeholder="0.00" step="0.01" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-mono" value={newInv.amount} onChange={e => setNewInv({...newInv, amount: e.target.value})} />
                        </div>

                        {/* ПУНКТ 6: Выбор Типа Перевода */}
                        <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-lg">
                            <button 
                                type="button" 
                                onClick={() => setNewInv({...newInv, type: 'external'})}
                                className={`flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${newInv.type === 'external' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                            >
                                <Globe size={14}/> External
                            </button>
                            <button 
                                type="button"
                                // Добавляем проверку: если я не зарегистрирован, кнопка не работает
                                onClick={() => user?.isRegistered ? setNewInv({...newInv, type: 'internal'}) : toast.error("Please make a deposit to enable Internal Transfers")}
                                className={`flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${
                                    !user?.isRegistered ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400' : // Стили для отключенной кнопки
                                    newInv.type === 'internal' ? 'bg-white shadow text-emerald-700' : 'text-slate-500'
                                }`}
                            >
                                <Lock size={14}/> Internal (Private)
                            </button>
                        </div>

                        <button className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 shadow-lg mt-2">Send Invoice</button>
                    </form>
                </div>
            )}

            {/* CONTACTS MODAL */}
            {showContacts && (
                <div className="fixed top-0 left-0 w-full h-full z-[110] flex items-center justify-center p-4 !m-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowContacts(false)}></div>
                    <div className="bg-white p-6 rounded-2xl w-full max-w-md relative z-10 space-y-4 animate-in zoom-in-95 shadow-xl">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-lg">Address Book</h3>
                            <button onClick={() => setShowContacts(false)}><XCircle className="text-slate-300 hover:text-slate-500"/></button>
                        </div>
                        
                        {/* ПУНКТ 3: Больше места для адреса */}
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                            {user?.contacts.map((c, i) => (
                                <button key={i} onClick={() => { setNewInv({...newInv, buyerWallet: c.walletAddress}); setShowContacts(false); }} className="w-full text-left p-4 hover:bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-200 flex justify-between items-center group transition-all">
                                    <div className="w-full overflow-hidden">
                                        <p className="font-bold text-slate-900 mb-1">{c.name}</p>
                                        <p className="text-xs text-slate-500 font-mono bg-slate-100 p-1.5 rounded truncate">{c.walletAddress}</p>
                                    </div>
                                    <ArrowUpRight size={16} className="text-slate-300 group-hover:text-emerald-500 shrink-0 ml-3"/>
                                </button>
                            ))}
                            {user?.contacts.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No contacts yet.</p>}
                        </div>

                        <div className="border-t pt-4 space-y-3">
                            <p className="text-xs font-bold text-slate-400 uppercase">Add New Contact</p>
                            <input placeholder="Name (e.g. Alice)" className="w-full border p-2.5 rounded-lg text-sm outline-none focus:border-emerald-500" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
                            <input placeholder="Wallet Address" className="w-full border p-2.5 rounded-lg text-sm font-mono outline-none focus:border-emerald-500" value={newContact.address} onChange={e => setNewContact({...newContact, address: e.target.value})} />
                            <button onClick={handleAddContact} className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-slate-800 flex items-center justify-center gap-2 shadow-md">
                                <UserPlus size={16}/> Save Contact
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VERIFY MODAL (Без изменений) */}
            {showVerify && (
                <div className="fixed top-0 left-0 w-full h-full z-[100] flex items-center justify-center p-4 !m-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowVerify(false)}></div>
                    <div className="bg-white p-8 rounded-2xl w-full max-w-lg relative z-10 text-center space-y-6">
                        <div className="inline-block p-4 bg-emerald-50 rounded-full">
                            <Search size={32} className="text-emerald-500" />
                        </div>
                        <h3 className="font-bold text-2xl">Payment Proof Verification</h3>
                        <p className="text-slate-500">Paste a transaction signature to verify payment validity without revealing the amount.</p>
                        <input 
                            placeholder="Paste Tx Signature..." 
                            className="w-full border p-4 rounded-xl font-mono text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500"
                            value={verifyHash}
                            onChange={e => setVerifyHash(e.target.value)}
                        />
                        {verifyHash.length > 10 && (
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-left animate-in fade-in slide-in-from-bottom-2">
                                <p className="font-bold text-emerald-800 flex items-center gap-2"><CheckCircle size={16}/> Valid ShadowWire Transaction</p>
                                <p className="text-xs text-emerald-600 mt-1 font-mono">
                                    Status: VERIFIED_ON_CHAIN<br/>
                                    Amount: [HIDDEN_BY_ZK_PROOF]
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};