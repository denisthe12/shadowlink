import React, { useEffect, useState, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { initializeShadowWire } from './utils/shadow-sdk';
import { LayoutDashboard, Briefcase, Users, FileText, ShieldCheck } from 'lucide-react';
import clsx from 'clsx'; // Утилита для удобного объединения классов

// Стили кошелька
import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ShadowLinkApp />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

const ShadowLinkApp = () => {
  const [isSdkReady, setSdkReady] = useState(false);
  const [role, setRole] = useState<'gov' | 'supplier' | 'employee'>('gov');

  useEffect(() => {
    initializeShadowWire().then(setSdkReady);
  }, []);

  return (
    // Добавили w-full и overflow-hidden, чтобы убрать лишние скроллы
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
          <div className="px-2 text-slate-500 text-xs uppercase font-bold tracking-wider mb-4">Modules</div>
          
          <SidebarButton 
            active={role === 'gov'} 
            onClick={() => setRole('gov')} 
            icon={<LayoutDashboard size={20} />} 
            label="Gov / Customer" 
          />
          <SidebarButton 
            active={role === 'supplier'} 
            onClick={() => setRole('supplier')} 
            icon={<Briefcase size={20} />} 
            label="Supplier (B2B)" 
          />
          <SidebarButton 
            active={role === 'employee'} 
            onClick={() => setRole('employee')} 
            icon={<Users size={20} />} 
            label="Employee (Payroll)" 
          />
        </nav>

        <div className="p-4 bg-slate-950/50 mt-auto border-t border-slate-800">
           <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isSdkReady ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-red-400'}`}></div>
              <span className={`text-xs font-medium ${isSdkReady ? 'text-emerald-400' : 'text-red-400'}`}>
                {isSdkReady ? 'ShadowWire Active' : 'Initializing SDK...'}
              </span>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-slate-50">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex justify-between items-center px-6 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">
              Mode
            </span>
            <span className="font-semibold text-slate-800 uppercase">
              {role}
            </span>
          </div>
          <div className="transform scale-90 origin-right">
            <WalletMultiButton />
          </div>
        </header>

        {/* Scrollable Content Area */}
        {/* ИСПРАВЛЕНИЕ: Убрали p-8 отсюда, чтобы скроллбар был скраю */}
        <div className="flex-1 overflow-y-auto w-full">
          {/* ИСПРАВЛЕНИЕ: Контент теперь внутри, и max-w-7xl для широких экранов, но тянется */}
          <div className="p-8 max-w-7xl mx-auto space-y-8 min-h-full">
            
            {/* Header Text */}
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                {role === 'gov' && 'Public Procurement'}
                {role === 'supplier' && 'Supply Chain Invoices'}
                {role === 'employee' && 'Payroll Dashboard'}
              </h2>
              <p className="text-slate-500 mt-2 text-lg">
                Manage your secure transactions powered by Zero-Knowledge proofs.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatsCard title="Total Secured Volume" value="$HIDDEN" subtext="Encrypted on-chain" icon={<ShieldCheck />} />
              <StatsCard title="Active Operations" value="12" subtext="Pending processing" icon={<FileText />} />
              <StatsCard title="Network Status" value="Solana Devnet" subtext="Ready for USD1" icon={<LayoutDashboard />} />
            </div>

            {/* Empty State / Welcome */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                <div className="bg-slate-50 p-6 rounded-full mb-6">
                  <ShieldCheck className="w-16 h-16 text-slate-300" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3">
                  Module Ready: {role.toUpperCase()}
                </h3>
                <p className="text-slate-500 max-w-lg mx-auto text-lg leading-relaxed">
                  This module is connected to the ShadowWire Privacy Layer. 
                  Transactions initiated here will be encrypted using Bulletproofs before being sent to the Solana blockchain.
                </p>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

// Компоненты для переиспользования
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