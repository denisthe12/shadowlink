import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '../utils/api';
import type {Employee, User as ApiUser} from '../utils/api';
import { Plus, Users, Trash2, Play, CheckCircle, Loader2, Edit2, Wallet, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useShadowWire } from '../hooks/useShadowWire';
import { saveTxToHistory } from './TransactionHistory';

interface PaymentStatus {
    employeeId: string;
    status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
    txHash?: string;
    error?: string;
}

interface PayrollModuleProps {
    currentUser: ApiUser | null;
}

export const PayrollModule = ({ currentUser }: PayrollModuleProps) => {
    const { publicKey, signMessage } = useWallet();
    const { client: shadowClient } = useShadowWire();
    
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Форма добавления/редактирования
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ 
        name: '', 
        walletAddress: '', 
        salary: '', 
        paymentType: 'external' as 'internal' | 'external' 
    });

    // Состояние массовой выплаты
    const [isPaying, setIsPaying] = useState(false);
    const [paymentStatuses, setPaymentStatuses] = useState<Record<string, PaymentStatus>>({});
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        if(currentUser) loadData();
    }, [currentUser]);

    const loadData = async () => {
        if(!currentUser) return;
        setLoading(true);
        try {
            const res = await api.getEmployees(currentUser.walletAddress);
            setEmployees(res.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleSaveEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        // Валидация Salary
        if (Number(formData.salary) < 5) {
            toast.error("Minimum salary is 5 USD1 (Protocol requirement)");
            return;
        }

        // Валидация Internal (проверка регистрации)
        if (formData.paymentType === 'internal') {
            const toastId = toast.loading("Checking registration...");
            try {
                const status = await api.checkUserStatus(formData.walletAddress);
                if (!status.data.isRegistered) {
                    toast.error("Employee is NOT registered in ShadowWire. Cannot use Internal transfer.", { id: toastId });
                    return;
                }
                toast.dismiss(toastId);
            } catch (e) {
                toast.error("Verification failed", { id: toastId });
                return;
            }
        }

        setLoading(true);
        try {
            if (editingId) {
                // Edit (Clean API call)
                await api.updateEmployee(editingId, {
                    ...formData,
                    salary: Number(formData.salary)
                });
                toast.success("Employee updated");
            } else {
                // Add
                await api.addEmployee({
                    ...formData,
                    salary: Number(formData.salary),
                    employerWallet: currentUser.walletAddress
                });
                toast.success("Employee added");
            }
            
            setShowModal(false);
            setFormData({ name: '', walletAddress: '', salary: '', paymentType: 'external' });
            setEditingId(null);
            loadData();
        } catch (e) {
            console.error(e);
            toast.error("Failed to save");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (emp: Employee) => {
        setFormData({
            name: emp.name,
            walletAddress: emp.walletAddress,
            salary: emp.salary.toString(),
            paymentType: (emp as any).paymentType || 'external' // Если поле не пришло, default external
        });
        setEditingId(emp._id);
        setShowModal(true);
    };

    const handleRemove = async (id: string) => {
        if(!confirm("Remove employee?")) return;
        await api.removeEmployee(id);
        loadData();
    };

    // --- ГЛАВНАЯ ЛОГИКА ВЫПЛАТ (REAL BATCH PROCESS) ---
    const handlePayAll = async () => {
        if (!publicKey || !signMessage) {
            toast.error("Connect wallet first!");
            return;
        }
        
        setIsPaying(true);
        toast(`Starting payroll run`, { icon: '💸' });

        const initialStatuses: Record<string, PaymentStatus> = {};
        employees.forEach(e => {
            initialStatuses[e._id] = { employeeId: e._id, status: 'pending' };
        });
        setPaymentStatuses(initialStatuses);

        for (let i = 0; i < employees.length; i++) {
            const emp = employees[i];
            setCurrentStep(i + 1);
            
            setPaymentStatuses(prev => ({
                ...prev,
                [emp._id]: { ...prev[emp._id], status: 'processing' }
            }));

            try {
                // РЕАЛЬНЫЙ SHADOWWIRE ПЕРЕВОД
                const type = (emp as any).paymentType || 'external';
                console.log(`Paying ${emp.name} via ${type}...`);

                // Если internal, а мы сами не зарегистрированы -> ошибка
                if (type === 'internal' && !currentUser?.isRegistered) {
                    throw new Error("You are not registered for Internal transfers");
                }

                const result = await shadowClient.transfer({
                    sender: publicKey.toBase58(),
                    recipient: emp.walletAddress,
                    amount: emp.salary, // USD1
                    token: 'USD1',
                    type: type,
                    wallet: { signMessage }
                });

                if (result.tx_signature) {
                    setPaymentStatuses(prev => ({
                        ...prev,
                        [emp._id]: { status: 'completed', employeeId: emp._id, txHash: result.tx_signature }
                    }));
                    saveTxToHistory(result.tx_signature, 'Payroll Salary');
                } else {
                    throw new Error((result as any).error || "Tx failed");
                }

            } catch (error: any) {
                console.error(error);
                setPaymentStatuses(prev => ({
                    ...prev,
                    [emp._id]: { status: 'failed', employeeId: emp._id, error: error.message }
                }));
                // Не прерываем цикл, платим остальным!
            }
        }

        setIsPaying(false);
        toast.success("Payroll run finished!");
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
                    <button onClick={() => { setShowModal(true); setEditingId(null); setFormData({name:'', walletAddress:'', salary:'', paymentType:'external'})}} className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                        <Plus size={16} /> Add Employee
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

            {/* MODAL (ADD / EDIT) */}
            {showModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[100] flex items-center justify-center p-4 !m-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <form onSubmit={handleSaveEmployee} className="bg-white p-8 rounded-2xl w-full max-w-md relative z-10 space-y-4 shadow-xl">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-lg">{editingId ? 'Edit Employee' : 'Add New Employee'}</h3>
                            <button type="button" onClick={() => setShowModal(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Name</label>
                            <input required className="w-full border p-2 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Wallet Address</label>
                            <input required className="w-full border p-2 rounded font-mono text-sm" value={formData.walletAddress} onChange={e => setFormData({...formData, walletAddress: e.target.value})} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Salary (USD1)</label>
                                <input required type="number" min="5" placeholder="Min 5" step="0.01" className="w-full border p-2 rounded" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Payment Type</label>
                                <select className="w-full border p-2 rounded bg-white" value={formData.paymentType} onChange={e => setFormData({...formData, paymentType: e.target.value as any})}>
                                    <option value="external">External</option>
                                    <option value="internal">Internal (Private)</option>
                                </select>
                            </div>
                        </div>

                        <button className="w-full bg-slate-900 text-white py-2 rounded font-bold mt-2">Save Employee</button>
                    </form>
                </div>
            )}

            {/* Employees List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                        <tr>
                            <th className="p-4">Employee</th>
                            <th className="p-4">Wallet</th>
                            <th className="p-4">Salary</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {employees.map(emp => {
                            const statusObj = paymentStatuses[emp._id];
                            const status = statusObj ? statusObj.status : 'idle';
                            // Приводим тип, так как в интерфейсе Employee пока нет paymentType (если ты не обновил api.ts)
                            const pType = (emp as any).paymentType || 'external';

                            return (
                                <tr key={emp._id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-800">{emp.name}</td>
                                    <td className="p-4 text-slate-500 font-mono text-xs">{emp.walletAddress.slice(0, 6)}...{emp.walletAddress.slice(-4)}</td>
                                    <td className="p-4 font-bold text-slate-700">${emp.salary.toLocaleString()}</td>
                                    <td className="p-4">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${pType === 'internal' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {pType}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {status === 'processing' && <span className="text-amber-500 flex items-center gap-1 text-xs font-bold"><Loader2 size={12} className="animate-spin"/> Encrypting...</span>}
                                        {status === 'completed' && <span className="text-emerald-500 flex items-center gap-1 text-xs font-bold"><CheckCircle size={12}/> Sent</span>}
                                        {status === 'failed' && <span className="text-red-500 text-xs font-bold" title={statusObj?.error}>Failed</span>}
                                        {status === 'idle' && <span className="text-slate-400 text-xs">Ready</span>}
                                    </td>
                                    <td className="p-4 text-right flex justify-end gap-2">
                                        <button onClick={() => handleEdit(emp)} className="text-slate-400 hover:text-emerald-600 transition-colors">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleRemove(emp._id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {employees.length === 0 && (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No employees added yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};