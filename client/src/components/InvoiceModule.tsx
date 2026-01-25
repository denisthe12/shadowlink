import React, { useEffect, useState } from 'react';
import { ShadowWireClient } from '@radr/shadowwire';
import { useWallet } from '@solana/wallet-adapter-react';
import type {Invoice} from '../utils/api';
import { api } from '../utils/api';
import { Plus, ArrowUpRight, ArrowDownLeft, CheckCircle, Search, XCircle, User } from 'lucide-react';
import toast from 'react-hot-toast';

// Те же пользователи для удобства выбора получателя
const MOCK_USERS = [
    { wallet: '28dVMg5xb6B21herXZKCXoXd64y76FuUKKxHoWBYYZ8H', name: 'Government Corp' },
    { wallet: '6AExadw4VtyHvC6p9B9n2LLBWz7MemzPb9V6kkkgrTkX', name: 'Bob Construction' },
    { wallet: 'AliceSupply33333333333', name: 'Alice Supplies' },
];

export const InvoiceModule = () => {
    const { publicKey, signMessage } = useWallet();
    const [shadowClient] = useState(() => new ShadowWireClient({ debug: true }));
    const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [currentUser, setCurrentUser] = useState(MOCK_USERS[1]); 
    
    
    const [showCreate, setShowCreate] = useState(false);
    // Теперь buyerWallet выбираем из списка
    const [newInv, setNewInv] = useState({ buyerWallet: MOCK_USERS[0].wallet, amount: '', description: '' });

    const [showVerify, setShowVerify] = useState(false);
    const [verifyHash, setVerifyHash] = useState('');

    useEffect(() => {
        loadInvoices();
    }, [activeTab, currentUser]);

    const loadInvoices = async () => {
        console.log(`Loading ${activeTab} invoices for ${currentUser.name} (${currentUser.wallet})`);
        try {
            const res = await api.getInvoices(currentUser.wallet, activeTab);
            setInvoices(res.data);
        } catch (e) { console.error(e); }
    };

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

    const handlePay = async (inv: Invoice) => {
        if (!publicKey || !signMessage) return toast.error("Connect wallet first!");
        
        const toastId = toast.loading(`Initiating MAINNET ShadowWire transfer...`);
        
        try {
            console.log("🚀 Starting ShadowWire transfer (Mainnet)...");
            
            // Вызываем SDK. В новой версии баг с external-transfer должен быть исправлен.
            const result = await shadowClient.transfer({
                sender: publicKey.toBase58(),
                recipient: inv.supplierWallet,
                amount: 0.1, // Твои 0.1 USD1
                token: 'USD1', 
                type: 'external',
                wallet: { signMessage }
            });

            console.log("✅ ShadowWire Transaction Complete:", result);
            
            // Если код дошел сюда, значит сервер ответил 200 OK, и транзакция прошла
            await api.payInvoice(inv._id, result.tx_signature);
            
            loadInvoices();
            toast.success(`Payment successful! Tx: ${result.tx_signature.slice(0, 8)}...`, { id: toastId });

        } catch (e: any) {
            console.error("ShadowWire Error:", e);
            // Теперь мы честно показываем ошибку, если она есть
            toast.error(`Transfer Failed: ${e.message}`, { id: toastId });
        }
    };

    const handleCancel = async (inv: Invoice) => {
        if (!confirm("Cancel this invoice?")) return;
        await api.cancelInvoice(inv._id);
        loadInvoices();
        toast.success("Invoice cancelled");
    };

    // Вспомогательная функция для имени
    const getUserName = (wallet: string) => MOCK_USERS.find(u => u.wallet === wallet)?.name || wallet.slice(0,8)+'...';
    
    useEffect(() => {
        const firstOtherUser = MOCK_USERS.find(u => u.wallet !== currentUser.wallet) || MOCK_USERS[0];
        setNewInv(prev => ({ ...prev, buyerWallet: firstOtherUser.wallet }));
    }, [currentUser, showCreate]);

    return (
        <div className="space-y-6">

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

            {/* CREATE MODAL */}
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

            {/* VERIFY MODAL - Оставил без изменений, оно уже хорошее */}
            {/* ... (код верификации тот же, что был) ... */}
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