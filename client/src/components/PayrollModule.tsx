import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type {Employee} from '../utils/api';
import { api } from '../utils/api';
import { Plus, Users, Trash2, Play, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// Интерфейс для статуса выплаты
interface PaymentStatus {
    employeeId: string;
    status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
    txHash?: string;
}

export const PayrollModule = ({ currentUser }: { currentUser: any }) => {
    const { publicKey } = useWallet();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Форма добавления
    const [showAdd, setShowAdd] = useState(false);
    const [newEmp, setNewEmp] = useState({ name: '', walletAddress: '', salary: '' });

    // Состояние массовой выплаты
    const [isPaying, setIsPaying] = useState(false);
    const [paymentStatuses, setPaymentStatuses] = useState<Record<string, PaymentStatus>>({});
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        loadData();
    }, [currentUser]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.getEmployees(currentUser.wallet);
            setEmployees(res.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await api.addEmployee({
            ...newEmp,
            salary: Number(newEmp.salary),
            employerWallet: currentUser.wallet
        });
        setNewEmp({ name: '', walletAddress: '', salary: '' });
        setShowAdd(false);
        loadData();
        toast.success("Employee added");
    };

    const handleRemove = async (id: string) => {
        if(!confirm("Remove employee?")) return;
        await api.removeEmployee(id);
        loadData();
    };

    // --- ГЛАВНАЯ ЛОГИКА ВЫПЛАТ (BATCH PROCESS) ---
    const handlePayAll = async () => {
        if (!publicKey) {
            toast.error("Connect wallet first!");
            return;
        }
        
        setIsPaying(true);
        const total = employees.reduce((sum, e) => sum + e.salary, 0);
        toast(`Starting payroll run: $${total}`, { icon: '💸' });

        // Инициализируем статусы
        const initialStatuses: Record<string, PaymentStatus> = {};
        employees.forEach(e => {
            initialStatuses[e._id] = { employeeId: e._id, status: 'pending' };
        });
        setPaymentStatuses(initialStatuses);

        // Последовательно платим каждому (Loop)
        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            setCurrentStep(i + 1);
            
            // Ставим статус "В процессе"
            setPaymentStatuses(prev => ({
                ...prev,
                [emp._id]: { ...prev[emp._id], status: 'processing' }
            }));

            try {
                // Эмуляция ShadowWire (в реале тут будет client.transfer)
                // console.log(`Encrypting payment for ${emp.name}...`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 сек на генерацию пруфа

                // Успех
                setPaymentStatuses(prev => ({
                    ...prev,
                    [emp._id]: { status: 'completed', employeeId: emp._id, txHash: 'Encrypted_Tx_' + Math.random().toString(36).substr(2, 9) }
                }));
            } catch (error) {
                setPaymentStatuses(prev => ({
                    ...prev,
                    [emp._id]: { status: 'failed', employeeId: emp._id }
                }));
            }
        }

        setIsPaying(false);
        toast.success("Payroll run completed!");
    };

    return (
        <div className="space-y-6">
            {/* Header & Stats */}
            <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                        <Users className="text-emerald-500" /> Employees ({employees.length})
                    </h3>
                    <p className="text-slate-500 text-sm">Total Monthly Payroll: <span className="font-bold text-slate-900">${employees.reduce((a,b)=>a+b.salary, 0).toLocaleString()}</span></p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowAdd(!showAdd)} className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                        <Plus size={16} /> Add
                    </button>
                    <button 
                        onClick={handlePayAll} 
                        disabled={isPaying || employees.length === 0}
                        className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-200"
                    >
                        {isPaying ? <Loader2 className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                        {isPaying ? `Processing ${currentStep}/${employees.length}` : 'Run Payroll'}
                    </button>
                </div>
            </div>

            {/* Add Form */}
            {showAdd && (
                <form onSubmit={handleAddEmployee} className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500">Name</label>
                        <input required placeholder="John Doe" className="w-full border p-2 rounded" value={newEmp.name} onChange={e => setNewEmp({...newEmp, name: e.target.value})} />
                    </div>
                    <div className="flex-[2]">
                        <label className="text-xs font-bold text-slate-500">Wallet Address</label>
                        <input required placeholder="Solana Address" className="w-full border p-2 rounded" value={newEmp.walletAddress} onChange={e => setNewEmp({...newEmp, walletAddress: e.target.value})} />
                    </div>
                    <div className="w-32">
                        <label className="text-xs font-bold text-slate-500">Salary ($)</label>
                        <input required type="number" className="w-full border p-2 rounded" value={newEmp.salary} onChange={e => setNewEmp({...newEmp, salary: e.target.value})} />
                    </div>
                    <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded font-bold">Save</button>
                </form>
            )}

            {/* Employees List with Real-time Status */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                        <tr>
                            <th className="p-4">Employee</th>
                            <th className="p-4">Wallet</th>
                            <th className="p-4">Salary</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {employees.map(emp => {
                            const statusObj = paymentStatuses[emp._id];
                            const status = statusObj ? statusObj.status : 'idle';
                            return (
                                <tr key={emp._id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-800">{emp.name}</td>
                                    <td className="p-4 text-slate-500 font-mono text-xs">{emp.walletAddress.slice(0, 6)}...{emp.walletAddress.slice(-4)}</td>
                                    <td className="p-4 font-bold text-slate-700">${emp.salary.toLocaleString()}</td>
                                    <td className="p-4">
                                        {status === 'processing' && <span className="text-amber-500 flex items-center gap-1 text-xs font-bold"><Loader2 size={12} className="animate-spin"/> Encrypting...</span>}
                                        {status === 'completed' && <span className="text-emerald-500 flex items-center gap-1 text-xs font-bold"><CheckCircle size={12}/> Paid (Private)</span>}
                                        {status === 'idle' && <span className="text-slate-400 text-xs">Ready</span>}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => handleRemove(emp._id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {employees.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">No employees added yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};