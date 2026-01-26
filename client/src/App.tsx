import { useEffect, useState, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { initializeShadowWire } from './utils/shadow-sdk';
import { LayoutDashboard, Briefcase, Users, FileText, ShieldCheck } from 'lucide-react';
import clsx from 'clsx'; // Утилита для удобного объединения классов
import { TenderModule } from './components/TenderModule';
import { Toaster } from 'react-hot-toast';
import { PayrollModule } from './components/PayrollModule';
import { InvoiceModule } from './components/InvoiceModule';

// Стили кошелька
import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_API_KEY}`, []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ShadowLinkApp />
          <Toaster 
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#1e293b', // Slate-800
                color: '#fff',
                border: '1px solid #334155',
              },
              success: {
                iconTheme: {
                  primary: '#10b981', // Emerald-500
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444', // Red-500
                  secondary: '#fff',
                },
              },
            }}
          />
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
                {role === 'employee' && 'Corporate Payroll'}
              </h2>
              <p className="text-slate-500 mt-2 text-lg">
                {role === 'gov' && 'Manage your secure transactions powered by Zero-Knowledge proofs.'}
                {role === 'supplier' && 'Streamline your B2B payments and protect commercial secrets.'}
                {role === 'employee' && 'Batch salary payments with zero-knowledge privacy.'}

              </p>
            </div>

            {/* Stats Grid */}
            {role === 'gov' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard title="Total Secured Volume" value="$HIDDEN" subtext="Encrypted on-chain" icon={<ShieldCheck />} />
                <StatsCard title="Active Operations" value="12" subtext="Pending processing" icon={<FileText />} />
                <StatsCard title="Network Status" value="Solana Devnet" subtext="Ready for USD1" icon={<LayoutDashboard />} />
              </div>
            )}
            {/* Conditional Modules */}
            {role === 'gov' && (
                <TenderModule /> 
            )}
            
            {/* Для поставщиков мы ТОЖЕ показываем тендеры, так как они там участвуют */}
            {role === 'supplier' && (
                <InvoiceModule  />
            )}

            {/* Заглушки для остальных модулей пока что */}
            {role === 'employee' && (
                 <PayrollModule currentUser={{ wallet: 'HR_WALLET_DEMO', name: 'HR Department' }} />
            )}

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