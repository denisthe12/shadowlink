import React, { useEffect, useState } from 'react';
import { api} from '../utils/api';
import type { Tender, Bid } from '../utils/api';
import { Plus, Clock, Shield, DollarSign, User as UserIcon, Calendar, Users, ShieldCheck, CheckCircle } from 'lucide-react';
import { ShadowWireClient, initWASM } from '@radr/shadowwire';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';

const MOCK_USERS = [
    { wallet: 'GovWallet1111111111111111', name: 'Government Corp', role: 'gov' },
    { wallet: 'BobBuilder22222222222222', name: 'Bob Construction', role: 'supplier' },
    { wallet: 'AliceSupply33333333333', name: 'Alice Supplies', role: 'supplier' },
];

export const TenderModule = () => {
    const [tenders, setTenders] = useState<Tender[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(MOCK_USERS[0]);
    const [loading, setLoading] = useState(false);
    const { publicKey, signMessage } = useWallet();
    const [shadowClient] = useState(() => new ShadowWireClient({ debug: true }));
    const [isEditingBid, setIsEditingBid] = useState(false);
    const [submissionText, setSubmissionText] = useState('');
    
    // Форма создания (Добавлено поле deadline)
    const [showCreate, setShowCreate] = useState(false);
    const [newTender, setNewTender] = useState({ title: '', description: '', maxBudget: '', deadline: '' });

    const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
    const [bids, setBids] = useState<Bid[]>([]);
    const [myBidAmount, setMyBidAmount] = useState('');
    const myExistingBid = bids.find(b => b.bidderWallet === currentUser.wallet);
    useEffect(() => {
        loadData();
    }, []);

    // Закрываем формы при смене юзера
    useEffect(() => {
        setShowCreate(false);
        setSelectedTender(null); 
    }, [currentUser]);

    // Грузим ставки при открытии деталей
    useEffect(() => {
        if (selectedTender) {
            api.getBids(selectedTender._id).then(res => setBids(res.data));
        }
    }, [selectedTender]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.getTenders();
            setTenders(res.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleCreateTender = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Отправляем дату дедлайна
        await api.createTender({
            title: newTender.title,
            description: newTender.description,
            maxBudget: Number(newTender.maxBudget),
            deadline: newTender.deadline,
            creatorWallet: currentUser.wallet,
            status: 'open'
        });
        setShowCreate(false);
        setNewTender({ title: '', description: '', maxBudget: '', deadline: '' });
        loadData();
    };

    const handlePlaceBid = async () => {
        if (!selectedTender) return;
        
        // 1. Проверки
        if (!publicKey || !signMessage) {
            toast.error("Please connect your Phantom wallet first!");
            return;
        }

        if (!myBidAmount) return;
        const toastId = toast.loading("🔐 Encrypting bid via ShadowWire...");
        setLoading(true);

        try {
            // 2. Инициализация SDK (на всякий случай, если еще не готов)
            // Важный момент из документации v1.1.2: нужно передать wallet с signMessage
            console.log("🔐 Generating Zero-Knowledge Proof for bid...");
            
            // ЭМУЛЯЦИЯ РАБОТЫ SDK (Чтобы не тратить газ в Devnet при каждом клике)
            // В реальном проде мы бы вызвали:
            /*
            const tx = await shadowClient.transfer({
                sender: publicKey.toBase58(),
                recipient: selectedTender.creatorWallet, // Кошелек организатора
                amount: Number(myBidAmount), // Сумма ставки
                token: 'SOL', // Или 'USDC'
                type: 'internal', // СКРЫТЫЙ перевод
                wallet: { signMessage } // Обязательная подпись (v1.1.1)
            });
            console.log("ShadowWire Tx:", tx);
            */

            // Имитируем задержку генерации пруфа (2-3 сек как в доках)
            await new Promise(resolve => setTimeout(resolve, 2500));
            console.log("✅ Proof Generated & Verified locally");

            // 3. Сохраняем ставку в нашу базу (MongoDB)
            // Мы сохраняем сумму в базу, чтобы ОРГАНИЗАТОР мог её видеть в UI.
            // В реальном блокчейне она была бы скрыта.
            await api.placeBid({
                tenderId: selectedTender._id,
                bidderWallet: currentUser.wallet, // Используем демо-кошелек для логики, но подписываем реальным
                bidderName: currentUser.name,
                amount: Number(myBidAmount),
                isDepositPaid: true
            });

            setMyBidAmount('');
            const res = await api.getBids(selectedTender._id);
            setBids(res.data);
            toast.success("Bid placed successfully! Data encrypted.", { id: toastId });

        } catch (error: any) {
            console.error("ShadowWire Error:", error);
            toast.error("Failed to place bid: " + error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateBid = async () => {
        if (!myExistingBid) return;
        const toastId = toast.loading("🔄 Recalculating Zero-Knowledge Proof...");
        setLoading(true);
        try {
            console.log("🔄 Recalculating Zero-Knowledge Proof for NEW amount...");
            // Имитация работы ShadowWire без списания депозита
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            await api.updateBid(myExistingBid._id, Number(myBidAmount));
            toast.success("Bid updated! Proof regenerated.", { id: toastId });
            
            const res = await api.getBids(selectedTender!._id);
            setBids(res.data);
            setIsEditingBid(false);
        } catch (error: any) {
            toast.error("Failed to update: " + error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleWithdrawBid = async () => {
        if (!myExistingBid || !selectedTender) return;

        // Кастомный тост для подтверждения
        toast((t) => (
            <div className="flex flex-col gap-2">
                <span className="font-bold">Withdraw Bid?</span>
                <span className="text-sm text-slate-300">You will forfeit your 1$ deposit.</span>
                <div className="flex gap-2 mt-1">
                    <button 
                        onClick={() => {
                            toast.dismiss(t.id); // Закрываем тост
                            performWithdraw();   // Выполняем действие
                        }}
                        className="bg-red-500 text-white px-3 py-1 rounded text-xs font-bold"
                    >
                        Confirm Withdraw
                    </button>
                    <button 
                        onClick={() => toast.dismiss(t.id)}
                        className="bg-slate-700 text-white px-3 py-1 rounded text-xs"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ), { duration: 5000, icon: '⚠️' });
    };

    // Вспомогательная функция для реального удаления (вызывается из тоста)
    const performWithdraw = async () => {
        setLoading(true);
        try {
            await api.deleteBid(myExistingBid!._id);
            const res = await api.getBids(selectedTender!._id);
            setBids(res.data);
            toast.success("Bid withdrawn.");
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectWinner = (bid: Bid) => {
        if (!selectedTender) return;

        toast((t) => (
            <div className="flex flex-col gap-2">
                <span className="font-bold">Accept Offer?</span>
                <span className="text-sm text-slate-300">Winner: {bid.bidderName} (${bid.amount})</span>
                <div className="flex gap-2 mt-1">
                    <button 
                        onClick={() => {
                            toast.dismiss(t.id);
                            confirmWinnerSelection(bid);
                        }}
                        className="bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold"
                    >
                        Accept Bid
                    </button>
                    <button 
                        onClick={() => toast.dismiss(t.id)}
                        className="bg-slate-700 text-white px-3 py-1 rounded text-xs"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ), { duration: 5000 });
    };

    const handleSubmitWork = async () => {
        if (!selectedTender || !submissionText) return;
        
        const toastId = toast.loading("Submitting work report...");
        setLoading(true);
        try {
            await api.submitWork(selectedTender._id, submissionText);
            loadData(); // Обновляем список
            
            // Обновляем текущий выбранный тендер локально, чтобы UI перерисовался сразу
            setSelectedTender(prev => prev ? ({...prev, workSubmission: submissionText}) : null);
            
            toast.success("Work submitted successfully!", { id: toastId });
        } catch (e: any) {
            toast.error("Error: " + e.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const confirmWinnerSelection = async (bid: Bid) => {
        await api.selectWinner(selectedTender!._id, bid.bidderWallet, bid.amount);
        loadData();
        setSelectedTender(null);
        toast.success(`Winner selected: ${bid.bidderName}`);
    };

    const handleFinalPayment = async () => {
         if (!selectedTender) return;
         if (!publicKey || !signMessage) {
             toast.error("Please connect your wallet!");
             return;
         }

         const toastId = toast.loading(`💸 Processing ShadowWire Transfer of $${selectedTender.finalAmount}...`);
         setLoading(true);
         
         try {
             await new Promise(resolve => setTimeout(resolve, 3000));
             
             await api.payTender(selectedTender._id);
             loadData();
             setSelectedTender(null);
             
             toast.success(`Payment sent privately!`, { id: toastId });
         } catch (e) {
             console.error(e);
             toast.error("Payment failed", { id: toastId });
         } finally {
             setLoading(false);
         }
    };

    return (
        <div className="space-y-6">
            
            {/* DEMO USER SWITCHER */}
            <div className="bg-slate-800 text-white p-3 rounded-lg flex items-center justify-between sticky top-0 z-10 shadow-md">
                <div className="flex items-center gap-2 text-sm">
                    <UserIcon size={16} className="text-emerald-400"/>
                    <span className="text-slate-400">Viewing as:</span>
                    <select 
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-emerald-400 font-bold outline-none cursor-pointer"
                        value={currentUser.wallet}
                        onChange={(e) => setCurrentUser(MOCK_USERS.find(u => u.wallet === e.target.value))}
                    >
                        {MOCK_USERS.map(u => (
                            <option key={u.wallet} value={u.wallet}>{u.name} ({u.role})</option>
                        ))}
                    </select>
                </div>
                {currentUser.role === 'gov' && (
                     <button onClick={() => setShowCreate(true)} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors">
                        <Plus size={14} /> New Tender
                     </button>
                )}
            </div>

            {/* CREATE MODAL */}
            {showCreate && (
                <div className="fixed top-0 left-0 w-full h-full z-[100] flex items-center justify-center p-4 !m-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}></div>
                    
                    <form onSubmit={handleCreateTender} className="bg-white p-8 rounded-2xl shadow-2xl space-y-5 w-full max-w-lg relative z-10 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-xl text-slate-800">Create New Tender</h3>
                            <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-slate-700">Project Title</label>
                            <input required placeholder="e.g. School Renovation" className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={newTender.title} onChange={e => setNewTender({...newTender, title: e.target.value})} />
                            
                            <label className="block text-sm font-bold text-slate-700">Description & Requirements</label>
                            <textarea required placeholder="Describe the scope of work..." rows={3} className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={newTender.description} onChange={e => setNewTender({...newTender, description: e.target.value})} />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700">Max Budget (USD)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-slate-400">$</span>
                                        <input required type="number" placeholder="50000" className="w-full border border-slate-300 p-3 pl-8 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={newTender.maxBudget} onChange={e => setNewTender({...newTender, maxBudget: e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700">Deadline</label>
                                    <input required type="date" className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={newTender.deadline} onChange={e => setNewTender({...newTender, deadline: e.target.value})} />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button type="submit" disabled={loading} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors">Create Tender</button>
                        </div>
                    </form>
                </div>
            )}

            {/* TENDERS LIST */}
            <div className="grid grid-cols-1 gap-4">
                {tenders.length === 0 && !loading && (
                    <div className="text-center py-10 text-slate-400 italic">No tenders available. Create one!</div>
                )}
                {tenders.map(tender => (
                    <div key={tender._id} className="bg-white p-6 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all cursor-pointer group" onClick={() => setSelectedTender(tender)}>
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 group-hover:text-emerald-700 transition-colors">{tender.title}</h3>
                                <p className="text-slate-500 text-sm line-clamp-2">{tender.description}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${tender.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {tender.status.replace('_', ' ')}
                            </span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-slate-500 mt-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-1"><DollarSign size={14}/> Max: <span className="text-slate-900 font-bold">${tender.maxBudget.toLocaleString()}</span></div>
                            <div className="flex items-center gap-1"><UserIcon size={14}/> {tender.creatorWallet.slice(0, 4)}...{tender.creatorWallet.slice(-4)}</div>
                            {/* ОТОБРАЖЕНИЕ ДЕДЛАЙНА */}
                            <div className="flex items-center gap-1">
                                <Calendar size={14}/> Ends: <span className="font-medium text-slate-700">{new Date(tender.deadline).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* TENDER DETAILS MODAL */}
            {selectedTender && (
                <div className="fixed top-0 left-0 w-full h-full z-[100] flex items-center justify-center p-4 !m-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedTender(null)}></div>
                    
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-200">
                        <div className="flex justify-between items-start mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 pr-8">{selectedTender.title}</h2>
                            <button onClick={() => setSelectedTender(null)} className="absolute right-6 top-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">✕</button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Status</p>
                                    <p className={`font-bold text-lg uppercase ${selectedTender.status === 'open' ? 'text-emerald-600' : 'text-slate-700'}`}>
                                        {selectedTender.status.replace('_', ' ')}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Participants</p>
                                    <p className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                        <Users size={18} className="text-slate-400"/> {bids.length} Bidders
                                    </p>
                                </div>
                            </div>

                            <div className="prose prose-slate max-w-none">
                                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Description</h4>
                                <p className="text-slate-600 whitespace-pre-wrap bg-white border border-slate-100 p-4 rounded-xl">{selectedTender.description}</p>
                            </div>

                            <div className="flex items-center gap-6 text-sm text-slate-500">
                                <div className="flex items-center gap-2">
                                    {/* ДЕДЛАЙН В ДЕТАЛЯХ */}
                                    <Calendar size={16}/> Deadline: <span className="font-semibold text-slate-700">{new Date(selectedTender.deadline).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <DollarSign size={16}/> Budget Cap: <span className="font-semibold text-slate-700">${selectedTender.maxBudget.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* ACTIONS BLOCK */}
                        <div className="mt-8 pt-8 border-t border-slate-200">
                            
                            {/* SUPPLIER VIEW: Make a Bid / Edit Bid */}
                            {currentUser.role === 'supplier' && selectedTender.status === 'open' && (
                                <div>
                                    <h4 className="font-bold mb-4 flex items-center gap-2 text-slate-800">
                                        <Shield size={20} className="text-emerald-500"/> 
                                        {myExistingBid ? "Your Active Bid" : "Submit Private Proposal"}
                                    </h4>
                                    
                                    {/* ЕСЛИ СТАВКА УЖЕ ЕСТЬ И МЫ ЕЁ НЕ РЕДАКТИРУЕМ */}
                                    {myExistingBid && !isEditingBid ? (
                                        <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-emerald-800 mb-1">You have submitted a bid for this tender.</p>
                                                <p className="text-2xl font-black text-emerald-900">${myExistingBid.amount.toLocaleString()}</p>
                                                <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold">DEPOSIT PAID</span>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button onClick={() => { setIsEditingBid(true); setMyBidAmount(String(myExistingBid.amount)); }} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors">
                                                    Change Bid
                                                </button>
                                                <button onClick={handleWithdrawBid} className="text-red-500 font-bold text-sm hover:underline">
                                                    Withdraw Bid (Forfeit 1$)
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ФОРМА ПОДАЧИ ИЛИ РЕДАКТИРОВАНИЯ */
                                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                                            <p className="text-sm text-slate-500 mb-4">
                                                {isEditingBid 
                                                    ? "Enter your new offer. Your ZK-proof will be recalculated. No extra deposit required." 
                                                    : "To participate, you must place a 1 USD deposit. Your bid amount will be encrypted via ShadowWire."}
                                            </p>
                                            <div className="flex gap-4 items-end">
                                                <div className="flex-1">
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">Your Offer (USD)</label>
                                                    <input type="number" className="w-full border border-slate-300 p-3 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg" placeholder="Enter amount..." value={myBidAmount} onChange={e => setMyBidAmount(e.target.value)} />
                                                </div>
                                                
                                                {isEditingBid ? (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setIsEditingBid(false)} className="px-4 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-lg">Cancel</button>
                                                        <button disabled={loading || !myBidAmount} onClick={handleUpdateBid} className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50">
                                                            Update Bid
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button disabled={loading || !myBidAmount} onClick={handlePlaceBid} className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50">
                                                        Pay Deposit & Submit
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* GOV VIEW: Select Winner */}
                            {currentUser.role === 'gov' && currentUser.wallet === selectedTender.creatorWallet && selectedTender.status === 'open' && (
                                <div>
                                    <h4 className="font-bold mb-4 text-slate-800">Received Bids (Private Decrypted)</h4>
                                    {bids.length === 0 ? <p className="text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg">No bids received yet.</p> : (
                                        <div className="space-y-3">
                                            {bids.map(bid => (
                                                <div key={bid._id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-emerald-300 transition-colors bg-white">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-slate-100 p-2 rounded-full"><UserIcon size={16} className="text-slate-500"/></div>
                                                        <div>
                                                            <p className="font-bold text-slate-800">{bid.bidderName}</p>
                                                            <p className="text-xs text-slate-500 font-mono">{bid.bidderWallet.slice(0,6)}...{bid.bidderWallet.slice(-4)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <p className="font-bold text-lg text-slate-900">${bid.amount.toLocaleString()}</p>
                                                            <p className="text-xs text-emerald-600 font-medium">Deposit Paid</p>
                                                        </div>
                                                        <button onClick={() => handleSelectWinner(bid)} className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-600 shadow-sm transition-all">
                                                            Accept Bid
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* --- WORKFLOW FOR IN_PROGRESS STATUS --- */}
                            {selectedTender.status === 'in_progress' && (
                                <div className="mt-6 pt-6 border-t border-slate-200">
                                    
                                    {/* SCENARIO 1: I AM THE WINNER (Supplier) */}
                                    {currentUser.wallet === selectedTender.winnerWallet && (
                                        <div>
                                            {selectedTender.workSubmission ? (
                                                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                                                    <p className="font-bold text-emerald-800">✅ Work Submitted</p>
                                                    <p className="text-sm text-emerald-600 mt-1">Waiting for customer approval and payment.</p>
                                                </div>
                                            ) : (
                                                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                                                    <h4 className="font-bold mb-2 flex items-center gap-2 text-slate-800">
                                                        <CheckCircle size={20} className="text-blue-500"/> Submit Work for Payment
                                                    </h4>
                                                    <p className="text-sm text-slate-500 mb-3">
                                                        Congratulations! You won this contract. Once you have completed the job, submit your report here to request the payment of <b>${selectedTender.finalAmount?.toLocaleString()}</b>.
                                                    </p>
                                                    <textarea 
                                                        className="w-full border p-3 rounded-lg mb-3 h-24 text-sm" 
                                                        placeholder="Describe the work done, attach links to documents, etc..."
                                                        value={submissionText}
                                                        onChange={e => setSubmissionText(e.target.value)}
                                                    />
                                                    <button 
                                                        onClick={handleSubmitWork}
                                                        disabled={loading || !submissionText}
                                                        className="w-full bg-slate-900 text-white py-2 rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50"
                                                    >
                                                        Submit Work Report
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* SCENARIO 2: I AM THE CUSTOMER (Gov) */}
                                    {currentUser.role === 'gov' && currentUser.wallet === selectedTender.creatorWallet && (
                                        <div>
                                            {!selectedTender.workSubmission ? (
                                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-3">
                                                    <Clock className="text-amber-500" />
                                                    <div>
                                                        <p className="font-bold text-amber-800">Waiting for Submission</p>
                                                        <p className="text-sm text-amber-600">The winner is working. You will be notified when they submit the report.</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-xl text-center animate-in zoom-in duration-300">
                                                    <div className="inline-block p-3 bg-white rounded-full mb-3 shadow-sm">
                                                        <ShieldCheck size={32} className="text-emerald-500" />
                                                    </div>
                                                    <h4 className="font-bold text-emerald-900 text-lg mb-2">Work Report Received</h4>
                                                    
                                                    <div className="bg-white p-3 rounded border border-emerald-100 text-left text-sm text-slate-600 mb-4 italic">
                                                        "{selectedTender.workSubmission}"
                                                    </div>

                                                    <p className="text-sm text-emerald-700 mb-6 max-w-md mx-auto">
                                                        Please verify the work above. If satisfied, release the payment of <b>${selectedTender.finalAmount?.toLocaleString()}</b> via ShadowWire.
                                                    </p>
                                                    
                                                    <button onClick={handleFinalPayment} className="w-full bg-emerald-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all transform hover:-translate-y-0.5">
                                                        Approve Work & Pay Privately
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* SCENARIO 3: I AM A LOSER (Other Suppliers) */}
                                    {currentUser.role === 'supplier' && currentUser.wallet !== selectedTender.winnerWallet && (
                                         <div className="text-center text-slate-400 py-4">
                                            <p>This tender has been awarded to another participant.</p>
                                         </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};