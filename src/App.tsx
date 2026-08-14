import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import printJS from 'print-js';
import { 
  LayoutDashboard, 
  Wallet, 
  Package, 
  Receipt, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Plus, 
  Trash2, 
  Edit, 
  ShoppingCart,
  FileSpreadsheet, 
  FileText,
  AlertCircle,
  Check,
  UserPlus,
  Coins,
  TrendingUp,
  History,
  Eye,
  EyeOff
} from 'lucide-react';
import { AppProvider, useAppContext } from './contexts/AppContext';
import './i18n';

// Utilities
const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

const exportToPDF = (data: any[], title: string) => {
  const doc = new jsPDF();
  doc.text(title, 20, 10);
  (doc as any).autoTable({
    body: data,
  });
  doc.save(`${title}.pdf`);
};

// Components
const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${
      active ? 'bg-white/40 shadow-inner' : 'hover:bg-white/20'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </motion.button>
);

const GlassCard = ({ children, className = "" }: any) => (
  <div className={`glass-card p-6 ${className}`}>
    {children}
  </div>
);

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }: any) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <GlassCard className="w-full max-w-sm bg-white/90">
          <h2 className="text-xl font-bold mb-2">{title || t('confirm')}</h2>
          <p className="opacity-70 mb-6">{message || t('confirm_delete')}</p>
          <div className="flex gap-3">
            <NeumorphicButton onClick={onClose} className="flex-1 py-2">{t('cancel')}</NeumorphicButton>
            <NeumorphicButton onClick={() => { onConfirm(); onClose(); }} className="flex-1 py-2 bg-red-500 text-white font-bold">{t('confirm')}</NeumorphicButton>
          </div>
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  );
};

const Notification = ({ message, type = 'success', onClose }: any) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: 50 }}
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-lg z-[200] flex items-center gap-3 ${
        type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      }`}
    >
      {type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
      <span className="font-bold">{message}</span>
    </motion.div>
  );
};

const NeumorphicButton = ({ children, onClick, className = "", disabled = false }: any) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={`neumorphic-btn disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

// Pages
const Dashboard = () => {
  const { t } = useTranslation();
  const { setActiveTab, user } = useAppContext();
  const [treasury, setTreasury] = useState<any>({
    cash_200: 0, cash_100: 0, cash_50: 0, cash_20: 0, cash_10: 0, cash_5: 0,
    fawry: 0, neopay: 0, superpay: 0, new_machine1: 0, new_machine2: 0
  });
  const [wallets, setWallets] = useState<any[]>([]);
  const [treasuryLogs, setTreasuryLogs] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const defaultMachineNames: Record<string, string> = {
    fawry: 'فوري', neopay: 'نيوباي', superpay: 'سوبرباي',
    new_machine1: 'ماكينة 1', new_machine2: 'ماكينة 2'
  };
  const loadMachineNames = () => {
    try { return { ...defaultMachineNames, ...JSON.parse(localStorage.getItem('machine_names') || '{}') }; }
    catch { return defaultMachineNames; }
  };
  const [machineNames, setMachineNames] = useState<Record<string, string>>(loadMachineNames);
  const [editingMachineName, setEditingMachineName] = useState<string | null>(null);

  const saveMachineName = (key: string, name: string) => {
    const updated = { ...machineNames, [key]: name };
    setMachineNames(updated);
    localStorage.setItem('machine_names', JSON.stringify(updated));
    setEditingMachineName(null);
  };

  useEffect(() => {
    fetch('/api/wallets').then(res => res.json()).then(setWallets);
    fetch('/api/treasury/latest').then(res => res.json()).then(data => {
      if (data && data.id) setTreasury(data);
    });
  }, []);

  const fetchTreasuryLogs = async () => {
    const res = await fetch('/api/treasury');
    const data = await res.json();
    setTreasuryLogs(data);
    setShowHistory(true);
  };

  const handleSaveTreasury = async () => {
    const res = await fetch('/api/treasury', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(treasury)
    });
    if (res.ok) {
      setNotification({ message: "تم حفظ بيانات الخزينة والماكينات بنجاح", type: 'success' });
      if (showHistory) fetchTreasuryLogs();
    }
  };

  const handleUpdateLog = async () => {
    if (!editingLog) return;
    const res = await fetch(`/api/treasury/${editingLog.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingLog)
    });
    if (res.ok) {
      setNotification({ message: "تم تحديث السجل بنجاح", type: 'success' });
      setEditingLog(null);
      fetchTreasuryLogs();
      // If it was the latest, update the main view
      if (treasuryLogs[0]?.id === editingLog.id) setTreasury(editingLog);
    }
  };

  const handleDeleteLog = async (id: number) => {
    const res = await fetch(`/api/treasury/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTreasuryLogs(treasuryLogs.filter(l => l.id !== id));
      setNotification({ message: t('delete_success'), type: 'success' });
    }
  };

  const calculateTotalCash = (data = treasury) => {
    return (Number(data.cash_200) * 200) + (Number(data.cash_100) * 100) + (Number(data.cash_50) * 50) + 
           (Number(data.cash_20) * 20) + (Number(data.cash_10) * 10) + (Number(data.cash_5) * 5);
  };

  const calculateTotalMachines = (data = treasury) => {
    return Number(data.fawry || 0) + Number(data.neopay || 0) + Number(data.superpay || 0) + 
           Number(data.new_machine1 || 0) + Number(data.new_machine2 || 0);
  };

  const calculateTotalWallets = () => {
    return wallets.reduce((acc, w) => acc + w.balance, 0);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
        <div className="flex gap-2">
          <NeumorphicButton onClick={fetchTreasuryLogs} className="bg-blue-600 text-white flex items-center gap-2">
            <BarChart3 size={18} /> سجل الخزينة
          </NeumorphicButton>
          <NeumorphicButton onClick={handleSaveTreasury} className="bg-green-600 text-white flex items-center gap-2">
            <Settings size={18} /> حفظ بيانات الخزينة والماكينات
          </NeumorphicButton>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard className="bg-blue-500/10">
          <h2 className="text-sm font-bold opacity-60 uppercase">{t('total')} {t('cash')}</h2>
          <div className="text-3xl font-black text-blue-600">{calculateTotalCash()}</div>
        </GlassCard>
        <GlassCard className="bg-cyan-500/10">
          <h2 className="text-sm font-bold opacity-60 uppercase">{t('total')} {t('wallets')}</h2>
          <div className="text-3xl font-black text-cyan-600">{calculateTotalWallets()}</div>
        </GlassCard>
        <GlassCard className="bg-purple-500/10">
          <h2 className="text-sm font-bold opacity-60 uppercase">{t('total')} {t('machines')}</h2>
          <div className="text-3xl font-black text-purple-600">{calculateTotalMachines()}</div>
        </GlassCard>
        <GlassCard className="bg-green-500/10">
          <h2 className="text-sm font-bold opacity-60 uppercase">{t('total')} {t('treasury')}</h2>
          <div className="text-3xl font-black text-green-600">
            {calculateTotalCash() + calculateTotalMachines() + calculateTotalWallets()}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Receipt className="text-blue-500" /> {t('treasury')}
          </h2>
          <div className="space-y-3">
            {[200, 100, 50, 20, 10, 5].map(val => (
              <div key={val} className="flex items-center justify-between">
                <label className="text-sm font-bold">{val} *</label>
                <input 
                  type="number" 
                  className="glass-input w-20 text-center" 
                  value={treasury[`cash_${val}`]}
                  onChange={(e) => setTreasury({...treasury, [`cash_${val}`]: e.target.value})}
                />
                <span className="w-24 text-right">{(Number(treasury[`cash_${val}`]) || 0) * val}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="text-cyan-500" /> {t('machines')}
          </h2>
          <div className="space-y-3">
            {(['fawry', 'neopay', 'superpay', 'new_machine1', 'new_machine2'] as const).map(key => (
              <div key={key} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 min-w-0">
                  {editingMachineName === key ? (
                    <input
                      autoFocus
                      className="glass-input text-sm font-bold w-28"
                      defaultValue={machineNames[key]}
                      onBlur={e => saveMachineName(key, e.target.value || defaultMachineNames[key])}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingMachineName(null);
                      }}
                    />
                  ) : (
                    <>
                      <label className="text-sm font-bold">{machineNames[key]}</label>
                      <button
                        onClick={() => setEditingMachineName(key)}
                        className="text-slate-400 hover:text-blue-500 transition-colors p-0.5 rounded"
                        title="تغيير الاسم"
                      >
                        <Edit size={13} />
                      </button>
                    </>
                  )}
                </div>
                <input 
                  type="number" 
                  className="glass-input w-32 text-center" 
                  value={treasury[key]}
                  onChange={(e) => setTreasury({...treasury, [key]: e.target.value})}
                />
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Treasury History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-5xl bg-white/90 max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">سجل بيانات الخزينة والماكينات</h2>
                <button onClick={() => setShowHistory(false)}><X /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-right text-sm">
                  <thead className="sticky top-0 bg-white/90 backdrop-blur-sm">
                    <tr className="border-b border-white/20">
                      <th className="p-2">التاريخ</th>
                      <th className="p-2">إجمالي النقدية</th>
                      <th className="p-2">إجمالي الماكينات</th>
                      <th className="p-2">الإجمالي</th>
                      <th className="p-2">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treasuryLogs.map(log => (
                      <tr key={log.id} className="border-b border-white/10 hover:bg-white/10 transition-colors">
                        <td className="p-2">{new Date(log.date).toLocaleString()}</td>
                        <td className="p-2 font-bold text-blue-600">{calculateTotalCash(log)}</td>
                        <td className="p-2 font-bold text-purple-600">{calculateTotalMachines(log)}</td>
                        <td className="p-2 font-bold text-green-600">{calculateTotalCash(log) + calculateTotalMachines(log)}</td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <button onClick={() => setEditingLog(log)} className="p-1 text-amber-500 hover:bg-amber-500/10 rounded-lg"><Edit size={16} /></button>
                            {user?.role === 'admin' && (
                              <button onClick={() => setDeleteConfirmId(log.id)} className="p-1 text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 size={16} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Treasury Log Modal */}
      <AnimatePresence>
        {editingLog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-4xl bg-white/95 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">تعديل سجل الخزينة</h2>
                <button onClick={() => setEditingLog(null)}><X /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-bold border-b pb-2">النقدية</h3>
                  {[200, 100, 50, 20, 10, 5].map(val => (
                    <div key={val} className="flex items-center justify-between">
                      <label className="text-sm font-bold">{val} *</label>
                      <input 
                        type="number" 
                        className="glass-input w-24 text-center" 
                        value={editingLog[`cash_${val}`]}
                        onChange={(e) => setEditingLog({...editingLog, [`cash_${val}`]: e.target.value})}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <h3 className="font-bold border-b pb-2">{t('machines')}</h3>
                  {(['fawry', 'neopay', 'superpay', 'new_machine1', 'new_machine2'] as const).map(key => (
                    <div key={key} className="flex items-center justify-between">
                      <label className="text-sm font-bold">{machineNames[key]}</label>
                      <input 
                        type="number" 
                        className="glass-input w-32 text-center" 
                        value={editingLog[key]}
                        onChange={(e) => setEditingLog({...editingLog, [key]: e.target.value})}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-4">
                <NeumorphicButton onClick={() => setEditingLog(null)} className="bg-gray-500 text-white px-6">إلغاء</NeumorphicButton>
                <NeumorphicButton onClick={handleUpdateLog} className="bg-blue-600 text-white px-8">حفظ التعديلات</NeumorphicButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={!!deleteConfirmId} 
        onClose={() => setDeleteConfirmId(null)} 
        onConfirm={() => deleteConfirmId && handleDeleteLog(deleteConfirmId)} 
      />
      <AnimatePresence>
        {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      </AnimatePresence>
    </motion.div>
  );
};

const Wallets = () => {
  const { t } = useTranslation();
  const { user } = useAppContext();
  const [wallets, setWallets] = useState<any[]>([]);
  const [newWallet, setNewWallet] = useState({ name: '', number: '', monthly_withdraw_limit: 50000, monthly_deposit_limit: 50000, daily_withdraw_limit: 10000, daily_deposit_limit: 10000, balance: 0 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeView, setActiveView] = useState<'manage' | 'operations'>('operations');
  const [editingWallet, setEditingWallet] = useState<any | null>(null);
  const [historyWallet, setHistoryWallet] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/wallets').then(res => res.json()).then(setWallets);
  }, []);

  const handleAddWallet = async () => {
    const res = await fetch('/api/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newWallet)
    });
    if (res.ok) {
      const data = await res.json();
      setWallets([...wallets, { 
        ...newWallet, 
        id: data.id, 
        monthly_withdraw_limit_rem: newWallet.monthly_withdraw_limit, 
        monthly_deposit_limit_rem: newWallet.monthly_deposit_limit, 
        daily_withdraw_limit_rem: newWallet.daily_withdraw_limit, 
        daily_deposit_limit_rem: newWallet.daily_deposit_limit 
      }]);
      setNewWallet({ name: '', number: '', monthly_withdraw_limit: 50000, monthly_deposit_limit: 50000, daily_withdraw_limit: 10000, daily_deposit_limit: 10000, balance: 0 });
      setShowAddForm(false);
    } else {
      const data = await res.json();
      setNotification({ message: data.error || "Failed to add wallet", type: 'error' });
    }
  };

  const handleUpdateWallet = async () => {
    if (!editingWallet) return;
    
    const originalWallet = wallets.find(w => w.id === editingWallet.id);
    const updatedWallet = { ...editingWallet };
    
    if (originalWallet) {
      if (editingWallet.monthly_withdraw_limit !== originalWallet.monthly_withdraw_limit) {
        updatedWallet.monthly_withdraw_limit_rem = editingWallet.monthly_withdraw_limit;
      }
      if (editingWallet.monthly_deposit_limit !== originalWallet.monthly_deposit_limit) {
        updatedWallet.monthly_deposit_limit_rem = editingWallet.monthly_deposit_limit;
      }
      if (editingWallet.daily_withdraw_limit !== originalWallet.daily_withdraw_limit) {
        updatedWallet.daily_withdraw_limit_rem = editingWallet.daily_withdraw_limit;
      }
      if (editingWallet.daily_deposit_limit !== originalWallet.daily_deposit_limit) {
        updatedWallet.daily_deposit_limit_rem = editingWallet.daily_deposit_limit;
      }
    }

    const res = await fetch(`/api/wallets/${editingWallet.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedWallet)
    });
    if (res.ok) {
      setWallets(wallets.map(w => w.id === editingWallet.id ? updatedWallet : w));
      setEditingWallet(null);
    }
  };

  const fetchHistory = async (id: number) => {
    const res = await fetch(`/api/wallets/${id}/transactions`);
    const data = await res.json();
    setTransactions(data);
    setHistoryWallet(wallets.find(w => w.id === id));
  };

  const handleDeleteTransaction = async (id: number) => {
    const res = await fetch(`/api/wallets/transactions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTransactions(transactions.filter(tx => tx.id !== id));
      fetch('/api/wallets').then(res => res.json()).then(setWallets);
      setNotification({ message: t('delete_success'), type: 'success' });
    }
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;
    const res = await fetch(`/api/wallets/transactions/${editingTransaction.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(editingTransaction.amount) })
    });
    if (res.ok) {
      setTransactions(transactions.map(tx => tx.id === editingTransaction.id ? editingTransaction : tx));
      fetch('/api/wallets').then(res => res.json()).then(setWallets);
      setEditingTransaction(null);
      setNotification({ message: t('update_success'), type: 'success' });
    }
  };
  const handleDeleteWallet = async (id: number) => {
    const res = await fetch(`/api/wallets/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setWallets(wallets.filter(w => w.id !== id));
      setDeleteConfirmId(null);
    }
  };

  const handleTransaction = async (id: number, type: 'withdraw' | 'deposit', amount: number) => {
    if (!amount || amount <= 0) {
      setNotification({ message: "يرجى إدخال مبلغ صحيح", type: 'error' });
      return;
    }

    const wallet = wallets.find(w => w.id === id);
    if (wallet) {
      if (type === 'withdraw') {
        if (amount > (wallet.daily_withdraw_limit_rem ?? 10000)) {
          setNotification({ message: "المبلغ يتجاوز الحد اليومي للسحب المتبقي", type: 'error' });
          return;
        }
        if (amount > (wallet.monthly_withdraw_limit_rem ?? 50000)) {
          setNotification({ message: "المبلغ يتجاوز الحد الشهري للسحب المتبقي", type: 'error' });
          return;
        }
      } else {
        if (amount > (wallet.balance ?? 0)) {
          setNotification({ message: "المبلغ المراد إيداعه أكبر من رصيد المحفظة", type: 'error' });
          return;
        }
        if (amount > (wallet.daily_deposit_limit_rem ?? 10000)) {
          setNotification({ message: "المبلغ يتجاوز الحد اليومي للإيداع المتبقي", type: 'error' });
          return;
        }
        if (amount > (wallet.monthly_deposit_limit_rem ?? 50000)) {
          setNotification({ message: "المبلغ يتجاوز الحد الشهري للإيداع المتبقي", type: 'error' });
          return;
        }
      }
    }
    
    const res = await fetch(`/api/wallets/${id}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount })
    });

    if (res.ok) {
      const updated = wallets.map(w => {
        if (w.id === id) {
          if (type === 'withdraw') {
            return { 
              ...w, 
              balance: w.balance + amount,
              daily_withdraw_limit_rem: (w.daily_withdraw_limit_rem ?? 10000) - amount,
              monthly_withdraw_limit_rem: (w.monthly_withdraw_limit_rem ?? 50000) - amount
            };
          } else {
            return { 
              ...w, 
              balance: w.balance - amount,
              daily_deposit_limit_rem: (w.daily_deposit_limit_rem ?? 10000) - amount,
              monthly_deposit_limit_rem: (w.monthly_deposit_limit_rem ?? 50000) - amount
            };
          }
        }
        return w;
      });
      setWallets(updated);
      const input = document.getElementById(`amt-${id}`) as HTMLInputElement;
      if (input) input.value = '';
      
      const btn = document.activeElement as HTMLElement;
      const originalText = btn.innerText;
      btn.innerText = "تمت العملية ✅";
      setTimeout(() => {
        btn.innerText = originalText;
      }, 2000);
    } else {
      const data = await res.json();
      setNotification({ message: data.error || "فشلت العملية", type: 'error' });
    }
  };

  const handleExportWalletHistoryExcel = () => {
    if (!historyWallet || transactions.length === 0) return;
    const exportData = transactions.map(tx => ({
      [t('type')]: tx.type === 'withdraw' ? 'سحب (Cash Out)' : 'إيداع (Cash In)',
      [t('amount')]: tx.amount,
      [t('date')]: new Date(tx.date).toLocaleString()
    }));
    exportToExcel(exportData, `Wallet_${historyWallet.name}_History`);
  };

  const handleExportWalletHistoryPDF = () => {
    if (!historyWallet || transactions.length === 0) return;
    const exportData = transactions.map(tx => [
      tx.type === 'withdraw' ? 'سحب (Cash Out)' : 'إيداع (Cash In)',
      tx.amount,
      new Date(tx.date).toLocaleString()
    ]);
    exportToPDF(exportData, `History - ${historyWallet.name} (${historyWallet.number})`);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold">{t('wallets')}</h1>
        <div className="flex gap-2">
          <NeumorphicButton 
            onClick={() => setActiveView('operations')}
            className={`flex items-center gap-2 ${activeView === 'operations' ? 'bg-blue-500 text-white' : ''}`}
          >
            <Wallet size={18} /> عمليات المحافظ
          </NeumorphicButton>
          <NeumorphicButton 
            onClick={() => setActiveView('manage')}
            className={`flex items-center gap-2 ${activeView === 'manage' ? 'bg-blue-500 text-white' : ''}`}
          >
            <Settings size={18} /> إدارة المحافظ
          </NeumorphicButton>
        </div>
      </div>

      {activeView === 'manage' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex justify-between items-center bg-white/40 p-4 rounded-2xl border border-white/20">
            <h2 className="text-xl font-bold">قائمة المحافظ</h2>
            {user?.role === 'admin' && (
              <NeumorphicButton 
                onClick={() => setShowAddForm(!showAddForm)} 
                className={`flex items-center gap-2 ${showAddForm ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
              >
                {showAddForm ? <X size={18} /> : <Plus size={18} />} {showAddForm ? 'إلغاء' : 'إضافة محفظة جديدة'}
              </NeumorphicButton>
            )}
          </div>

          {showAddForm && (
            <GlassCard className="border-2 border-green-500/30">
              <h3 className="text-lg font-bold mb-4">بيانات المحفظة الجديدة</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
                <div className="space-y-1">
                  <label className="text-xs ml-2 opacity-60">{t('wallet_name')}</label>
                  <input placeholder="مثال: فودافون كاش 1" className="glass-input w-full" value={newWallet.name} onChange={e => setNewWallet({...newWallet, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs ml-2 opacity-60">{t('wallet_number')}</label>
                  <input placeholder="01xxxxxxxxx" className="glass-input w-full" value={newWallet.number} onChange={e => setNewWallet({...newWallet, number: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs ml-2 opacity-60">الحد اليومي للسحب</label>
                  <input type="number" className="glass-input w-full" value={newWallet.daily_withdraw_limit} onChange={e => setNewWallet({...newWallet, daily_withdraw_limit: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs ml-2 opacity-60">الحد اليومي للإيداع</label>
                  <input type="number" className="glass-input w-full" value={newWallet.daily_deposit_limit} onChange={e => setNewWallet({...newWallet, daily_deposit_limit: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs ml-2 opacity-60">الحد الشهري للسحب</label>
                  <input type="number" className="glass-input w-full" value={newWallet.monthly_withdraw_limit} onChange={e => setNewWallet({...newWallet, monthly_withdraw_limit: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs ml-2 opacity-60">الحد الشهري للإيداع</label>
                  <input type="number" className="glass-input w-full" value={newWallet.monthly_deposit_limit} onChange={e => setNewWallet({...newWallet, monthly_deposit_limit: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs ml-2 opacity-60">{t('balance')}</label>
                  <input type="number" className="glass-input w-full" value={newWallet.balance} onChange={e => setNewWallet({...newWallet, balance: Number(e.target.value)})} />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <NeumorphicButton onClick={handleAddWallet} className="bg-green-600 text-white px-8">
                  حفظ المحفظة
                </NeumorphicButton>
              </div>
            </GlassCard>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wallets.map(wallet => (
              <GlassCard key={wallet.id} className="flex justify-between items-center p-6">
                <div>
                  <h3 className="text-lg font-bold">{wallet.name}</h3>
                  <p className="text-sm opacity-60">{wallet.number}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => fetchHistory(wallet.id)}
                    className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-full transition-colors"
                    title={t('transaction_history')}
                  >
                    <Receipt size={20} />
                  </button>
                  {user?.role === 'admin' && (
                    <>
                      <button 
                        onClick={() => setEditingWallet(wallet)}
                        className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-full transition-colors"
                        title={t('edit_wallet')}
                      >
                        <Edit size={20} />
                      </button>
                      {deleteConfirmId === wallet.id ? (
                        <div className="flex gap-2">
                          <NeumorphicButton onClick={() => handleDeleteWallet(wallet.id)} className="bg-red-500 text-white text-xs py-1 px-2">تأكيد</NeumorphicButton>
                          <NeumorphicButton onClick={() => setDeleteConfirmId(null)} className="bg-gray-500 text-white text-xs py-1 px-2">إلغاء</NeumorphicButton>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeleteConfirmId(wallet.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        </motion.div>
      )}

      {activeView === 'operations' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wallets.length === 0 && (
            <div className="col-span-full text-center py-12 opacity-50">لا توجد محافظ مضافة حالياً.</div>
          )}
          {wallets.map(wallet => (
            <GlassCard key={wallet.id} className="relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-12 -mt-12" />
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold">{wallet.name}</h3>
                  <p className="text-sm opacity-60 mb-4">{wallet.number}</p>
                </div>
                <button 
                  onClick={() => fetchHistory(wallet.id)}
                  className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-full transition-colors"
                  title={t('transaction_history')}
                >
                  <Receipt size={20} />
                </button>
              </div>
              
              <div className="space-y-2 mb-6 text-right">
                {/* Withdrawal limits */}
                <div className="border-b border-white/10 pb-2 mb-2">
                  <span className="text-xs font-bold text-green-700 block mb-1">حدود السحب (Cash Out):</span>
                  <div className="flex justify-between text-sm font-bold text-green-600">
                    <span>المتبقي اليومي:</span>
                    <span>{wallet.daily_withdraw_limit_rem}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-green-700">
                    <span>المتبقي الشهري:</span>
                    <span>{wallet.monthly_withdraw_limit_rem}</span>
                  </div>
                </div>

                {/* Deposit limits */}
                <div className="pb-2">
                  <span className="text-xs font-bold text-red-700 block mb-1">حدود الإيداع (Cash In):</span>
                  <div className="flex justify-between text-sm font-bold text-red-600">
                    <span>المتبقي اليومي:</span>
                    <span>{wallet.daily_deposit_limit_rem}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-red-700">
                    <span>المتبقي الشهري:</span>
                    <span>{wallet.monthly_deposit_limit_rem}</span>
                  </div>
                </div>

                <div className="flex justify-between text-lg font-bold border-t border-white/20 pt-2 mt-2">
                  <span>{t('balance')}:</span>
                  <span className="text-slate-800">{wallet.balance}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">المبلغ المراد تحويله</label>
                  <input type="number" id={`amt-${wallet.id}`} placeholder="أدخل المبلغ هنا..." className="glass-input w-full text-center text-lg font-bold" />
                </div>
                <div className="flex gap-2">
                  <NeumorphicButton 
                    onClick={() => {
                      const input = document.getElementById(`amt-${wallet.id}`) as HTMLInputElement;
                      const amt = Number(input.value);
                      handleTransaction(wallet.id, 'withdraw', amt);
                    }}
                    className="flex-1 bg-green-500 text-white font-bold py-3"
                  >
                    سحب (Cash Out)
                  </NeumorphicButton>
                  <NeumorphicButton 
                    onClick={() => {
                      const input = document.getElementById(`amt-${wallet.id}`) as HTMLInputElement;
                      const amt = Number(input.value);
                      handleTransaction(wallet.id, 'deposit', amt);
                    }}
                    className="flex-1 bg-red-500 text-white font-bold py-3"
                  >
                    إيداع (Cash In)
                  </NeumorphicButton>
                </div>
              </div>
            </GlassCard>
          ))}
        </motion.div>
      )}

      {/* Edit Wallet Modal */}
      <AnimatePresence>
        {editingWallet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-md bg-white/80">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('edit_wallet')}</h2>
                <button onClick={() => setEditingWallet(null)}><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs ml-2 opacity-60">{t('wallet_name')}</label>
                  <input className="glass-input w-full" value={editingWallet.name} onChange={e => setEditingWallet({...editingWallet, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs ml-2 opacity-60">{t('wallet_number')}</label>
                  <input className="glass-input w-full" value={editingWallet.number} onChange={e => setEditingWallet({...editingWallet, number: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs ml-2 opacity-60">الحد اليومي للسحب</label>
                    <input type="number" className="glass-input w-full" value={editingWallet.daily_withdraw_limit} onChange={e => setEditingWallet({...editingWallet, daily_withdraw_limit: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs ml-2 opacity-60">المتبقي اليومي للسحب</label>
                    <input type="number" className="glass-input w-full" value={editingWallet.daily_withdraw_limit_rem} onChange={e => setEditingWallet({...editingWallet, daily_withdraw_limit_rem: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs ml-2 opacity-60">الحد اليومي للإيداع</label>
                    <input type="number" className="glass-input w-full" value={editingWallet.daily_deposit_limit} onChange={e => setEditingWallet({...editingWallet, daily_deposit_limit: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs ml-2 opacity-60">المتبقي اليومي للإيداع</label>
                    <input type="number" className="glass-input w-full" value={editingWallet.daily_deposit_limit_rem} onChange={e => setEditingWallet({...editingWallet, daily_deposit_limit_rem: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs ml-2 opacity-60">الحد الشهري للسحب</label>
                    <input type="number" className="glass-input w-full" value={editingWallet.monthly_withdraw_limit} onChange={e => setEditingWallet({...editingWallet, monthly_withdraw_limit: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs ml-2 opacity-60">المتبقي الشهري للسحب</label>
                    <input type="number" className="glass-input w-full" value={editingWallet.monthly_withdraw_limit_rem} onChange={e => setEditingWallet({...editingWallet, monthly_withdraw_limit_rem: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs ml-2 opacity-60">الحد الشهري للإيداع</label>
                    <input type="number" className="glass-input w-full" value={editingWallet.monthly_deposit_limit} onChange={e => setEditingWallet({...editingWallet, monthly_deposit_limit: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs ml-2 opacity-60">المتبقي الشهري للإيداع</label>
                    <input type="number" className="glass-input w-full" value={editingWallet.monthly_deposit_limit_rem} onChange={e => setEditingWallet({...editingWallet, monthly_deposit_limit_rem: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs ml-2 opacity-60">{t('balance')}</label>
                  <input type="number" className="glass-input w-full" value={editingWallet.balance} onChange={e => setEditingWallet({...editingWallet, balance: Number(e.target.value)})} />
                </div>
                <NeumorphicButton onClick={handleUpdateWallet} className="w-full bg-blue-500 text-white font-bold py-4">
                  {t('save')}
                </NeumorphicButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {historyWallet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-2xl bg-white/90 max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{t('transaction_history')}</h2>
                  <p className="text-sm opacity-60">{historyWallet.name} - {historyWallet.number}</p>
                </div>
                <div className="flex gap-2">
                  <NeumorphicButton onClick={handleExportWalletHistoryExcel} className="bg-green-600 text-white p-2" title="Excel">
                    <FileSpreadsheet size={18} />
                  </NeumorphicButton>
                  <NeumorphicButton onClick={handleExportWalletHistoryPDF} className="bg-red-600 text-white p-2" title="PDF">
                    <FileText size={18} />
                  </NeumorphicButton>
                  <button onClick={() => setHistoryWallet(null)} className="p-2 hover:bg-black/5 rounded-full"><X /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-2">
                <table className="w-full text-right">
                  <thead className="sticky top-0 bg-white/90 backdrop-blur-sm">
                    <tr className="border-b border-white/20">
                      <th className="p-3">{t('type')}</th>
                      <th className="p-3">{t('amount')}</th>
                      <th className="p-3">{t('date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id} className="border-b border-white/10 hover:bg-white/10 transition-colors">
                        <td className={`p-3 font-bold ${tx.type === 'withdraw' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'withdraw' ? 'سحب (Cash Out)' : 'إيداع (Cash In)'}
                        </td>
                        <td className="p-3 font-bold">{tx.amount}</td>
                        <td className="p-3 opacity-60 text-xs">{new Date(tx.date).toLocaleString()}</td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button onClick={() => setEditingTransaction(tx)} className="p-1 text-amber-500 hover:bg-amber-500/10 rounded-lg"><Edit size={14} /></button>
                            <button onClick={() => handleDeleteTransaction(tx.id)} className="p-1 text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-10 text-center opacity-50">لا توجد عمليات مسجلة لهذه المحفظة.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingTransaction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-sm bg-white/90">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">{t('edit_transaction')}</h2>
                <button onClick={() => setEditingTransaction(null)}><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">{t('amount')}</label>
                  <input 
                    type="number" 
                    className="glass-input w-full text-center text-xl font-bold" 
                    value={editingTransaction.amount} 
                    onChange={e => setEditingTransaction({...editingTransaction, amount: e.target.value})}
                  />
                </div>
                <div className="flex gap-3">
                  <NeumorphicButton onClick={() => setEditingTransaction(null)} className="flex-1 py-2">{t('cancel')}</NeumorphicButton>
                  <NeumorphicButton onClick={handleUpdateTransaction} className="flex-1 py-2 bg-blue-500 text-white font-bold">{t('save')}</NeumorphicButton>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      </AnimatePresence>
    </motion.div>
  );
};

const Products = () => {
  const { t } = useTranslation();
  const { user } = useAppContext();
  const [products, setProducts] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [showSalesReport, setShowSalesReport] = useState(false);
  const [dailySales, setDailySales] = useState<any[]>([]);
  const [newProduct, setNewProduct] = useState({ name: '', price: 0, quantity: 0, min_quantity: 5, image: '' });
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [sellingProduct, setSellingProduct] = useState<any | null>(null);
  const [sellQty, setSellQty] = useState(1);
  const [editingSale, setEditingSale] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (isEdit) {
          setEditingProduct({ ...editingProduct, image: base64String });
        } else {
          setNewProduct({ ...newProduct, image: base64String });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    fetch('/api/products').then(res => res.json()).then(setProducts);
  }, []);

  const handleAdd = async () => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProduct)
    });
    if (res.ok) {
      const data = await res.json();
      setProducts([...products, { ...newProduct, id: data.id }]);
      setShowAdd(false);
      setNewProduct({ name: '', price: 0, quantity: 0, min_quantity: 5, image: '' });
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    const res = await fetch(`/api/products/${editingProduct.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingProduct)
    });
    if (res.ok) {
      setProducts(products.map(p => p.id === editingProduct.id ? editingProduct : p));
      setEditingProduct(null);
      setNotification({ message: "تم تحديث المنتج بنجاح", type: 'success' });
    }
  };

  const handleSell = async () => {
    if (!sellingProduct) return;
    const qty = Number(sellQty);
    if (isNaN(qty) || qty <= 0) {
      setNotification({ message: t('invalid_quantity'), type: 'error' });
      return;
    }

    if (qty > sellingProduct.quantity) {
      setNotification({ message: t('insufficient_quantity'), type: 'error' });
      return;
    }

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: sellingProduct.id,
        quantity: qty,
        total_price: sellingProduct.price * qty,
        user_id: user?.id
      })
    });

    if (res.ok) {
      setProducts(products.map(p => p.id === sellingProduct.id ? { ...p, quantity: p.quantity - qty } : p));
      setNotification({ message: t('sale_success'), type: 'success' });
      setSellingProduct(null);
      setSellQty(1);
    } else {
      const data = await res.json();
      setNotification({ message: data.error || "فشلت عملية البيع", type: 'error' });
    }
  };

  const fetchDailySales = async () => {
    const res = await fetch('/api/sales/daily');
    const data = await res.json();
    setDailySales(data);
    setShowSalesReport(true);
  };

  const handleDeleteSale = async (id: number) => {
    if (user?.role !== 'admin') return;
    const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDailySales(dailySales.filter(s => s.id !== id));
      fetch('/api/products').then(res => res.json()).then(setProducts);
      setNotification({ message: t('delete_success'), type: 'success' });
    }
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;
    const res = await fetch(`/api/sales/${editingSale.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: editingSale.quantity,
        total_price: editingSale.quantity * editingSale.product_price
      })
    });
    if (res.ok) {
      setDailySales(dailySales.map(s => s.id === editingSale.id ? editingSale : s));
      fetch('/api/products').then(res => res.json()).then(setProducts);
      setEditingSale(null);
      setNotification({ message: t('update_success'), type: 'success' });
    } else {
      const data = await res.json();
      setNotification({ message: data.error || t('update_error'), type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (user?.role !== 'admin') return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setProducts(products.filter(p => p.id !== id));
      setDeleteConfirmId(null);
      setNotification({ message: "تم حذف المنتج بنجاح", type: 'success' });
    } else {
      setNotification({ message: "فشل حذف المنتج", type: 'error' });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('products')}</h1>
        <div className="flex gap-4">
          <NeumorphicButton 
            onClick={() => setFilterLowStock(!filterLowStock)} 
            className={`flex items-center gap-2 transition-all ${filterLowStock ? 'bg-red-600 text-white ring-4 ring-red-500/30' : 'bg-white/40'}`}
          >
            <AlertCircle size={18} /> {filterLowStock ? 'عرض الكل' : 'عرض النواقص فقط'}
          </NeumorphicButton>
          <NeumorphicButton onClick={fetchDailySales} className="bg-purple-600 text-white flex items-center gap-2">
            <BarChart3 size={18} /> تقرير مبيعات اليوم
          </NeumorphicButton>
          <NeumorphicButton onClick={() => setShowAdd(true)} className="bg-blue-600 text-white flex items-center gap-2">
            <Plus size={18} /> إضافة منتج جديد
          </NeumorphicButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.filter(p => !filterLowStock || p.quantity <= p.min_quantity).map(product => (
          <GlassCard 
            key={product.id} 
            className={`group transition-all duration-300 ${
              product.quantity <= product.min_quantity 
                ? 'border-2 border-red-500/50 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                : ''
            }`}
          >
            <div className="aspect-square bg-white/10 rounded-2xl mb-4 overflow-hidden relative">
              {product.image ? (
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center opacity-20">
                  <Package size={48} />
                </div>
              )}
              {product.quantity <= product.min_quantity && (
                <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded-full shadow-lg flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider animate-pulse z-10">
                  <AlertCircle size={12} />
                  <span>كمية منخفضة</span>
                </div>
              )}
            </div>
            <h3 className="font-bold text-lg">{product.name}</h3>
            <div className="flex justify-between items-center mt-2">
              <span className="text-blue-600 font-black text-xl">{product.price} EGP</span>
              <span className={`text-sm px-2 py-0.5 rounded-lg transition-colors ${
                product.quantity <= product.min_quantity 
                  ? 'text-red-700 font-black bg-red-500/20' 
                  : 'opacity-60 bg-white/5'
              }`}>
                الكمية: {product.quantity}
              </span>
            </div>
            <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <NeumorphicButton onClick={() => setSellingProduct(product)} className="flex-1 bg-green-500 text-white text-sm py-2 flex items-center justify-center gap-2">
                <ShoppingCart size={16} /> {t('sell')}
              </NeumorphicButton>
              {user?.role === 'admin' && (
                <>
                  <button onClick={() => setEditingProduct(product)} className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-xl">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => setDeleteConfirmId(product.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl">
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>
          </GlassCard>
        ))}
        {products.filter(p => !filterLowStock || p.quantity <= p.min_quantity).length === 0 && (
          <div className="col-span-full p-20 text-center bg-white/10 rounded-3xl border-2 border-dashed border-white/20">
            <Package className="mx-auto opacity-20 mb-4" size={64} />
            <p className="text-xl font-bold opacity-50">لا توجد منتجات تطابق البحث</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <GlassCard className="w-full max-w-md bg-white/80">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">إضافة منتج جديد</h2>
                <button onClick={() => setShowAdd(false)}><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">اسم المنتج</label>
                  <input placeholder="اسم المنتج" className="glass-input w-full" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">السعر</label>
                  <input type="number" placeholder="السعر" className="glass-input w-full" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">الكمية</label>
                  <input type="number" placeholder="الكمية" className="glass-input w-full" value={newProduct.quantity} onChange={e => setNewProduct({...newProduct, quantity: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">تنبيه عند وصول الكمية لـ</label>
                  <input type="number" placeholder="تنبيه عند وصول الكمية لـ" className="glass-input w-full" value={newProduct.min_quantity} onChange={e => setNewProduct({...newProduct, min_quantity: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">صورة المنتج</label>
                  <div className="flex flex-col gap-2">
                    {newProduct.image && (
                      <div className="w-full h-32 rounded-xl overflow-hidden bg-white/10 border border-white/20">
                        <img src={newProduct.image} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      id="product-image-add"
                      onChange={(e) => handleImageUpload(e)}
                    />
                    <NeumorphicButton 
                      onClick={() => document.getElementById('product-image-add')?.click()}
                      className="bg-white/40 text-sm py-2"
                    >
                      {newProduct.image ? 'تغيير الصورة' : 'رفع صورة'}
                    </NeumorphicButton>
                    <input 
                      placeholder="أو رابط الصورة" 
                      className="glass-input w-full text-xs" 
                      value={newProduct.image} 
                      onChange={e => setNewProduct({...newProduct, image: e.target.value})} 
                    />
                  </div>
                </div>
                <NeumorphicButton onClick={handleAdd} className="w-full bg-blue-500 text-white py-3 font-bold">حفظ المنتج</NeumorphicButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingProduct && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <GlassCard className="w-full max-w-md bg-white/80">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">تعديل المنتج</h2>
                <button onClick={() => setEditingProduct(null)}><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">اسم المنتج</label>
                  <input placeholder="اسم المنتج" className="glass-input w-full" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">السعر</label>
                  <input type="number" placeholder="السعر" className="glass-input w-full" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">الكمية</label>
                  <input type="number" placeholder="الكمية" className="glass-input w-full" value={editingProduct.quantity} onChange={e => setEditingProduct({...editingProduct, quantity: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">تنبيه عند وصول الكمية لـ</label>
                  <input type="number" placeholder="تنبيه عند وصول الكمية لـ" className="glass-input w-full" value={editingProduct.min_quantity} onChange={e => setEditingProduct({...editingProduct, min_quantity: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">صورة المنتج</label>
                  <div className="flex flex-col gap-2">
                    {editingProduct.image && (
                      <div className="w-full h-32 rounded-xl overflow-hidden bg-white/10 border border-white/20">
                        <img src={editingProduct.image} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      id="product-image-edit"
                      onChange={(e) => handleImageUpload(e, true)}
                    />
                    <NeumorphicButton 
                      onClick={() => document.getElementById('product-image-edit')?.click()}
                      className="bg-white/40 text-sm py-2"
                    >
                      {editingProduct.image ? 'تغيير الصورة' : 'رفع صورة'}
                    </NeumorphicButton>
                    <input 
                      placeholder="أو رابط الصورة" 
                      className="glass-input w-full text-xs" 
                      value={editingProduct.image} 
                      onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} 
                    />
                  </div>
                </div>
                <NeumorphicButton onClick={handleUpdateProduct} className="w-full bg-blue-500 text-white py-3 font-bold">حفظ التعديلات</NeumorphicButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSalesReport && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <GlassCard className="w-full max-w-4xl bg-white/90 max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">تقرير مبيعات اليوم</h2>
                <button onClick={() => setShowSalesReport(false)}><X /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-right">
                  <thead className="sticky top-0 bg-white/90 backdrop-blur-sm">
                    <tr className="border-b border-white/20">
                      <th className="p-4">المنتج</th>
                      <th className="p-4">الكمية</th>
                      <th className="p-4">الإجمالي</th>
                      <th className="p-4">التاريخ</th>
                      <th className="p-4">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySales.map(sale => (
                      <tr key={sale.id} className="border-b border-white/10 hover:bg-white/10 transition-colors">
                        <td className="p-4 font-bold">{sale.product_name}</td>
                        <td className="p-4">{sale.quantity}</td>
                        <td className="p-4 font-bold text-green-600">{sale.total_price} EGP</td>
                        <td className="p-4 opacity-60 text-sm">{new Date(sale.date).toLocaleString()}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button onClick={() => setEditingSale(sale)} className="p-1 text-blue-500 hover:bg-blue-500/10 rounded-lg">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDeleteSale(sale.id)} className="p-1 text-red-500 hover:bg-red-500/10 rounded-lg">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {dailySales.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-10 text-center opacity-50">لا توجد مبيعات اليوم.</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-white/90 backdrop-blur-sm font-bold">
                    <tr>
                      <td className="p-4">الإجمالي الكلي</td>
                      <td className="p-4">{dailySales.reduce((acc, s) => acc + s.quantity, 0)}</td>
                      <td className="p-4 text-green-600">{dailySales.reduce((acc, s) => acc + s.total_price, 0)} EGP</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-sm bg-white/90">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">تأكيد الحذف</h2>
                <button onClick={() => setDeleteConfirmId(null)}><X /></button>
              </div>
              <div className="space-y-6">
                <p className="text-center opacity-70">هل أنت متأكد من رغبتك في حذف هذا المنتج؟ سيتم حذف جميع سجلات المبيعات المرتبطة به أيضاً.</p>
                <div className="flex gap-3">
                  <NeumorphicButton onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2">{t('cancel')}</NeumorphicButton>
                  <NeumorphicButton onClick={() => handleDelete(deleteConfirmId)} className="flex-1 py-2 bg-red-500 text-white font-bold">{t('confirm')}</NeumorphicButton>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingSale && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-sm bg-white/90">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">تعديل البيع: {editingSale.product_name}</h2>
                <button onClick={() => setEditingSale(null)}><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">الكمية الجديدة</label>
                  <input 
                    type="number" 
                    className="glass-input w-full text-center text-xl font-bold" 
                    value={editingSale.quantity} 
                    onChange={e => setEditingSale({...editingSale, quantity: Number(e.target.value)})}
                  />
                </div>
                <div className="flex gap-3">
                  <NeumorphicButton onClick={() => setEditingSale(null)} className="flex-1 py-2">{t('cancel')}</NeumorphicButton>
                  <NeumorphicButton onClick={handleUpdateSale} className="flex-1 py-2 bg-blue-500 text-white font-bold">{t('save')}</NeumorphicButton>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sellingProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-sm bg-white/90">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">{t('sell')}: {sellingProduct.name}</h2>
                <button onClick={() => setSellingProduct(null)}><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">{t('enter_quantity')}</label>
                  <input 
                    type="number" 
                    className="glass-input w-full text-center text-xl font-bold" 
                    value={sellQty} 
                    onChange={e => setSellQty(Number(e.target.value))}
                    min="1"
                    max={sellingProduct.quantity}
                  />
                  <p className="text-xs opacity-50 text-center">{t('available')}: {sellingProduct.quantity}</p>
                </div>
                <div className="flex gap-3">
                  <NeumorphicButton onClick={() => setSellingProduct(null)} className="flex-1 py-2">{t('cancel')}</NeumorphicButton>
                  <NeumorphicButton onClick={handleSell} className="flex-1 py-2 bg-green-500 text-white font-bold">{t('confirm')}</NeumorphicButton>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      </AnimatePresence>
    </motion.div>
  );
};

const Expenses = () => {
  const { t } = useTranslation();
  const { user, language } = useAppContext();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [newExpense, setNewExpense] = useState({ description: '', amount: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filteredExpenses = expenses.filter(exp => {
    if (!exp.date) return true;
    const expDate = new Date(exp.date).toISOString().split('T')[0];
    if (fromDate && expDate < fromDate) return false;
    if (toDate && expDate > toDate) return false;
    return true;
  });

  const totalFilteredAmount = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  useEffect(() => {
    fetch('/api/expenses').then(res => res.json()).then(setExpenses);
  }, []);

  const handleAdd = async () => {
    if (!newExpense.description || !newExpense.amount) return;
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newExpense)
    });
    if (res.ok) {
      const data = await res.json();
      setExpenses([...expenses, { ...newExpense, id: data.id, date: new Date().toISOString() }]);
      setNewExpense({ description: '', amount: 0 });
      setShowAdd(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (user?.role !== 'admin') return;
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) setExpenses(expenses.filter(e => e.id !== id));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('expenses')}</h1>
        <NeumorphicButton onClick={() => setShowAdd(true)} className="bg-blue-500 text-white flex items-center gap-2">
          <Plus size={18} /> {t('add_expense')}
        </NeumorphicButton>
      </div>

      {/* Date Filter Bar */}
      <GlassCard className="flex flex-wrap items-center gap-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold opacity-70">{language === 'ar' ? 'من تاريخ:' : 'From:'}</span>
          <input 
            type="date" 
            className="glass-input text-slate-800" 
            value={fromDate} 
            onChange={e => setFromDate(e.target.value)} 
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold opacity-70">{language === 'ar' ? 'إلى تاريخ:' : 'To:'}</span>
          <input 
            type="date" 
            className="glass-input text-slate-800" 
            value={toDate} 
            onChange={e => setToDate(e.target.value)} 
          />
        </div>
        {(fromDate || toDate) && (
          <NeumorphicButton 
            onClick={() => { setFromDate(''); setToDate(''); }} 
            className="text-xs py-1 px-3 bg-red-500/20 text-red-700 hover:bg-red-500/30"
          >
            {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
          </NeumorphicButton>
        )}
        
        {/* Total Summary */}
        <div className="mr-auto flex items-center gap-3">
          <span className="text-sm font-bold opacity-80">{language === 'ar' ? 'إجمالي المصروفات في الفترة المحددة:' : 'Total Filtered Expenses:'}</span>
          <span className="text-2xl font-black text-red-600 bg-red-500/10 px-4 py-2 rounded-2xl">
            {totalFilteredAmount}
          </span>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <table className="w-full text-right">
          <thead>
            <tr className="border-b border-white/20">
              <th className="p-4">{t('description')}</th>
              <th className="p-4">{t('amount')}</th>
              <th className="p-4">{t('date')}</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map(exp => (
              <tr key={exp.id} className="border-b border-white/10 hover:bg-white/10 transition-colors">
                <td className="p-4">{exp.description}</td>
                <td className="p-4 font-bold text-red-600">{exp.amount}</td>
                <td className="p-4 opacity-60 text-sm">{new Date(exp.date).toLocaleString()}</td>
                <td className="p-4 text-left">
                  {user?.role === 'admin' && (
                    <button onClick={() => handleDelete(exp.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-xl">
                      <Trash2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-md bg-white/80">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('add_expense')}</h2>
                <button onClick={() => setShowAdd(false)}><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">{t('description')}</label>
                  <input placeholder={t('description')} className="glass-input w-full" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">{t('amount')}</label>
                  <input type="number" placeholder={t('amount')} className="glass-input w-full" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} />
                </div>
                <NeumorphicButton onClick={handleAdd} className="w-full bg-blue-500 text-white py-3 font-bold">{t('save')}</NeumorphicButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const Debts = () => {
  const { t } = useTranslation();
  const { user, language } = useAppContext();
  const [debts, setDebts] = useState<any[]>([]);
  const [newDebt, setNewDebt] = useState({ person_name: '', amount_in: 0, amount_out: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewHistoryDebt, setViewHistoryDebt] = useState<any | null>(null);
  const [historyTransactions, setHistoryTransactions] = useState<any[]>([]);

  const handleFetchHistory = async (debt: any) => {
    setViewHistoryDebt(debt);
    const res = await fetch(`/api/debts/${debt.id}/transactions`);
    const json = await res.json();
    setHistoryTransactions(json);
  };

  const filteredDebts = debts.filter(debt => {
    if (!debt.date) return true;
    const debtDate = new Date(debt.date).toISOString().split('T')[0];
    
    // Hide debt if created AFTER the filter end date
    if (toDate && debtDate > toDate) return false;
    
    // For debts created BEFORE the filter start date: only show if still unpaid (net != 0)
    if (fromDate && debtDate < fromDate) {
      const net = (debt.amount_out || 0) - (debt.amount_in || 0);
      return net !== 0;
    }
    
    return true;
  });

  const totalDebtOut = filteredDebts.reduce((sum, d) => sum + (d.amount_out || 0), 0);
  const totalDebtIn = filteredDebts.reduce((sum, d) => sum + (d.amount_in || 0), 0);
  const totalNetDebt = totalDebtOut - totalDebtIn;

  useEffect(() => {
    fetch('/api/debts').then(res => res.json()).then(setDebts);
  }, []);

  const handleAdd = async () => {
    if (!newDebt.person_name) return;
    const res = await fetch('/api/debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDebt)
    });
    if (res.ok) {
      const data = await res.json();
      setDebts([...debts, { ...newDebt, id: data.id, date: new Date().toISOString() }]);
      setNewDebt({ person_name: '', amount_in: 0, amount_out: 0 });
      setShowAdd(false);
    }
  };

  const [deltaValues, setDeltaValues] = useState<{[key: number]: {amount_in: number, amount_out: number}}>({});

  const getDelta = (id: number) => deltaValues[id] || { amount_in: 0, amount_out: 0 };

  const handleSaveAdjustment = async (debt: any) => {
    const delta = getDelta(debt.id);
    if (delta.amount_in === 0 && delta.amount_out === 0) return;

    const updated = {
      ...debt,
      amount_in: (debt.amount_in || 0) + (delta.amount_in || 0),
      amount_out: (debt.amount_out || 0) + (delta.amount_out || 0),
      date: new Date().toISOString()
    };
    const res = await fetch(`/api/debts/${debt.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    if (res.ok) {
      setDebts(debts.map(d => d.id === debt.id ? updated : d));
      // Reset the delta inputs back to zero
      setDeltaValues(prev => ({ ...prev, [debt.id]: { amount_in: 0, amount_out: 0 } }));
    }
  };

  const handleDelete = async (id: number) => {
    if (user?.role !== 'admin') return;
    const res = await fetch(`/api/debts/${id}`, { method: 'DELETE' });
    if (res.ok) setDebts(debts.filter(d => d.id !== id));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('debts')}</h1>
        <NeumorphicButton onClick={() => setShowAdd(true)} className="bg-blue-500 text-white flex items-center gap-2">
          <Plus size={18} /> {t('add_person')}
        </NeumorphicButton>
      </div>

      {/* Date Filter Bar */}
      <GlassCard className="flex flex-wrap items-center gap-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold opacity-70">{language === 'ar' ? 'من تاريخ:' : 'From:'}</span>
          <input 
            type="date" 
            className="glass-input text-slate-800" 
            value={fromDate} 
            onChange={e => setFromDate(e.target.value)} 
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold opacity-70">{language === 'ar' ? 'إلى تاريخ:' : 'To:'}</span>
          <input 
            type="date" 
            className="glass-input text-slate-800" 
            value={toDate} 
            onChange={e => setToDate(e.target.value)} 
          />
        </div>
        {(fromDate || toDate) && (
          <NeumorphicButton 
            onClick={() => { setFromDate(''); setToDate(''); }} 
            className="text-xs py-1 px-3 bg-red-500/20 text-red-700 hover:bg-red-500/30"
          >
            {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
          </NeumorphicButton>
        )}
        
        {/* Total Summary */}
        <div className="mr-auto flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold opacity-75">{language === 'ar' ? 'إجمالي مبالغ خارجة:' : 'Total Out:'}</span>
            <span className="text-sm font-bold text-red-600 bg-red-500/15 px-3 py-1 rounded-xl">{totalDebtOut}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold opacity-75">{language === 'ar' ? 'إجمالي مبالغ داخلة:' : 'Total In:'}</span>
            <span className="text-sm font-bold text-green-600 bg-green-500/15 px-3 py-1 rounded-xl">{totalDebtIn}</span>
          </div>
          <div className="flex items-center gap-2 border-l border-white/20 pl-4">
            <span className="text-sm font-bold opacity-80">{language === 'ar' ? 'صافي المديونية:' : 'Net Debt:'}</span>
            <span className={`text-xl font-black px-4 py-1.5 rounded-2xl ${totalNetDebt > 0 ? 'text-red-600 bg-red-500/10' : 'text-green-600 bg-green-500/10'}`}>
              {totalNetDebt}
            </span>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDebts.map(debt => (
          <GlassCard key={debt.id} className="space-y-4">
            {/* Header: name + actions */}
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-bold">{debt.person_name}</h3>
              <div className="flex gap-1">
                <button onClick={() => handleFetchHistory(debt)} className="text-blue-500 hover:bg-blue-500/10 p-2 rounded-xl" title="سجل المديونية">
                  <History size={18} />
                </button>
                {user?.role === 'admin' && (
                  <button onClick={() => handleDelete(debt.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-xl">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Total net - prominent box at top */}
            {(() => {
              const net = (debt.amount_out || 0) - (debt.amount_in || 0);
              const isDebt = net > 0;
              return (
                <div className={`rounded-2xl py-4 px-5 text-center ${isDebt ? 'bg-red-500/15 border border-red-400/30' : 'bg-green-500/15 border border-green-400/30'}`}>
                  <p className="text-xs font-bold opacity-60 mb-1">{t('total_debt')}</p>
                  <p className={`text-4xl font-black tracking-tight ${isDebt ? 'text-red-600' : 'text-green-600'}`}>{net}</p>
                </div>
              );
            })()}

            {/* Running totals display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center bg-red-500/10 rounded-xl py-2 px-3">
                <p className="text-xs opacity-60 mb-0.5">{t('amount_out')}</p>
                <p className="text-lg font-black text-red-600">{debt.amount_out || 0}</p>
              </div>
              <div className="text-center bg-green-500/10 rounded-xl py-2 px-3">
                <p className="text-xs opacity-60 mb-0.5">{t('amount_in')}</p>
                <p className="text-lg font-black text-green-600">{debt.amount_in || 0}</p>
              </div>
            </div>

            {/* Delta inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs opacity-60">إضافة مديونية</label>
                <input 
                  type="number" 
                  min="0"
                  className="glass-input w-full text-red-600 font-bold" 
                  value={getDelta(debt.id).amount_out || ''}
                  placeholder="0"
                  onChange={e => setDeltaValues(prev => ({ ...prev, [debt.id]: { ...getDelta(debt.id), amount_out: Number(e.target.value) } }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveAdjustment(debt); }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs opacity-60">تسديد مديونية</label>
                <input 
                  type="number" 
                  min="0"
                  className="glass-input w-full text-green-600 font-bold" 
                  value={getDelta(debt.id).amount_in || ''}
                  placeholder="0"
                  onChange={e => setDeltaValues(prev => ({ ...prev, [debt.id]: { ...getDelta(debt.id), amount_in: Number(e.target.value) } }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveAdjustment(debt); }}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <NeumorphicButton
                onClick={() => handleSaveAdjustment(debt)}
                className="bg-blue-500 text-white flex items-center gap-2 px-4 py-2"
              >
                <Check size={16} /> حفظ
              </NeumorphicButton>
            </div>
          </GlassCard>
        ))}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-md bg-white/80">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('add_person')}</h2>
                <button onClick={() => setShowAdd(false)}><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">{t('person_name')}</label>
                  <input placeholder={t('person_name')} className="glass-input w-full" value={newDebt.person_name} onChange={e => setNewDebt({...newDebt, person_name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-bold opacity-70">{t('amount_out')}</label>
                    <input type="number" placeholder={t('amount_out')} className="glass-input w-full" value={newDebt.amount_out} onChange={e => setNewDebt({...newDebt, amount_out: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold opacity-70">{t('amount_in')}</label>
                    <input type="number" placeholder={t('amount_in')} className="glass-input w-full" value={newDebt.amount_in} onChange={e => setNewDebt({...newDebt, amount_in: Number(e.target.value)})} />
                  </div>
                </div>
                <NeumorphicButton onClick={handleAdd} className="w-full bg-blue-500 text-white py-3 font-bold">{t('save')}</NeumorphicButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debt History Modal */}
      <AnimatePresence>
        {viewHistoryDebt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-2xl bg-white/95 max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/20">
                <div className="flex items-center gap-2">
                  <History className="text-blue-500" size={24} />
                  <h2 className="text-2xl font-bold">سجل مديونية - {viewHistoryDebt.person_name}</h2>
                </div>
                <button onClick={() => setViewHistoryDebt(null)} className="p-1 hover:bg-black/5 rounded-lg"><X /></button>
              </div>
              
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 text-sm font-bold opacity-75">
                      <th className="py-3 px-4">التاريخ والوقت</th>
                      <th className="py-3 px-4">العملية</th>
                      <th className="py-3 px-4">المبلغ</th>
                      <th className="py-3 px-4">الرصيد المتبقي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let runningTotal = 0;
                      const chrono = [...historyTransactions].reverse();
                      const mapped = chrono.map(tx => {
                        if (tx.type === 'out') {
                          runningTotal += tx.amount;
                        } else {
                          runningTotal -= tx.amount;
                        }
                        return { ...tx, runningTotal };
                      });
                      return mapped.reverse();
                    })().map((tx) => (
                      <tr key={tx.id} className="border-b border-black/5 hover:bg-black/5 transition-colors">
                        <td className="py-3 px-4 text-xs opacity-75">
                          {new Date(tx.date).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${tx.type === 'out' ? 'bg-red-500/15 text-red-700' : 'bg-green-500/15 text-green-700'}`}>
                            {tx.type === 'out' ? 'زيادة مديونية' : 'سداد مديونية'}
                          </span>
                        </td>
                        <td className={`py-3 px-4 font-black ${tx.type === 'out' ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.type === 'out' ? '+' : '-'}{tx.amount}
                        </td>
                        <td className={`py-3 px-4 font-black ${tx.runningTotal > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {tx.runningTotal}
                        </td>
                      </tr>
                    ))}
                    {historyTransactions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center opacity-60">لا يوجد سجل عمليات لهذه المديونية بعد.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const Reports = () => {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<any>(null);
  const [startingTreasury, setStartingTreasury] = useState<any[]>([]);
  const [showAddStarting, setShowAddStarting] = useState(false);
  const [newStarting, setNewStarting] = useState({ amount: 0 });
  const [editingStarting, setEditingStarting] = useState<any | null>(null);

  const fetchReport = async () => {
    const res = await fetch(`/api/reports/summary?startDate=${startDate}&endDate=${endDate}`);
    const json = await res.json();
    setData(json);
  };

  const fetchStartingTreasury = async () => {
    const res = await fetch(`/api/starting-treasury?startDate=${startDate}&endDate=${endDate}`);
    const json = await res.json();
    setStartingTreasury(json);
  };

  useEffect(() => {
    fetchReport();
    fetchStartingTreasury();
  }, [startDate, endDate]);

  const handleAddStarting = async () => {
    const res = await fetch('/api/starting-treasury', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newStarting, date: startDate + "T00:00:00Z" })
    });
    if (res.ok) {
      fetchStartingTreasury();
      fetchReport();
      setShowAddStarting(false);
      setNewStarting({ amount: 0 });
    }
  };

  const handleUpdateStarting = async () => {
    if (!editingStarting) return;
    const res = await fetch(`/api/starting-treasury/${editingStarting.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingStarting)
    });
    if (res.ok) {
      fetchStartingTreasury();
      fetchReport();
      setEditingStarting(null);
    }
  };

  const handleDeleteStarting = async (id: number) => {
    const res = await fetch(`/api/starting-treasury/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchStartingTreasury();
      fetchReport();
    }
  };

  const handleExportExcel = () => {
    if (!data) return;
    const exportData = [
      { [t('total_cash')]: data.total_cash },
      { [t('total_wallets')]: data.total_wallets },
      { [t('total_machines')]: data.total_machines },
      { [t('total_debts')]: data.debts },
      { [t('total_expenses')]: data.expenses },
      { [t('starting_treasury')]: data.starting_treasury },
      { [t('net_profit')]: data.net_profit },
      { [t('total_treasury')]: data.total_treasury }
    ];
    exportToExcel(exportData, `Report_${startDate}_to_${endDate}`);
  };

  const handleExportPDF = () => {
    if (!data) return;
    const exportData = [
      [t('total_cash'), data.total_cash],
      [t('total_wallets'), data.total_wallets],
      [t('total_machines'), data.total_machines],
      [t('total_debts'), data.debts],
      [t('total_expenses'), data.expenses],
      [t('starting_treasury'), data.starting_treasury],
      [t('net_profit'), data.net_profit],
      [t('total_treasury'), data.total_treasury]
    ];
    exportToPDF(exportData, `Report_${startDate}_to_${endDate}`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('reports')}</h1>
        <div className="flex gap-4 items-end">
          <div className="space-y-1">
            <label className="text-sm font-bold opacity-70">من تاريخ</label>
            <input type="date" className="glass-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold opacity-70">إلى تاريخ</label>
            <input type="date" className="glass-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <NeumorphicButton onClick={handleExportExcel} className="bg-green-600 text-white flex items-center gap-2">
            <FileSpreadsheet size={18} /> Excel
          </NeumorphicButton>
          <NeumorphicButton onClick={handleExportPDF} className="bg-red-600 text-white flex items-center gap-2">
            <FileText size={18} /> PDF
          </NeumorphicButton>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <GlassCard className="bg-blue-500/10">
            <h3 className="opacity-60 text-sm mb-2">{t('total_cash')}</h3>
            <p className="text-3xl font-black">{data.total_cash}</p>
          </GlassCard>
          <GlassCard className="bg-purple-500/10">
            <h3 className="opacity-60 text-sm mb-2">{t('total_wallets')}</h3>
            <p className="text-3xl font-black">{data.total_wallets}</p>
          </GlassCard>
          <GlassCard className="bg-cyan-500/10">
            <h3 className="opacity-60 text-sm mb-2">{t('total_machines')}</h3>
            <p className="text-3xl font-black">{data.total_machines}</p>
          </GlassCard>
          <GlassCard className="bg-orange-500/10">
            <h3 className="opacity-60 text-sm mb-2">{t('total_debts')}</h3>
            <p className="text-3xl font-black">{data.debts}</p>
          </GlassCard>
          <GlassCard className="bg-red-500/10">
            <h3 className="opacity-60 text-sm mb-2">{t('total_expenses')}</h3>
            <p className="text-3xl font-black">{data.expenses}</p>
          </GlassCard>
          
          <GlassCard className="bg-amber-500/10 border-amber-500/30">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 rounded-lg text-amber-600">
                  <Coins size={18} />
                </div>
                <h3 className="opacity-60 text-sm font-bold">بداية الخزينة</h3>
              </div>
              <button onClick={() => setShowAddStarting(true)} className="p-1 text-amber-600 hover:bg-amber-500/10 rounded-lg">
                <Plus size={16} />
              </button>
            </div>
            <p className="text-3xl font-black text-amber-700">{data.starting_treasury}</p>
          </GlassCard>

          <GlassCard className="bg-indigo-500/20 border-indigo-500/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-600">
                <TrendingUp size={18} />
              </div>
              <h3 className="text-indigo-800 font-bold text-sm">صافي الارباح</h3>
            </div>
            <p className="text-4xl font-black text-indigo-700">{data.net_profit}</p>
          </GlassCard>

          <GlassCard className="bg-green-500/20 border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-500/20 rounded-lg text-green-600">
                <BarChart3 size={18} />
              </div>
              <h3 className="text-green-800 font-bold text-sm">{t('total_treasury')}</h3>
            </div>
            <p className="text-4xl font-black text-green-700">
              {data.total_treasury}
            </p>
          </GlassCard>
        </div>
      )}

      {/* Starting Treasury Management Section */}
      <GlassCard className="bg-white/40">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Coins className="text-amber-600" size={20} />
            <h2 className="text-xl font-bold">إدارة بداية الخزينة</h2>
          </div>
          <NeumorphicButton onClick={() => setShowAddStarting(true)} className="bg-amber-500 text-white flex items-center gap-2 text-sm">
            <Plus size={16} /> إضافة مبلغ جديد
          </NeumorphicButton>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {startingTreasury.map(st => (
            <div key={st.id} className="flex items-center justify-between bg-white/60 p-3 rounded-xl border border-white/20 shadow-sm">
              <div className="flex flex-col">
                <span className="text-lg font-black text-amber-700">{st.amount} EGP</span>
                <span className="text-[10px] opacity-50">{new Date(st.date).toLocaleTimeString()}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingStarting(st)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors">
                  <Edit size={16} />
                </button>
                <button onClick={() => handleDeleteStarting(st.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {startingTreasury.length === 0 && (
            <div className="col-span-full py-8 text-center opacity-40 italic">
              لا توجد مبالغ مسجلة لبداية الخزينة في هذا التاريخ.
            </div>
          )}
        </div>
      </GlassCard>

      <AnimatePresence>
        {showAddStarting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-sm bg-white/90">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">إضافة بداية الخزينة</h2>
                <button onClick={() => setShowAddStarting(false)}><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">المبلغ</label>
                  <input type="number" className="glass-input w-full" value={newStarting.amount} onChange={e => setNewStarting({ amount: Number(e.target.value) })} />
                </div>
                <NeumorphicButton onClick={handleAddStarting} className="w-full bg-amber-500 text-white font-bold py-3">إضافة</NeumorphicButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingStarting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-sm bg-white/90">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">تعديل بداية الخزينة</h2>
                <button onClick={() => setEditingStarting(null)}><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">المبلغ</label>
                  <input type="number" className="glass-input w-full" value={editingStarting.amount} onChange={e => setEditingStarting({ ...editingStarting, amount: Number(e.target.value) })} />
                </div>
                <NeumorphicButton onClick={handleUpdateStarting} className="w-full bg-blue-500 text-white font-bold py-3">حفظ التعديلات</NeumorphicButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const SettingsPage = () => {
  const { t, i18n } = useTranslation();
  const { language, setLanguage, currency, setCurrency, logo, setLogo } = useAppContext();

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h1 className="text-3xl font-bold">{t('settings')}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <GlassCard className="space-y-6">
          <h2 className="text-xl font-bold border-b border-white/20 pb-4">{t('language')} & {t('currency')}</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold opacity-70">{t('language')}</label>
              <div className="flex gap-2">
                <NeumorphicButton 
                  onClick={() => { setLanguage('ar'); i18n.changeLanguage('ar'); }}
                  className={language === 'ar' ? 'bg-blue-500 text-white' : ''}
                >العربية</NeumorphicButton>
                <NeumorphicButton 
                  onClick={() => { setLanguage('en'); i18n.changeLanguage('en'); }}
                  className={language === 'en' ? 'bg-blue-500 text-white' : ''}
                >English</NeumorphicButton>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span>{t('currency')}</span>
              <input 
                className="glass-input w-32 text-center font-bold" 
                value={currency} 
                onChange={e => setCurrency(e.target.value)} 
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="space-y-6">
          <h2 className="text-xl font-bold border-b border-white/20 pb-4">Store Logo</h2>
          <div className="flex flex-col items-center gap-6">
            <div className="w-32 h-32 glass-card rounded-3xl flex items-center justify-center overflow-hidden">
              {logo ? <img src={logo} alt="Logo" className="w-full h-full object-contain" /> : <Package size={48} className="opacity-20" />}
            </div>
            <input type="file" id="logo-upload" className="hidden" onChange={handleLogoChange} accept="image/*" />
            <NeumorphicButton onClick={() => document.getElementById('logo-upload')?.click()} className="bg-blue-500 text-white">
              Upload Logo
            </NeumorphicButton>
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
};

const UsersPage = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAppContext();
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'cashier' });
  const [showAdd, setShowAdd] = useState(false);
  const [changingPasswordUser, setChangingPasswordUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetch('/api/users').then(res => res.json()).then(setUsers);
  }, []);

  const handleAdd = async () => {
    if (!newUser.username || !newUser.password) return;
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    if (res.ok) {
      const data = await res.json();
      setUsers([...users, { ...newUser, id: data.id }]);
      setNewUser({ username: '', password: '', role: 'cashier' });
      setShowAdd(false);
    } else {
      const data = await res.json();
      setNotification({ message: data.error || "Failed to add user", type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (id === currentUser?.id) return setNotification({ message: "Cannot delete yourself", type: 'error' });
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers(users.filter(u => u.id !== id));
      setNotification({ message: t('delete_success'), type: 'success' });
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) return;
    const res = await fetch(`/api/users/${changingPasswordUser.id}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });
    if (res.ok) {
      setNotification({ message: t('update_success'), type: 'success' });
      setChangingPasswordUser(null);
      setNewPassword('');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('users_permissions')}</h1>
        <NeumorphicButton onClick={() => setShowAdd(true)} className="bg-blue-500 text-white flex items-center gap-2">
          <Plus size={18} /> {t('add_user')}
        </NeumorphicButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map(u => (
          <GlassCard key={u.id} className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">{u.username}</h3>
              <div className="flex gap-2 items-center mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                  {u.role === 'admin' ? t('admin') : t('cashier')}
                </span>
                <button onClick={() => setChangingPasswordUser(u)} className="text-[10px] text-blue-600 hover:underline">
                  {t('change_password')}
                </button>
              </div>
            </div>
            {u.id !== currentUser?.id && (
              <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-xl">
                <Trash2 size={20} />
              </button>
            )}
          </GlassCard>
        ))}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-md bg-white/80">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{t('add_user')}</h2>
                <button onClick={() => setShowAdd(false)}><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">{t('username')}</label>
                  <input placeholder={t('username')} className="glass-input w-full" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">{t('password')}</label>
                  <input type="password" placeholder={t('password')} className="glass-input w-full" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">الصلاحية</label>
                  <select className="glass-input w-full" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="cashier">{t('cashier')}</option>
                    <option value="admin">{t('admin')}</option>
                  </select>
                </div>
                <NeumorphicButton onClick={handleAdd} className="w-full bg-blue-500 text-white py-3 font-bold">{t('save')}</NeumorphicButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {changingPasswordUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-sm bg-white/90">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">{t('change_password')}: {changingPasswordUser.username}</h2>
                <button onClick={() => setChangingPasswordUser(null)}><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold opacity-70">{t('new_password')}</label>
                  <input 
                    type="password" 
                    className="glass-input w-full" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <NeumorphicButton onClick={() => setChangingPasswordUser(null)} className="flex-1 py-2">{t('cancel')}</NeumorphicButton>
                  <NeumorphicButton onClick={handleChangePassword} className="flex-1 py-2 bg-blue-500 text-white font-bold">{t('save')}</NeumorphicButton>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
      </AnimatePresence>
    </motion.div>
  );
};

const Login = ({ onLogin }: any) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const users = await res.json();
        const found = users.find((u: any) => u.username === username && u.password === password);
        if (found) {
          onLogin(found, rememberMe);
          return;
        }
      }
    } catch {}

    if (username === 'admin' && password === 'password') {
      onLogin({ id: 1, username: 'admin', role: 'admin' }, rememberMe);
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <GlassCard className="w-full max-w-md p-10 bg-white/30">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-500 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <Package className="text-white" size={40} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 uppercase">Ai لخدمات المحمول</h1>
            <p className="opacity-60">Soft Glass Neumorphism</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2 ml-2">{t('username')}</label>
              <input 
                type="text" 
                className="glass-input w-full" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 ml-2">{t('password')}</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  className="glass-input w-full pr-12" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 px-1">
              <input 
                type="checkbox" 
                id="rememberMe"
                checked={rememberMe} 
                onChange={e => setRememberMe(e.target.checked)} 
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm font-bold opacity-80 cursor-pointer select-none">
                {t('remember_me')}
              </label>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <NeumorphicButton type="submit" className="w-full bg-blue-500 text-white font-bold py-4">
              {t('login')}
            </NeumorphicButton>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
};

const MainLayout = () => {
  const { t, i18n } = useTranslation();
  const { user, setUser, language, setLanguage, activeTab, setActiveTab } = useAppContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!user) return <Login onLogin={setUser} />;

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { id: 'wallets', icon: Wallet, label: t('wallets') },
    { id: 'products', icon: Package, label: t('products') },
    { id: 'expenses', icon: Receipt, label: t('expenses') },
    { id: 'debts', icon: Users, label: t('debts') },
    { id: 'reports', icon: BarChart3, label: t('reports') },
    { id: 'settings', icon: Settings, label: t('settings') },
    ...(user.role === 'admin' ? [{ id: 'users', icon: Users, label: t('users_permissions') }] : []),
  ];

  return (
    <div className={`flex min-h-screen ${language === 'ar' ? 'flex-row-reverse' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex-1 flex max-w-[1600px] mx-auto w-full">
        {/* Sidebar */}
        <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="glass-card m-4 rounded-3xl overflow-hidden flex flex-col sticky top-4 h-[calc(100vh-2rem)] z-40"
      >
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
            <Package className="text-white" size={32} />
          </div>
          <h2 className="font-black text-xl">Ai لخدمات المحمول</h2>
          <p className="text-xs opacity-50 uppercase tracking-widest">{user.role}</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {menuItems.map(item => (
            <SidebarItem 
              key={item.id} 
              {...item} 
              active={activeTab === item.id} 
              onClick={() => setActiveTab(item.id)} 
            />
          ))}
        </nav>

        <div className="p-4">
          <SidebarItem 
            icon={LogOut} 
            label={t('logout')} 
            onClick={() => setUser(null)} 
            className="text-red-500"
          />
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="glass-card p-3 rounded-2xl">
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
          
          <div className="flex gap-4">
            <NeumorphicButton onClick={() => {
              const newLang = language === 'ar' ? 'en' : 'ar';
              setLanguage(newLang);
              i18n.changeLanguage(newLang);
            }}>
              {language === 'ar' ? 'English' : 'العربية'}
            </NeumorphicButton>
            <div className="glass-card px-6 py-3 rounded-2xl flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                {user.username[0].toUpperCase()}
              </div>
              <span className="font-bold">{user.username}</span>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'wallets' && <Wallets />}
            {activeTab === 'products' && <Products />}
            {activeTab === 'expenses' && <Expenses />}
            {activeTab === 'debts' && <Debts />}
            {activeTab === 'reports' && <Reports />}
            {activeTab === 'settings' && <SettingsPage />}
            {activeTab === 'users' && <UsersPage />}
          </motion.div>
        </AnimatePresence>
      </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
