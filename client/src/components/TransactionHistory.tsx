import React, { useState, useEffect } from 'react';
import { History, ExternalLink, X } from 'lucide-react';

interface TxRecord {
    hash: string;
    type: string;
    timestamp: number;
}

export const TransactionHistory = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<TxRecord[]>([]);

    const loadHistory = () => {
        const stored = localStorage.getItem('shadow_tx_history');
        if (stored) setHistory(JSON.parse(stored).reverse());
    };

    // Слушаем событие обновления истории (кастомное)
    useEffect(() => {
        loadHistory();
        window.addEventListener('tx_history_updated', loadHistory);
        return () => window.removeEventListener('tx_history_updated', loadHistory);
    }, []);

    // Функция парсинга Internal TX (где два хеша)
    const renderLinks = (hashString: string) => {
        // Проверяем формат "TX1:hash TX2:hash"
        if (hashString.includes('TX1:')) {
            const tx1 = hashString.match(/TX1:(\w+)/)?.[1];
            const tx2 = hashString.match(/TX2:(\w+)/)?.[1];
            return (
                <div className="flex gap-2 text-xs mt-1">
                    {tx1 && <a href={`https://solscan.io/tx/${tx1}`} target="_blank" className="text-emerald-400 hover:underline flex items-center gap-1">Proof <ExternalLink size={10}/></a>}
                    {tx2 && <a href={`https://solscan.io/tx/${tx2}`} target="_blank" className="text-emerald-400 hover:underline flex items-center gap-1">Transfer <ExternalLink size={10}/></a>}
                </div>
            );
        }
        // Обычный хеш
        return (
            <a href={`https://solscan.io/tx/${hashString}`} target="_blank" className="text-emerald-400 hover:underline flex items-center gap-1 text-xs mt-1">
                View on Solscan <ExternalLink size={10}/>
            </a>
        );
    };

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-slate-400 hover:text-white transition-colors relative">
                <History size={20} />
                {history.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full"></span>}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-12 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                        <h4 className="font-bold text-white text-sm">Recent Transactions</h4>
                        <button onClick={() => setIsOpen(false)}><X size={14} className="text-slate-400 hover:text-white"/></button>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {history.map((tx, i) => (
                            <div key={i} className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                                <div className="flex justify-between">
                                    <span className="text-xs font-bold text-slate-300 uppercase">{tx.type}</span>
                                    <span className="text-[10px] text-slate-500">{new Date(tx.timestamp).toLocaleTimeString()}</span>
                                </div>
                                {renderLinks(tx.hash)}
                            </div>
                        ))}
                        {history.length === 0 && <p className="text-slate-500 text-xs text-center py-2">No transactions yet</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

// Хелпер для сохранения (экспортируй его или просто скопируй в utils)
export const saveTxToHistory = (hash: string, type: string) => {
    const stored = JSON.parse(localStorage.getItem('shadow_tx_history') || '[]');
    stored.push({ hash, type, timestamp: Date.now() });
    localStorage.setItem('shadow_tx_history', JSON.stringify(stored.slice(-10))); // Храним последние 10
    window.dispatchEvent(new Event('tx_history_updated')); // Уведомляем компонент
};