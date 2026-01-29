import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import type {Tender, Bid, User as ApiUser} from '../utils/api';
import { Plus, Clock, Shield, DollarSign, User as UserIcon, Calendar, Users, ShieldCheck, CheckCircle, Settings, Briefcase, Trophy, Globe, Lock } from 'lucide-react';
import { useShadowWire } from '../hooks/useShadowWire';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { saveTxToHistory } from './TransactionHistory';
import { useUser } from '../hooks/useUser';


export const TenderModule = () => {
    const [tenders, setTenders] = useState<Tender[]>([]);
    const [loading, setLoading] = useState(false);
    const { publicKey, signMessage } = useWallet();
    const { client: shadowClient } = useShadowWire();
    const { user: currentUser, refreshUser } = useUser(); 
    
    // Кэш имен создателей { wallet: companyName }
    const [creatorsMap, setCreatorsMap] = useState<Record<string, string>>({});

    // Состояния форм
    const [showCreate, setShowCreate] = useState(false);
    const [newTender, setNewTender] = useState({ title: '', description: '', maxBudget: '', deadline: '' });
    
    const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
    const [bids, setBids] = useState<Bid[]>([]);
    const [myBidAmount, setMyBidAmount] = useState('');
    const [isEditingBid, setIsEditingBid] = useState(false);
    
    const [submissionText, setSubmissionText] = useState('');
    const [showProfileSettings, setShowProfileSettings] = useState(false);
    const [profileForm, setProfileForm] = useState({ name: '', industry: '', employees: '', description: '' });
    const [viewingProfile, setViewingProfile] = useState<ApiUser | null>(null);

    // Тип оплаты (для финального этапа)
    const [payoutType, setPayoutType] = useState<'internal' | 'external'>('external');
    const [payoutWallet, setPayoutWallet] = useState(''); // Заполним при открытии

    const myExistingBid = bids.find(b => b.bidderWallet === currentUser?.walletAddress);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedTender && currentUser) {
            api.getBids(selectedTender._id).then(res => setBids(res.data));
            setPayoutWallet(currentUser.walletAddress);
        }
    }, [selectedTender, currentUser]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.getTenders();
            setTenders(res.data);
            // Загружаем имена создателей
            loadCreatorsNames(res.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    // Загрузка реальных имен компаний
    const loadCreatorsNames = async (tendersList: Tender[]) => {
        const uniqueWallets = [...new Set(tendersList.map(t => t.creatorWallet))];
        const newMap = { ...creatorsMap };
        
        for (const wallet of uniqueWallets) {
            if (!newMap[wallet]) {
                try {
                    const profile = await api.getProfile(wallet);
                    newMap[wallet] = profile.data.company?.name || 'Private Entity';
                } catch {
                    newMap[wallet] = 'Unknown';
                }
            }
        }
        setCreatorsMap(newMap);
    };

    const handleOpenSettings = () => {
        if (currentUser?.company) {
            setProfileForm({
                name: currentUser.company.name || '',
                industry: currentUser.company.industry || '',
                employees: currentUser.company.employeesCount?.toString() || '',
                description: currentUser.company.description || ''
            });
        }
        setShowProfileSettings(true);
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        
        await api.updateProfile(currentUser.walletAddress, {
            name: profileForm.name,
            industry: profileForm.industry,
            employeesCount: Number(profileForm.employees),
            description: profileForm.description
        });
        
        setShowProfileSettings(false);
        toast.success("Company profile updated!");
        await refreshUser(); 
    };

    const handleViewCompany = async (wallet: string) => {
        const res = await api.getProfile(wallet);
        setViewingProfile(res.data);
    };

    const handleCreateTender = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser?.company?.name) {
            toast.error("Please fill in your Company Profile first!");
            handleOpenSettings();
            return;
        }

        setLoading(true);
        await api.createTender({
            title: newTender.title,
            description: newTender.description,
            maxBudget: Number(newTender.maxBudget),
            deadline: newTender.deadline,
            creatorWallet: currentUser.walletAddress,
            status: 'open'
        });
        setShowCreate(false);
        setNewTender({ title: '', description: '', maxBudget: '', deadline: '' });
        loadData();
        toast.success("Tender created successfully!");
    };

    const handlePlaceBid = async () => {
        if (!selectedTender || !currentUser) return;
        if (!publicKey) return toast.error("Connect wallet!");
        
        if (!currentUser.company?.name) {
            toast.error("Complete your Company Profile to bid!");
            handleOpenSettings();
            return;
        }

        const toastId = toast.loading("Encrypting bid via ShadowWire...");
        setLoading(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 2000));

            await api.placeBid({
                tenderId: selectedTender._id,
                bidderWallet: currentUser.walletAddress,
                bidderName: currentUser.company?.name || "Unknown Company",
                amount: Number(myBidAmount),
                isDepositPaid: true
            });

            setMyBidAmount('');
            const res = await api.getBids(selectedTender._id);
            setBids(res.data);
            toast.success("Bid placed successfully!", { id: toastId });

        } catch (error: any) {
            toast.error("Error: " + error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateBid = async () => {
        if (!myExistingBid) return;
        const toastId = toast.loading("🔄 Recalculating Zero-Knowledge Proof...");
        setLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            await api.updateBid(myExistingBid._id, Number(myBidAmount));
            toast.success("Bid updated!", { id: toastId });
            const res = await api.getBids(selectedTender!._id);
            setBids(res.data);
            setIsEditingBid(false);
        } catch (error: any) {
            toast.error("Failed: " + error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleWithdrawBid = async () => {
        if (!myExistingBid || !selectedTender) return;
        if (!confirm("Withdraw bid? Deposit will be lost.")) return;
        
        setLoading(true);
        try {
            await api.deleteBid(myExistingBid._id);
            const res = await api.getBids(selectedTender._id);
            setBids(res.data);
            toast.success("Bid withdrawn.");
        } catch (error: any) { console.error(error); }
        setLoading(false);
    };

    const handleSelectWinner = async (bid: Bid) => {
        if (!confirm(`Select ${bid.bidderName} as winner?`)) return;
        await api.selectWinner(selectedTender!._id, bid.bidderWallet, bid.amount);
        loadData();
        setSelectedTender(null);
        toast.success(`Winner selected: ${bid.bidderName}`);
    };

    const handleSubmitWork = async () => {
        if (!selectedTender || !submissionText || !payoutWallet) return;
        
        await api.submitWork(selectedTender._id, submissionText, payoutType, payoutWallet);
        loadData();
        setSelectedTender(prev => prev ? ({
            ...prev, 
            workSubmission: submissionText,
            preferredPaymentType: payoutType,
            preferredPaymentWallet: payoutWallet
        }) : null);
        toast.success("Work submitted with payment preferences!");
    };

    const handleFinalPayment = async () => {
         if (!selectedTender || !currentUser) return;
         if (!publicKey || !signMessage) return toast.error("Connect wallet!");

         // Берем настройки, которые выбрал Исполнитель
         const type = selectedTender.preferredPaymentType || 'external';
         const recipient = selectedTender.preferredPaymentWallet || selectedTender.winnerWallet!;

         const toastId = toast.loading(`Paying $${selectedTender.finalAmount} (${type.toUpperCase()}) to ${recipient.slice(0,6)}...`);
         
         try {
             const result = await shadowClient.transfer({
                sender: publicKey.toBase58(),
                recipient: recipient,
                amount: selectedTender.finalAmount || 0.1, 
                token: 'USD1',
                type: type,
                wallet: { signMessage }
             });
             
             if (result.tx_signature) {
                 await api.payTender(selectedTender._id);
                 loadData();
                 setSelectedTender(null);
                 if (result.success) {
                    toast.success(`Payment sent!`, { id: toastId });
                    saveTxToHistory(result.tx_signature, 'Tender Payment');
                 } else {
                    console.warn("Tx broadcasted but reverted:", (result as any).error);
                    toast.success(`Transaction Broadcasted!`, { id: toastId });
                 }
             } else {
                 throw new Error("Transaction failed");
             }
         } catch (e: any) {
             console.error(e);
             toast.error("Payment failed: " + e.message, { id: toastId });
         }
    };

    return (
        <div className="space-y-6">
            
            {/* Header + Settings */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                {/* Декоративный фон */}
                <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-emerald-50 to-transparent opacity-50 pointer-events-none"></div>
                
                <div className="relative z-10 mb-4 md:mb-0">
                    <h3 className="font-extrabold text-2xl text-slate-900 tracking-tight flex items-center gap-2">
                        <Briefcase className="text-emerald-500" size={24} /> 
                        Global Tenders
                    </h3>
                    <p className="text-slate-500 mt-1 font-medium">Secure marketplace for private government & corporate contracts.</p>
                </div>

                <div className="flex gap-3 relative z-10">
                    <button 
                        onClick={handleOpenSettings} 
                        className="text-slate-600 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                    >
                        <Settings size={18}/> 
                        <span className="hidden sm:inline">My Profile</span>
                    </button>
                    <button 
                        onClick={() => setShowCreate(true)} 
                        className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 shadow-lg shadow-slate-200 hover:shadow-slate-300 transition-all transform hover:-translate-y-0.5"
                    >
                        <Plus size={18}/> Create Tender
                    </button>
                </div>
            </div>

            {/* LIST */}
            <div className="grid grid-cols-1 gap-4">
                {tenders.length === 0 && !loading && (
                    <div className="text-center py-12 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        No active tenders found. Be the first to create one!
                    </div>
                )}
                {tenders.map(tender => (
                    <div key={tender._id} className="bg-white p-6 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all cursor-pointer group relative" onClick={() => setSelectedTender(tender)}>
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 group-hover:text-emerald-700 transition-colors">{tender.title}</h3>
                                <p className="text-slate-500 text-sm line-clamp-2 mt-1">{tender.description}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${tender.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {tender.status.replace('_', ' ')}
                            </span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-slate-500 mt-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                                <DollarSign size={16} className="text-emerald-600"/> 
                                <span className="text-slate-900 font-bold">${tender.maxBudget.toLocaleString()}</span>
                            </div>
                            
                            {/* Creator Name (Real from DB) */}
                            <div 
                                className="flex items-center gap-1.5 hover:text-emerald-600 hover:underline z-10 transition-colors"
                                onClick={(e) => { e.stopPropagation(); handleViewCompany(tender.creatorWallet); }}
                                title="View Company Profile"
                            >
                                <UserIcon size={16}/> 
                                <span className="font-medium">{creatorsMap[tender.creatorWallet] || tender.creatorWallet.slice(0, 6) + '...'}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 ml-auto">
                                <Calendar size={16}/> 
                                <span className="font-medium text-slate-700">Ends: {new Date(tender.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* SETTINGS MODAL */}
            {showProfileSettings && (
                <div className="fixed top-0 left-0 w-full h-full z-[100] flex items-center justify-center p-4 !m-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowProfileSettings(false)}></div>
                    <form onSubmit={handleSaveProfile} className="bg-white p-8 rounded-2xl w-full max-w-md relative z-10 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b pb-4">
                            <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                                <Briefcase className="text-emerald-500"/> Company Profile
                            </h3>
                            <button type="button" onClick={() => setShowProfileSettings(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Company Name</label>
                                <input required placeholder="e.g. Acme Corp" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Industry</label>
                                    <input required placeholder="IT, Construction..." className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" value={profileForm.industry} onChange={e => setProfileForm({...profileForm, industry: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Employees</label>
                                    <input required type="number" placeholder="100" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" value={profileForm.employees} onChange={e => setProfileForm({...profileForm, employees: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                                <textarea placeholder="Describe your business..." rows={3} className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" value={profileForm.description} onChange={e => setProfileForm({...profileForm, description: e.target.value})} />
                            </div>
                        </div>

                        <button className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 shadow-lg transition-all">Save Profile</button>
                    </form>
                </div>
            )}

            {/* VIEW OTHER COMPANY MODAL */}
            {viewingProfile && (
                <div className="fixed top-0 left-0 w-full h-full z-[110] flex items-center justify-center p-4 !m-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewingProfile(null)}></div>
                    <div className="bg-white p-8 rounded-2xl w-full max-w-sm relative z-10 space-y-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
                        <button onClick={() => setViewingProfile(null)} className="absolute right-4 top-4 text-slate-300 hover:text-slate-500">✕</button>
                        
                        <div className="inline-block p-5 bg-emerald-50 rounded-full mb-2 border border-emerald-100">
                            <Briefcase size={40} className="text-emerald-600"/>
                        </div>
                        
                        <div>
                            <h3 className="font-bold text-2xl text-slate-900">{viewingProfile.company?.name || 'Private Entity'}</h3>
                            <p className="text-emerald-600 font-bold uppercase text-xs tracking-wider mt-2 bg-emerald-50 inline-block px-3 py-1 rounded-full">
                                {viewingProfile.company?.industry || 'Unknown Industry'}
                            </p>
                        </div>
                        
                        <p className="text-slate-500 text-sm leading-relaxed border-t border-b border-slate-100 py-4 my-2">
                            {viewingProfile.company?.description || 'No public description provided.'}
                        </p>
                        
                        <div className="grid grid-cols-3 gap-2 pt-2">
                            <div className="bg-slate-50 p-2 rounded-lg">
                                <p className="text-xl font-bold text-slate-800">{viewingProfile.company?.employeesCount || 0}</p>
                                <p className="text-[9px] text-slate-400 uppercase font-bold">Staff</p>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg">
                                <p className="text-xl font-bold text-slate-800">{viewingProfile.company?.tendersCreated || 0}</p>
                                <p className="text-[9px] text-slate-400 uppercase font-bold">Created</p>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-lg border border-emerald-100 bg-emerald-50/50">
                                <p className="text-xl font-bold text-slate-800 text-emerald-600">{viewingProfile.company?.tendersWon || 0}</p>
                                <p className="text-[9px] text-emerald-600/70 uppercase font-bold">Won</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE TENDER MODAL */}
            {showCreate && (
                <div className="fixed top-0 left-0 w-full h-full z-[100] flex items-center justify-center p-4 !m-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}></div>
                    <form onSubmit={handleCreateTender} className="bg-white p-8 rounded-2xl w-full max-w-lg relative z-10 space-y-5 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center border-b pb-4">
                            <h3 className="font-bold text-xl text-slate-800">New Tender Request</h3>
                            <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Project Title</label>
                                <input required placeholder="e.g. School Renovation Phase 1" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" value={newTender.title} onChange={e => setNewTender({...newTender, title: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                                <textarea required placeholder="Detailed requirements..." rows={4} className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" value={newTender.description} onChange={e => setNewTender({...newTender, description: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Max Budget (USD)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-slate-400">$</span>
                                        <input required type="number" placeholder="50000" className="w-full border p-3 pl-8 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold" value={newTender.maxBudget} onChange={e => setNewTender({...newTender, maxBudget: e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Deadline</label>
                                    <input required type="date" lang="en-US" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-slate-600" value={newTender.deadline} onChange={e => setNewTender({...newTender, deadline: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
                            <button 
                                type="submit" 
                                disabled={loading} // Блокируем
                                className={`bg-slate-900 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-slate-800'}`}
                            >
                                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                {loading ? 'Publishing...' : 'Publish Tender'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TENDER DETAILS MODAL */}
            {selectedTender && (
                <div className="fixed top-0 left-0 w-full h-full z-[100] flex items-center justify-center p-4 !m-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedTender(null)}></div>
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl relative z-10 animate-in slide-in-from-bottom-4 duration-200">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedTender.title}</h2>
                                <div className="flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 cursor-pointer w-fit" onClick={() => handleViewCompany(selectedTender.creatorWallet)}>
                                    <Briefcase size={16}/> Posted by <span className="font-bold underline decoration-dotted">{creatorsMap[selectedTender.creatorWallet] || 'Unknown Company'}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedTender(null)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">✕</button>
                        </div>

                        {/* ... (Детали тендера как раньше) ... */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="col-span-2 space-y-6">
                                <div className="prose prose-slate max-w-none">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Project Scope</h4>
                                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-xl text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{selectedTender.description}</div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Status</p>
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${selectedTender.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{selectedTender.status.replace('_', ' ')}</span>
                                </div>
                                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Budget Cap</p>
                                    <p className="font-bold text-xl text-slate-900">${selectedTender.maxBudget.toLocaleString()}</p>
                                </div>
                                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Deadline</p>
                                    <p className="font-medium text-slate-700">{new Date(selectedTender.deadline).toLocaleDateString()}</p>
                                </div>
                                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Activity</p>
                                    <p className="font-medium text-slate-700 flex items-center gap-2"><Users size={16}/> {bids.length} Bidders</p>
                                </div>
                            </div>
                        </div>

                        {/* ACTIONS BLOCK */}
                        <div className="pt-8 border-t border-slate-200">
                            
                            {/* SUPPLIER - Make Bid */}
                            {currentUser?.walletAddress !== selectedTender.creatorWallet && selectedTender.status === 'open' && (
                                <div>
                                    <h4 className="font-bold mb-4 flex items-center gap-2 text-slate-800"><Shield size={20} className="text-emerald-500"/> {myExistingBid ? "Your Active Proposal" : "Submit Private Proposal"}</h4>
                                    {myExistingBid && !isEditingBid ? (
                                        <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-emerald-800 mb-1">You have submitted a bid.</p>
                                                <p className="text-2xl font-black text-emerald-900">${myExistingBid.amount.toLocaleString()}</p>
                                                <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase">Deposit Paid</span>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button onClick={() => { setIsEditingBid(true); setMyBidAmount(String(myExistingBid.amount)); }} className="bg-white text-slate-900 border border-slate-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-50">Change</button>
                                                <button onClick={handleWithdrawBid} className="text-red-500 font-bold text-xs hover:underline">Withdraw</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                                            <p className="text-xs text-slate-500 mb-4">{isEditingBid ? "Update your offer. No extra deposit required." : "Requires 1 USD deposit. Amount encrypted via ShadowWire."}</p>
                                            <div className="flex gap-3 items-end">
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Your Offer (USD)</label>
                                                    <input type="number" className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold" placeholder="0.00" value={myBidAmount} onChange={e => setMyBidAmount(e.target.value)} />
                                                </div>
                                                <button disabled={loading || !myBidAmount} onClick={isEditingBid ? handleUpdateBid : handlePlaceBid} className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-800 shadow-lg">{isEditingBid ? 'Update Bid' : 'Pay Deposit & Bid'}</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* GOV - Select Winner */}
                            {currentUser?.walletAddress === selectedTender.creatorWallet && selectedTender.status === 'open' && (
                                <div>
                                    <h4 className="font-bold mb-4 text-slate-800 flex items-center gap-2"><ShieldCheck size={20} className="text-emerald-500"/> Received Private Bids</h4>
                                    {bids.length === 0 ? <p className="text-slate-400 italic text-sm">No bids yet.</p> : (
                                        <div className="space-y-3">
                                            {bids.map(bid => (
                                                <div key={bid._id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-emerald-300 transition-colors bg-white group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-slate-100 p-2 rounded-full cursor-pointer hover:bg-emerald-100" onClick={() => handleViewCompany(bid.bidderWallet)}><Briefcase size={16}/></div>
                                                        <div>
                                                            <p className="font-bold text-slate-800 hover:underline cursor-pointer" onClick={() => handleViewCompany(bid.bidderWallet)}>{bid.bidderName}</p>
                                                            <p className="text-xs text-slate-400 font-mono">{bid.bidderWallet.slice(0,4)}...{bid.bidderWallet.slice(-4)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="font-bold text-lg text-slate-900">${bid.amount.toLocaleString()}</span>
                                                        <button onClick={() => handleSelectWinner(bid)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm opacity-0 group-hover:opacity-100 transition-all">Award Contract</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* WORK SUBMISSION & PAYMENT */}
                            {selectedTender.status === 'in_progress' && (
                                <div className="mt-4">
                                    {/* WINNER */}
                                    {currentUser?.walletAddress === selectedTender.winnerWallet && (
                                        <div>
                                            {selectedTender.workSubmission ? (
                                                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                                                    <p className="font-bold text-emerald-800 flex items-center justify-center gap-2"><CheckCircle size={18}/> Work Submitted</p>
                                                    <p className="text-xs text-emerald-600 mt-1">Waiting for customer approval.</p>
                                                </div>
                                            ) : (
                                                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
                                                    <h4 className="font-bold flex items-center gap-2 text-slate-800">Submit Work for Payment</h4>
                                                    
                                                    {/* Report Text */}
                                                    <textarea 
                                                        className="w-full border p-3 rounded-lg text-sm" 
                                                        placeholder="Describe work done..." 
                                                        value={submissionText} 
                                                        onChange={e => setSubmissionText(e.target.value)} 
                                                    />

                                                    {/* Payment Settings Block */}
                                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Payment Preferences</p>
                                                        
                                                        {/* Type Selection */}
                                                        <div className="flex gap-2 mb-3">
                                                            <button onClick={() => setPayoutType('external')} className={`flex-1 py-1.5 rounded text-xs font-bold border ${payoutType === 'external' ? 'bg-white border-emerald-500 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-500'}`}>External (Public)</button>
                                                            <button onClick={() => setPayoutType('internal')} className={`flex-1 py-1.5 rounded text-xs font-bold border ${payoutType === 'internal' ? 'bg-white border-emerald-500 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-500'}`}>Internal (Private)</button>
                                                        </div>

                                                        {/* Wallet Input */}
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Payout Wallet</label>
                                                            <div className="flex gap-2">
                                                                <input 
                                                                    className="flex-1 border p-2 rounded text-xs font-mono bg-white" 
                                                                    value={payoutWallet || currentUser?.walletAddress || ''}
                                                                    onChange={e => setPayoutWallet(e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button onClick={handleSubmitWork} className="w-full bg-slate-900 text-white py-2 rounded-lg font-bold">Submit Report</button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* CUSTOMER PAYMENT */}
                                    {currentUser?.walletAddress === selectedTender.creatorWallet && (
                                        <div>
                                            {!selectedTender.workSubmission ? (
                                                /* ... Waiting Block (как было) ... */
                                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center gap-3">
                                                    <Clock className="text-amber-500" />
                                                    <div>
                                                        <p className="font-bold text-amber-800 text-sm">In Progress</p>
                                                        <p className="text-xs text-amber-600">Waiting for winner to submit work.</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-xl text-center">
                                                    <ShieldCheck size={32} className="text-emerald-500 mx-auto mb-3" />
                                                    <h4 className="font-bold text-emerald-900 text-lg">Work Report Received</h4>
                                                    <div className="bg-white p-3 rounded border border-emerald-100 text-left text-xs text-slate-600 my-4 italic">"{selectedTender.workSubmission}"</div>
                                                    
                                                    {/* Info about requested payment */}
                                                    <p className="text-xs text-emerald-700 mb-4">
                                                        Requested: <b>{selectedTender.preferredPaymentType?.toUpperCase()}</b> payout to 
                                                        <br/><span className="font-mono">{selectedTender.preferredPaymentWallet?.slice(0,8)}...</span>
                                                    </p>

                                                    <button onClick={handleFinalPayment} className="w-full bg-emerald-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-emerald-700 shadow-lg transition-all">
                                                        Approve & Pay Privately (${selectedTender.finalAmount})
                                                    </button>
                                                </div>
                                            )}
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