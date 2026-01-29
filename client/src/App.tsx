import React, { useEffect, useState, useMemo } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Toaster } from 'react-hot-toast';
import { LayoutDashboard, Briefcase, Users, RefreshCw, Wallet, ArrowDownCircle, ArrowUpCircle, ShieldCheck, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { TransactionHistory } from './components/TransactionHistory';

import { TenderModule } from './components/TenderModule';
import { InvoiceModule } from './components/InvoiceModule';
import { PayrollModule } from './components/PayrollModule';
import { initializeShadowWire } from './utils/shadow-sdk';
import { useShadowWire } from './hooks/useShadowWire';
import { useUser } from './hooks/useUser';

import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => import.meta.env.VITE_RPC_URL, []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ShadowLinkApp />
          <Toaster position="bottom-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' }}} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

const ShadowLinkApp = () => {
  const { publicKey } = useWallet();
  const [isSdkReady, setSdkReady] = useState(false);
  const [activeModule, setActiveModule] = useState<'gov' | 'supplier' | 'employee'>('supplier');
  
  // HOOKS
  const { user, activateRegistration } = useUser(); // <-- Наш новый хук
  const { balance, deposited, updateBalance, deposit, withdraw, loading: swLoading } = useShadowWire();

  const [modalType, setModalType] = useState<'deposit' | 'withdraw' | null>(null);
  const [amountInput, setAmountInput] = useState('');

  useEffect(() => {
    initializeShadowWire().then(setSdkReady);
  }, []);

  useEffect(() => {
    if (publicKey && isSdkReady) updateBalance();
  }, [publicKey, isSdkReady, updateBalance]);

  useEffect(() => {
    // Проверяем именно deposited
    if (deposited > 0 && user && !user.isRegistered) {
      activateRegistration();
    }
  }, [deposited, user]);

  const handleTransactionSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const val = parseFloat(amountInput);
      if (isNaN(val) || val < 5) {
          alert("Minimum amount is 5 USD1");
          return;
      }

      let success = false;
      if (modalType === 'deposit') {
          success = await deposit(val);
          if (success) {
              await activateRegistration(); // <-- Активируем статус "Registered" в базе
          }
      } else {
          success = await withdraw(val);
      }

      if (success) {
          setModalType(null);
          setAmountInput('');
      }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col shadow-xl z-10 shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-emerald-500/10 p-2 rounded-lg">
            <ShieldCheck className="text-emerald-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">ShadowLink</h1>
            <p className="text-xs text-slate-400">Privacy Settlement Layer</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {/* Для хакатона можно оставить названия как роли, но логика теперь общая */}
          <SidebarButton active={activeModule === 'supplier'} onClick={() => setActiveModule('supplier')} icon={<Briefcase size={20} />} label="Supply Chain (Invoices)" />
          <SidebarButton active={activeModule === 'gov'} onClick={() => setActiveModule('gov')} icon={<LayoutDashboard size={20} />} label="Public Tenders" />
          <SidebarButton active={activeModule === 'employee'} onClick={() => setActiveModule('employee')} icon={<Users size={20} />} label="Payroll" />
        </nav>

        <div className="p-4 bg-slate-950/50 mt-auto border-t border-slate-800">
           <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isSdkReady ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
              <span className="text-xs font-medium">{isSdkReady ? 'ShadowWire Active' : 'Loading SDK...'}</span>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-slate-50">
        
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex justify-between items-center px-6 shrink-0 z-20 shadow-sm">
          
          {/* USER STATUS (Вместо свитчера) */}
          <div className="flex items-center gap-3">
             {publicKey ? (
                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-100 bg-slate-50">
                    <div className={`w-2 h-2 rounded-full ${user?.isRegistered ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                        <span className={`text-xs font-bold ${user?.isRegistered ? 'text-emerald-700' : 'text-amber-600'}`}>
                            {user?.isRegistered ? 'Verified (Shielded)' : 'Not Registered'}
                        </span>
                    </div>
                 </div>
             ) : (
                 <span className="text-sm text-slate-400 italic">Connect wallet to begin</span>
             )}
          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center gap-4">
            {publicKey && (
              <div className="flex items-center bg-gradient-to-r from-slate-900 to-slate-950 text-white rounded-2xl p-2 pr-5 pl-3  h-14 border border-slate-800/50">
                {/* Icon Box – теперь чуть больше и с градиентом */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 w-10 h-10 rounded-xl flex items-center justify-center mr-4 shrink-0 shadow-inner">
                  <Wallet size={22} className="text-emerald-400" />
                </div>

                {/* Balance Section */}
                <div className="flex flex-col justify-center mr-6 min-w-[110px]">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest leading-none mb-1">
                    Shielded USD1
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-extrabold text-2xl leading-none tracking-tight">
                      {balance !== null
                        ? balance.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : '—.—'}
                    </span>

                    {/* Refresh Button – теперь круглая, красиво интегрированная */}
                    <button
                      onClick={updateBalance}
                      className="p-1.5 rounded-full bg-slate-800/80 hover:bg-emerald-900/30 text-slate-400 hover:text-emerald-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      title="Refresh balance"
                      disabled={swLoading}
                    >
                      <RefreshCw
                        size={16}
                        className={`${swLoading ? 'animate-spin text-emerald-400' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Vertical Divider – тоньше и мягче */}
                <div className="h-8 w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent mx-4 self-center" />

                {/* Actions – теперь с лёгким градиентом и hover */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setModalType('deposit')}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-emerald-500/30 active:scale-95"
                  >
                    <ArrowDownCircle size={16} /> Deposit
                  </button>

                  <button
                    onClick={() => setModalType('withdraw')}
                    className="flex items-center gap-2 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-slate-500/30 active:scale-95"
                  >
                    <ArrowUpCircle size={16} /> Withdraw
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <TransactionHistory /> {/* Новая кнопка */}
              <WalletMultiButton />
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto w-full">
          <div className="p-8 max-w-7xl mx-auto space-y-8 min-h-full">
            
            {/* Page Titles */}
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                {activeModule === 'gov' && 'Public Procurement'}
                {activeModule === 'supplier' && 'Supply Chain Invoices'}
                {activeModule === 'employee' && 'Corporate Payroll'}
              </h2>
              <p className="text-slate-500 mt-2 text-lg">
                {activeModule === 'gov' && 'Manage your secure transactions powered by Zero-Knowledge proofs.'}
                {activeModule === 'supplier' && 'Streamline your B2B payments and protect commercial secrets.'}
                {activeModule === 'employee' && 'Batch salary payments with zero-knowledge privacy.'}
              </p>
            </div>

            {/* Мы передаем user и addContact в модули, чтобы они могли их использовать */}
            {activeModule === 'gov' && <TenderModule />}
            
            {activeModule === 'supplier' && (
                <InvoiceModule user={user} />
            )}
            
            {activeModule === 'employee' && <PayrollModule currentUser={user} />}

          </div>
        </div>

        {/* Modals */}
        {modalType && (
            <div className="fixed top-0 left-0 w-full h-full z-[100] flex items-center justify-center p-4 !m-0">
                <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm" onClick={() => setModalType(null)}></div>
                <form onSubmit={handleTransactionSubmit} className="bg-white p-8 rounded-2xl w-full max-w-md relative z-10 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                            {modalType === 'deposit' ? <ArrowDownCircle className="text-emerald-500"/> : <ArrowUpCircle className="text-amber-500"/>}
                            {modalType === 'deposit' ? 'Deposit to Shielded Pool' : 'Withdraw Funds'}
                        </h3>
                        <button type="button" onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    
                    {!user?.isRegistered && modalType === 'deposit' && (
                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 flex gap-2">
                            <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                            <p className="text-xs text-amber-700">Making a deposit will register your wallet in ShadowWire and enable private Internal Transfers.</p>
                        </div>
                    )}

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Your Wallet</label>
                            <div className="font-mono text-xs bg-white p-2 rounded border text-slate-600 break-all">
                                {publicKey?.toBase58()}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Amount (USD1)</label>
                            <input autoFocus required type="number" min="5" step="0.01" placeholder="Min: 5.00" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-lg font-bold" value={amountInput} onChange={e => setAmountInput(e.target.value)} />
                        </div>
                    </div>
                    <button disabled={swLoading} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-bold shadow-lg transition-all">
                        {swLoading ? "Processing..." : "Confirm Transaction"}
                    </button>
                </form>
            </div>
        )}
      </main>
    </div>
  );
};

const SidebarButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick} 
    className={clsx(
      "flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 font-medium text-sm text-left",
      active 
        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" 
        : "text-slate-400 hover:bg-slate-800 hover:text-white bg-transparent"
    )}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const StatsCard = ({ title, value, subtext, icon }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
      <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{subtext}</p>
    </div>
    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
      {icon}
    </div>
  </div>
);

export default App;