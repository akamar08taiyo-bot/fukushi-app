import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  Building2, User, Calendar, CheckCircle2, Clock, Plus, X,
  AlertCircle, Save, Trash2, CalendarDays, FilePlus,
  Settings, ChevronRight, ChevronDown, ChevronLeft,
  HelpCircle, Search, BarChart3, Users,
  LayoutList, AlertCircle as AlertIcon,
  Bell, TrendingUp
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = import.meta.env.VITE_APP_ID || 'fukushi-app-v1';
const STORAGE_KEY_WORKSPACE = 'app_workspace_id';

// --- Utility Functions ---
const calculateDaysFromAdmission = (admissionDateStr) => {
  if (!admissionDateStr) return -1;
  const admission = new Date(admissionDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  admission.setHours(0, 0, 0, 0);
  return Math.ceil((today - admission) / (1000 * 60 * 60 * 24));
};

const checkIsAdmitted = (record) => {
  if (!record.admissionDate) return false;
  if (!record.dischargeDate) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const discharge = new Date(record.dischargeDate);
  discharge.setHours(0, 0, 0, 0);
  return discharge >= today;
};

const formatJapaneseDate = (dateStr) => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '未定';
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
};

const formatTimestamp = () => {
  const now = new Date();
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value || 0);

const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 10);

const getDaysInfo = (days) => {
  if (days < 0) return { color: 'gray', bg: 'bg-gray-100 text-gray-500 border-gray-200' };
  if (days <= 30) return { color: 'emerald', bg: 'bg-emerald-100 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' };
  if (days <= 60) return { color: 'yellow', bg: 'bg-yellow-100 text-yellow-700 border-yellow-200', bar: 'bg-yellow-400' };
  if (days <= 90) return { color: 'orange', bg: 'bg-orange-100 text-orange-700 border-orange-200', bar: 'bg-orange-500' };
  return { color: 'red', bg: 'bg-red-100 text-red-700 border-red-200', bar: 'bg-red-500' };
};

// --- Common Components ---
const Toast = React.memo(({ message, type = 'error', onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 ${type === 'success' ? 'bg-emerald-600' : 'bg-red-500'} text-white px-5 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-2 font-bold text-sm animate-toast`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {message}
    </div>
  );
});

const ConfirmModal = React.memo(({ isOpen, title, message, onConfirm, onCancel, confirmLabel = '削除する', confirmColor = 'bg-red-500' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 animate-fade-in-up">
        <h3 className="text-lg font-black text-gray-800 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 font-medium mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black hover:bg-gray-200 transition-colors">キャンセル</button>
          <button onClick={onConfirm} className={`flex-1 py-3 ${confirmColor} text-white rounded-xl font-black hover:opacity-90 transition-opacity`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
});

const CustomCalendar = React.memo(({ selectedDate, onSelect, onClose }) => {
  const [viewDate, setViewDate] = useState(selectedDate ? new Date(selectedDate) : new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const handleSelect = (d) => {
    onSelect(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 z-50 w-72 animate-fade-in-up">
        <div className="flex justify-between items-center mb-3">
          <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded-xl"><ChevronLeft size={18} /></button>
          <div className="font-black text-sm text-gray-800">{year}年 {month + 1}月</div>
          <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded-xl"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
            <div key={w} className={`text-center text-xs font-black py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array(firstDay).fill(null).map((_, i) => <div key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)).map((d, i) => {
            const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const isSel = selectedDate === ds;
            const isToday = new Date().toDateString() === d.toDateString();
            return (
              <button key={i} type="button" onClick={() => handleSelect(d)}
                className={`py-2 w-full text-center rounded-lg text-sm font-bold transition-colors ${isSel ? 'bg-blue-600 text-white' : isToday ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}>
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
});

const SmartDateInput = React.memo(({ label, value, onChange, onFocus, onBlur }) => {
  const [text, setText] = useState(value || '');
  const [showCal, setShowCal] = useState(false);
  useEffect(() => { setText(value || ''); }, [value]);

  const parseDate = (inputStr) => {
    let val = inputStr.trim()
      .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/[／．ー−]/g, s => ({ '／': '/', '．': '.', 'ー': '-', '−': '-' }[s] || s))
      .replace(/[\s　]+/g, '/');
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, '0');
    let p = null;
    if (/^\d{8}$/.test(val)) p = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
    else if (/^\d{6}$/.test(val)) p = `20${val.slice(0, 2)}-${val.slice(2, 4)}-${val.slice(4, 6)}`;
    else if (/^\d{4}$/.test(val)) p = `${y}-${val.slice(0, 2)}-${val.slice(2, 4)}`;
    else if (/^(\d{4})[/\-.年]+(\d{1,2})[/\-.月]+(\d{1,2})[/\-.日]*$/.test(val)) {
      const [, a, b, c] = val.match(/^(\d{4})[/\-.年]+(\d{1,2})[/\-.月]+(\d{1,2})[/\-.日]*$/);
      p = `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    } else if (/^(\d{2})[/\-.年]+(\d{1,2})[/\-.月]+(\d{1,2})[/\-.日]*$/.test(val)) {
      const [, a, b, c] = val.match(/^(\d{2})[/\-.年]+(\d{1,2})[/\-.月]+(\d{1,2})[/\-.日]*$/);
      p = `20${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    } else if (/^(\d{1,2})[/\-.月]+(\d{1,2})[/\-.日]*$/.test(val)) {
      const [, a, b] = val.match(/^(\d{1,2})[/\-.月]+(\d{1,2})[/\-.日]*$/);
      p = `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    } else if (/^\d{1,2}$/.test(val)) {
      p = `${y}-${m}-${val.padStart(2, '0')}`;
    }
    if (p) {
      const d = new Date(p);
      const [py, pm, pd] = p.split('-');
      if (!isNaN(d.getTime()) && d.getFullYear() === parseInt(py) && (d.getMonth() + 1) === parseInt(pm) && d.getDate() === parseInt(pd)) return p;
    }
    return val;
  };

  const handleBlur = (e) => {
    const f = parseDate(text);
    setText(f);
    if (/^\d{4}-\d{2}-\d{2}$/.test(f)) onChange(f);
    else if (f === '') onChange('');
    if (onBlur) onBlur(e);
  };

  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(text);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-sm font-black text-gray-600">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="例: 5/6, 0506"
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={e => e.key === 'Enter' && handleBlur(e)}
            onFocus={onFocus}
            className={`w-full border-2 rounded-xl p-3.5 text-base font-black outline-none transition-all bg-white
              ${isValid && text ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200 hover:border-gray-300 focus:border-blue-400'}`}
          />
          {isValid && text && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 text-xs font-black pointer-events-none hidden sm:block">
              {formatJapaneseDate(text)}
            </span>
          )}
        </div>
        <div className="relative w-12 flex-shrink-0">
          <button type="button" onClick={() => setShowCal(!showCal)} onFocus={onFocus} onBlur={onBlur}
            className="absolute inset-0 border-2 border-gray-200 rounded-xl bg-gray-50 flex items-center justify-center text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors">
            <CalendarDays size={20} />
          </button>
          {showCal && <CustomCalendar selectedDate={isValid ? text : ''} onSelect={d => { setText(d); onChange(d); }} onClose={() => setShowCal(false)} />}
        </div>
      </div>
    </div>
  );
});

const FilterChip = React.memo(({ label, isActive, onClick, count }) => (
  <button onClick={onClick}
    className={`px-3.5 py-2 rounded-xl text-sm font-black flex items-center gap-1.5 transition-all whitespace-nowrap border ${isActive
      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
    {label}
    {count !== undefined && (
      <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
    )}
  </button>
));

const NavItem = React.memo(({ icon, label, isActive, onClick, badge }) => (
  <button onClick={onClick} className={`flex-1 py-2.5 flex flex-col items-center justify-center relative transition-all ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
    <div className={`transition-transform mb-1 ${isActive ? 'scale-110' : 'scale-100'}`}>
      {React.cloneElement(icon, { size: 24, strokeWidth: isActive ? 2.5 : 2 })}
    </div>
    {badge > 0 && (
      <span className="absolute top-1.5 right-[18%] bg-red-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
    <span className="text-[10px] font-black">{label}</span>
  </button>
));

// --- Main App ---
export default function App() {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(() => localStorage.getItem(STORAGE_KEY_WORKSPACE) || null);
  const [records, setRecords] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'error') => setToast({ message, type }), []);

  const uncheckedCount = useMemo(() =>
    records.filter(r => checkIsAdmitted(r) && !r.officeChecked).length, [records]);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !workspace) { setLoading(false); return; }
    setLoading(true);
    const unsubR = onSnapshot(
      collection(db, 'artifacts', APP_ID, 'public', 'data', `${workspace}_patients`),
      snap => { setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err => { console.error(err); setLoading(false); }
    );
    const unsubS = onSnapshot(
      doc(db, 'artifacts', APP_ID, 'public', 'data', 'workspaces', workspace),
      snap => setStaffs(snap.exists() ? snap.data().staff || [] : []),
      console.error
    );
    return () => { unsubR(); unsubS(); };
  }, [user, workspace]);

  const handleUpdateRecord = useCallback(async (data) => {
    if (!user || !workspace) return;
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', `${workspace}_patients`, data.id), { ...data, updatedAt: Date.now() }, { merge: true });
    } catch { showToast('保存に失敗しました'); }
  }, [user, workspace, showToast]);

  const handleJoinWorkspace = useCallback((name) => {
    setWorkspace(name);
    localStorage.setItem(STORAGE_KEY_WORKSPACE, name);
  }, []);

  const handleLeaveWorkspace = useCallback(() => {
    setWorkspace(null);
    localStorage.removeItem(STORAGE_KEY_WORKSPACE);
    setRecords([]); setStaffs([]);
  }, []);

  if (loading && workspace) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50 gap-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 font-bold text-sm">読み込み中...</p>
      </div>
    );
  }

  if (!workspace) return <WorkspaceSetupView onJoin={handleJoinWorkspace} />;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-24 text-gray-900">
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideDown { from { opacity:0; transform:translate(-50%,-16px); } to { opacity:1; transform:translate(-50%,0); } }
        .animate-fade-in-up { animation: fadeInUp .2s ease-out forwards; }
        .animate-toast { animation: slideDown .3s cubic-bezier(.16,1,.3,1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display:none; }
        .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="bg-blue-600 text-white px-4 py-3.5 shadow-md sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="font-black text-lg flex items-center gap-2">
            <Building2 size={22} /> 入退院管理
          </h1>
          <div className="flex items-center gap-2">
            {uncheckedCount > 0 && (
              <div className="bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                <Bell size={11} /> 未入力 {uncheckedCount}件
              </div>
            )}
            <div className="text-xs font-bold bg-blue-700/50 px-3 py-1.5 rounded-full border border-blue-500/50">{workspace}</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 animate-fade-in-up">
        {activeTab === 'new' && <NewRecordView user={user} workspace={workspace} staffs={staffs} onSuccess={() => setActiveTab('list')} showToast={showToast} />}
        {activeTab === 'list' && <ListView user={user} workspace={workspace} records={records} staffs={staffs} showToast={showToast} onUpdate={handleUpdateRecord} />}
        {activeTab === 'stats' && <StatsView staffs={staffs} records={records} onUpdate={handleUpdateRecord} />}
        {activeTab === 'master' && <MasterView user={user} workspace={workspace} staffs={staffs} showToast={showToast} onLeave={handleLeaveWorkspace} />}
        {activeTab === 'help' && <HelpView workspace={workspace} />}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] z-40">
        <div className="max-w-2xl mx-auto flex justify-around py-1">
          <NavItem icon={<FilePlus />} label="新規入力" isActive={activeTab === 'new'} onClick={() => setActiveTab('new')} />
          <NavItem icon={<LayoutList />} label="一覧" isActive={activeTab === 'list'} onClick={() => setActiveTab('list')} badge={uncheckedCount} />
          <NavItem icon={<BarChart3 />} label="集計" isActive={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
          <NavItem icon={<Settings />} label="マスタ" isActive={activeTab === 'master'} onClick={() => setActiveTab('master')} />
          <NavItem icon={<HelpCircle />} label="使い方" isActive={activeTab === 'help'} onClick={() => setActiveTab('help')} />
        </div>
      </nav>
    </div>
  );
}

// --- Workspace Setup ---
function WorkspaceSetupView({ onJoin }) {
  const [inputName, setInputName] = useState('');
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex justify-center items-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm animate-fade-in-up">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <Building2 size={44} strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-2xl font-black text-center text-gray-800 mb-1">営業所グループ</h1>
        <p className="text-center text-gray-400 text-sm font-medium mb-7">営業所名を入力してください</p>
        <form onSubmit={e => { e.preventDefault(); if (inputName.trim()) onJoin(inputName.trim()); }} className="space-y-4">
          <input type="text" value={inputName} onChange={e => setInputName(e.target.value)} placeholder="例: 行橋営業所"
            className="w-full p-4 border-2 border-gray-200 rounded-2xl text-lg font-black outline-none focus:border-blue-500 bg-gray-50 transition-all" autoFocus />
          <button type="submit" disabled={!inputName.trim()}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 shadow-lg active:scale-95 transition-all">
            この営業所を選択
          </button>
        </form>
      </div>
    </div>
  );
}

// --- New Record View ---
function NewRecordView({ user, workspace, staffs, onSuccess, showToast }) {
  const initForm = { id: null, staff: '', patientName: '', admissionDate: '', admissionPlanned: false, dischargeDate: '', dischargePlanned: false, remarks: '', officeChecked: false, officeCheckedAt: '', dischargeProspect: false, amount: 0 };
  const [form, setForm] = useState({ ...initForm });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!form.staff && staffs.length > 0) set('staff', staffs[0]);
  }, [staffs, form.staff]);

  const handleSave = async () => {
    if (!user) return;
    if (!form.patientName.trim()) return showToast('顧客名を入力してください');
    setSaving(true);
    try {
      const id = form.id || generateId();
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', `${workspace}_patients`, id), {
        ...form, id, staff: form.staff || staffs[0] || '',
        amount: Number(form.amount) || 0, createdAt: form.createdAt || Date.now(), updatedAt: Date.now()
      });
      setForm({ ...initForm, staff: staffs[0] || '' });
      showToast('保存しました', 'success');
      onSuccess();
    } catch { showToast('エラーが発生しました'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4">
        <h2 className="font-black text-white text-lg flex items-center gap-2"><FilePlus size={20} /> 新規データ入力</h2>
        <p className="text-blue-100 text-xs font-medium mt-0.5">入院・入所の情報を登録します</p>
      </div>
      <div className="p-5 space-y-5">
        {/* 顧客名 */}
        <div className="space-y-1.5">
          <label className="text-sm font-black text-gray-700">顧客名 <span className="text-red-500">*</span></label>
          <input type="text" value={form.patientName} onChange={e => set('patientName', e.target.value)} placeholder="山田 太郎"
            className="w-full p-4 border-2 border-gray-200 rounded-xl font-black text-lg outline-none focus:border-blue-500 hover:border-gray-300 transition-all" />
        </div>

        {/* 担当者 */}
        <div className="space-y-1.5">
          <label className="text-sm font-black text-gray-700">担当者</label>
          <div className="flex flex-wrap gap-2">
            {staffs.map(s => (
              <button key={s} type="button" onClick={() => set('staff', s)}
                className={`px-4 py-2.5 rounded-xl text-sm font-black border-2 transition-all ${form.staff === s ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                {s}
              </button>
            ))}
            {staffs.length === 0 && <p className="text-sm text-gray-400 font-medium">マスタから担当者を登録してください</p>}
          </div>
        </div>

        {/* 入院日 */}
        <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2">
          <SmartDateInput label="入院・入所日" value={form.admissionDate} onChange={v => set('admissionDate', v)} />
          <label className="flex items-center gap-2 text-sm font-bold text-gray-500 cursor-pointer">
            <input type="checkbox" checked={form.admissionPlanned} onChange={e => set('admissionPlanned', e.target.checked)} className="w-4 h-4 accent-blue-600" />
            予定日として登録
          </label>
        </div>

        {/* 退院日 */}
        <div className="p-4 bg-orange-50/60 rounded-xl border border-orange-100 space-y-2">
          <SmartDateInput label="退院・退所日" value={form.dischargeDate} onChange={v => set('dischargeDate', v)} />
          <label className="flex items-center gap-2 text-sm font-bold text-gray-500 cursor-pointer">
            <input type="checkbox" checked={form.dischargePlanned} onChange={e => set('dischargePlanned', e.target.checked)} className="w-4 h-4 accent-orange-600" />
            予定日として登録
          </label>
        </div>

        {/* 請求額 */}
        <div className="space-y-1.5">
          <label className="text-sm font-black text-gray-700 flex items-center gap-2">
            請求額 <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold">任意</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black">¥</span>
            <input type="number" value={form.amount || ''} onChange={e => set('amount', Number(e.target.value))} placeholder="0"
              className="w-full p-4 pl-8 border-2 border-gray-200 rounded-xl font-black outline-none focus:border-blue-400 hover:border-gray-300 transition-all" />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
          {saving
            ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />保存中...</>
            : <><Save size={20} />保存して登録</>}
        </button>
      </div>
    </div>
  );
}

// --- Patient Card ---
const PatientCard = React.memo(({ record, onEdit, onUpdate }) => {
  const days = calculateDaysFromAdmission(record.admissionDate);
  const { bg } = getDaysInfo(days);

  const handleToggle = useCallback(() => {
    onUpdate({ ...record, officeChecked: !record.officeChecked, officeCheckedAt: !record.officeChecked ? formatTimestamp() : '' });
  }, [record, onUpdate]);

  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm transition-all ${record.officeChecked ? 'border-gray-100 opacity-70' : 'border-gray-200 hover:border-blue-200 hover:shadow-md'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <button onClick={() => onEdit(record)} className="text-left font-black text-gray-800 text-base hover:text-blue-600 flex items-center gap-1 group transition-colors">
              <span className="truncate">{record.patientName}</span>
              <ChevronRight size={15} className="text-gray-300 group-hover:text-blue-400 flex-shrink-0 transition-all group-hover:translate-x-0.5" />
            </button>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-gray-400 font-bold">{record.staff}</span>
              {days >= 0 && (
                <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${bg}`}>{days}日目</span>
              )}
            </div>
          </div>
          <button onClick={handleToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition-all flex-shrink-0 ${record.officeChecked
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-red-500 text-white border-red-500 hover:bg-red-600 shadow-sm shadow-red-200'}`}>
            {record.officeChecked ? <CheckCircle2 size={13} /> : <AlertIcon size={13} />}
            {record.officeChecked ? '入力済' : '未入力'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          {record.admissionDate && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold border border-blue-100">
              <Calendar size={10} />入院: {formatJapaneseDate(record.admissionDate)}{record.admissionPlanned && <span className="opacity-60">(予)</span>}
            </span>
          )}
          {record.dischargeDate && (
            <span className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded-lg font-bold border border-orange-100">
              <Calendar size={10} />退院: {formatJapaneseDate(record.dischargeDate)}{record.dischargePlanned && <span className="opacity-60">(予)</span>}
            </span>
          )}
          {record.amount > 0 && (
            <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded-lg font-bold border border-gray-100">{formatCurrency(record.amount)}</span>
          )}
        </div>

        {record.officeChecked && record.officeCheckedAt && (
          <p className="text-[10px] text-emerald-500 font-bold mt-2">✓ {record.officeCheckedAt} に入力完了</p>
        )}
      </div>
    </div>
  );
});

// --- List View ---
function ListView({ user, workspace, records, staffs, showToast, onUpdate }) {
  const [filterStaff, setFilterStaff] = useState('全て');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [includeDischarged, setIncludeDischarged] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const filtered = useMemo(() => records.filter(r => {
    const matchStaff = filterStaff === '全て' || r.staff === filterStaff;
    const matchStatus = filterStatus === 'all' || !r.officeChecked;
    const matchSearch = !searchText || r.patientName?.toLowerCase().includes(searchText.toLowerCase());
    const matchAdmitted = includeDischarged || checkIsAdmitted(r);
    return matchStaff && matchStatus && matchSearch && matchAdmitted;
  }).sort((a, b) => new Date(b.admissionDate || 0) - new Date(a.admissionDate || 0)), [records, filterStaff, filterStatus, includeDischarged, searchText]);

  const summary = useMemo(() => {
    const admitted = records.filter(r => checkIsAdmitted(r));
    return { total: admitted.length, unchecked: admitted.filter(r => !r.officeChecked).length };
  }, [records]);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="text-2xl font-black text-gray-800">{summary.total}<span className="text-sm font-bold text-gray-400 ml-1">名</span></div>
          <div className="text-xs font-bold text-gray-400 mt-0.5">入院中</div>
        </div>
        <div className={`rounded-2xl p-4 border shadow-sm ${summary.unchecked > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className={`text-2xl font-black ${summary.unchecked > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {summary.unchecked}<span className="text-sm font-bold opacity-60 ml-1">件</span>
          </div>
          <div className={`text-xs font-bold mt-0.5 ${summary.unchecked > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
            {summary.unchecked > 0 ? 'れん太 未入力' : 'れん太 全員完了 ✓'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="顧客名で検索..."
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 hover:border-gray-300 transition-all bg-gray-50" />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <FilterChip label="全員" isActive={filterStaff === '全て'} onClick={() => setFilterStaff('全て')} />
          {staffs.map(s => {
            const cnt = records.filter(r => r.staff === s && checkIsAdmitted(r)).length;
            return <FilterChip key={s} label={s} isActive={filterStaff === s} onClick={() => setFilterStaff(s)} count={cnt} />;
          })}
        </div>
        <div className="flex gap-2 flex-wrap">
          <FilterChip label="全て" isActive={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
          <FilterChip label="未入力のみ" isActive={filterStatus === 'unconfirmed'} onClick={() => setFilterStatus('unconfirmed')} />
          <button onClick={() => setIncludeDischarged(!includeDischarged)}
            className={`px-3.5 py-2 rounded-xl text-sm font-black border-2 transition-all ${includeDischarged ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {includeDischarged ? '退院済含む ✓' : '退院済を含める'}
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2.5">
        {filtered.map(r => <PatientCard key={r.id} record={r} onEdit={setEditingRecord} onUpdate={onUpdate} />)}
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-gray-400 font-black text-sm">該当するデータなし</p>
          </div>
        )}
      </div>

      {editingRecord && (
        <EditModal record={editingRecord} staffs={staffs} onClose={() => setEditingRecord(null)}
          onSave={data => { onUpdate(data); setEditingRecord(null); }}
          onDelete={async id => {
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', `${workspace}_patients`, id));
            setEditingRecord(null);
          }}
        />
      )}
    </div>
  );
}

// --- Edit Modal ---
function EditModal({ record, staffs, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ ...record });
  const [isDelConfOpen, setIsDelConfOpen] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const toggleCheck = useCallback(() => {
    setForm(p => ({ ...p, officeChecked: !p.officeChecked, officeCheckedAt: !p.officeChecked ? formatTimestamp() : '' }));
  }, []);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-0 sm:p-4">
        <div className="bg-white w-full sm:w-[520px] sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl animate-fade-in-up flex flex-col">
          <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex justify-between items-center z-10 rounded-t-3xl">
            <div>
              <h2 className="font-black text-gray-800 text-lg">{form.patientName}</h2>
              <p className="text-xs text-gray-400 font-medium">{form.staff} · 編集</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"><X size={20} /></button>
          </div>

          <div className="flex-1 p-5 space-y-4">
            {/* れん太チェック */}
            <button onClick={toggleCheck}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${form.officeChecked ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-red-50 border-red-300 text-red-600 hover:border-red-400'}`}>
              <div className="flex items-center gap-3">
                {form.officeChecked ? <CheckCircle2 size={24} /> : <AlertIcon size={24} />}
                <div className="text-left">
                  <div className="font-black text-sm">Smartれん太 入力チェック</div>
                  <div className="text-xs font-medium opacity-70">{form.officeChecked ? (form.officeCheckedAt || '処理済') : '未処理 — タップで切り替え'}</div>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full relative transition-colors ${form.officeChecked ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.officeChecked ? 'left-5' : 'left-0.5'}`} />
              </div>
            </button>

            {/* 日付 */}
            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
              <SmartDateInput label="入院・入所日" value={form.admissionDate} onChange={v => set('admissionDate', v)} />
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer">
                <input type="checkbox" checked={form.admissionPlanned || false} onChange={e => set('admissionPlanned', e.target.checked)} className="w-4 h-4 accent-blue-600" /> 予定日
              </label>
            </div>
            <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100 space-y-2">
              <SmartDateInput label="退院・退所日" value={form.dischargeDate} onChange={v => set('dischargeDate', v)} />
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 cursor-pointer">
                <input type="checkbox" checked={form.dischargePlanned || false} onChange={e => set('dischargePlanned', e.target.checked)} className="w-4 h-4 accent-orange-600" /> 予定日
              </label>
            </div>

            {/* 請求額 */}
            <div className="space-y-1.5">
              <label className="text-sm font-black text-gray-600">請求額（任意）</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black">¥</span>
                <input type="number" value={form.amount || ''} onChange={e => set('amount', Number(e.target.value))} placeholder="0"
                  className="w-full p-4 pl-8 border-2 border-gray-200 rounded-xl font-black outline-none focus:border-blue-400 transition-all" />
              </div>
            </div>

            {/* 備考 */}
            <div className="space-y-1.5">
              <label className="text-sm font-black text-gray-600">備考</label>
              <textarea value={form.remarks || ''} onChange={e => set('remarks', e.target.value)} rows={3} placeholder="メモ..."
                className="w-full p-3.5 border-2 border-gray-200 rounded-xl text-sm font-medium outline-none hover:border-gray-300 focus:border-blue-400 transition-all resize-none" />
            </div>

            {/* 顧客名・担当 */}
            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-500">顧客名</label>
                <input type="text" value={form.patientName} onChange={e => set('patientName', e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-500">担当者</label>
                <select value={form.staff} onChange={e => set('staff', e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 bg-white transition-all h-[46px]">
                  {staffs.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex gap-3 z-10">
            <button onClick={() => setIsDelConfOpen(true)} className="w-12 h-12 flex items-center justify-center text-red-400 bg-red-50 rounded-xl hover:bg-red-100 border border-red-100 transition-colors flex-shrink-0">
              <Trash2 size={20} />
            </button>
            <button onClick={() => onSave(form)}
              className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-black text-base shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2">
              <Save size={20} /> 変更を保存
            </button>
          </div>
        </div>
      </div>
      <ConfirmModal isOpen={isDelConfOpen} title="データを削除" message={`「${form.patientName}」のデータを削除します。取り消せません。`}
        onConfirm={() => onDelete(form.id)} onCancel={() => setIsDelConfOpen(false)} />
    </>
  );
}

// --- Stats View ---
function StatsView({ staffs, records, onUpdate }) {
  const [expandedPeriod, setExpandedPeriod] = useState(null);
  const [filterStaff, setFilterStaff] = useState('全て');

  const stats = useMemo(() => {
    const admitted = records.filter(r => checkIsAdmitted(r) && (filterStaff === '全て' || r.staff === filterStaff));
    const result = { under30: { count: 0, amount: 0, items: [] }, under60: { count: 0, amount: 0, items: [] }, under90: { count: 0, amount: 0, items: [] }, over90: { count: 0, amount: 0, items: [] }, total: { count: 0, amount: 0, prospectAmount: 0 } };
    admitted.forEach(r => {
      const days = calculateDaysFromAdmission(r.admissionDate);
      const amount = Number(r.amount) || 0;
      result.total.count++;
      result.total.amount += amount;
      if (r.dischargeProspect) result.total.prospectAmount += amount;
      const key = days <= 30 ? 'under30' : days <= 60 ? 'under60' : days <= 90 ? 'under90' : 'over90';
      result[key].count++;
      result[key].amount += amount;
      result[key].items.push(r);
    });
    return result;
  }, [records, filterStaff]);

  const maxCount = Math.max(stats.under30.count, stats.under60.count, stats.under90.count, stats.over90.count, 1);

  const periods = [
    { key: 'under30', label: '〜30日', bar: 'bg-emerald-500' },
    { key: 'under60', label: '〜60日', bar: 'bg-yellow-400' },
    { key: 'under90', label: '〜90日', bar: 'bg-orange-500' },
    { key: 'over90', label: '90日〜', bar: 'bg-red-500' },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <FilterChip label="全員" isActive={filterStaff === '全て'} onClick={() => setFilterStaff('全て')} />
          {staffs.map(s => <FilterChip key={s} label={s} isActive={filterStaff === s} onClick={() => setFilterStaff(s)} />)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Users size={13} /> 合計</div>
          <div className="text-3xl font-black text-gray-800">{stats.total.count}<span className="text-sm font-bold text-gray-400 ml-1">名</span></div>
          <div className="text-sm font-black text-gray-500 mt-1">{formatCurrency(stats.total.amount)}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-5 border border-orange-200 shadow-sm">
          <div className="text-xs font-black text-orange-500 uppercase tracking-widest mb-2 flex items-center gap-1"><TrendingUp size={13} /> 退院見通し</div>
          <div className="text-2xl font-black text-orange-600">{formatCurrency(stats.total.prospectAmount)}</div>
          <div className="text-xs font-medium text-orange-400 mt-1">着地予測</div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-widest">入院日数 分布</h3>
        <div className="space-y-3">
          {periods.map(({ key, label, bar }) => {
            const s = stats[key];
            const width = s.count === 0 ? 2 : Math.max((s.count / maxCount) * 100, 8);
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="text-xs font-black text-gray-500 w-12 text-right">{label}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                  <div className={`${bar} h-full rounded-full transition-all duration-700`} style={{ width: `${width}%` }} />
                  <div className="absolute inset-0 flex items-center px-3">
                    <span className="text-xs font-black text-white drop-shadow">{s.count}名</span>
                  </div>
                </div>
                <div className="text-xs font-black text-gray-600 w-20 text-right">{formatCurrency(s.amount)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable Periods */}
      <div className="space-y-2.5">
        {periods.map(({ key, label, bar }) => {
          const s = stats[key];
          const isOpen = expandedPeriod === key;
          return (
            <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => setExpandedPeriod(isOpen ? null : key)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${bar}`} />
                  <span className="font-black text-gray-800 text-sm">{label}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-black">{s.count}名</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-gray-700 text-sm">{formatCurrency(s.amount)}</span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-3 space-y-2 animate-fade-in-up">
                  {s.items.map(p => <StatItemRow key={p.id} patient={p} onUpdate={onUpdate} />)}
                  {s.items.length === 0 && <p className="text-center text-sm text-gray-400 py-4">該当なし</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const StatItemRow = React.memo(({ patient, onUpdate }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
    <div className="flex justify-between items-start">
      <div>
        <div className="font-black text-sm text-gray-800">{patient.patientName}</div>
        <div className="text-xs text-gray-400 font-medium mt-0.5">{patient.staff}</div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <span className="text-xs font-black text-gray-500">見通し</span>
        <button onClick={() => onUpdate({ ...patient, dischargeProspect: !patient.dischargeProspect })}
          className={`w-10 h-5 rounded-full relative transition-colors ${patient.dischargeProspect ? 'bg-orange-500' : 'bg-gray-200'}`}>
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${patient.dischargeProspect ? 'left-5' : 'left-0.5'}`} />
        </button>
      </label>
    </div>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
      <input type="number" value={patient.amount || ''} onChange={e => onUpdate({ ...patient, amount: Number(e.target.value) })} placeholder="請求額を入力"
        className="w-full pl-7 pr-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-black outline-none focus:border-blue-400 hover:border-gray-300 transition-all" />
    </div>
  </div>
));

// --- Master View ---
function MasterView({ user, workspace, staffs, showToast, onLeave }) {
  const [newName, setNewName] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  const handleAdd = useCallback(async () => {
    if (!user || !newName.trim()) return;
    if (staffs.includes(newName.trim())) return showToast('すでに登録されています');
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'workspaces', workspace), { staff: [...staffs, newName.trim()] }, { merge: true });
      setNewName('');
      showToast('登録しました', 'success');
    } catch { showToast('エラーが発生しました'); }
  }, [user, newName, staffs, workspace, showToast]);

  const handleDelete = useCallback(async () => {
    if (!toDelete) return;
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'workspaces', workspace), { staff: staffs.filter(s => s !== toDelete) }, { merge: true });
      showToast('削除しました', 'success');
      setToDelete(null);
    } catch { showToast('削除に失敗しました'); }
  }, [toDelete, staffs, workspace, showToast]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-6 text-white flex justify-between items-center shadow-lg">
        <div>
          <h2 className="text-xl font-black mb-1">マスタ管理</h2>
          <p className="text-gray-300 text-sm font-medium">{workspace}</p>
        </div>
        <button onClick={() => setLeaveConfirm(true)} className="text-xs font-black bg-white/10 border border-white/20 px-4 py-2.5 rounded-xl hover:bg-white/20 transition-colors">設定解除</button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">登録済み担当者 ({staffs.length}名)</h4>
        <div className="flex flex-wrap gap-2">
          {staffs.map(s => (
            <div key={s} className="flex items-center gap-2 bg-gray-50 border-2 border-gray-200 px-4 py-2.5 rounded-xl font-black text-sm text-gray-800 hover:border-gray-300 transition-colors">
              <User size={15} className="text-blue-500" />{s}
              <button onClick={() => setToDelete(s)} className="text-gray-300 hover:text-red-500 transition-colors ml-1"><X size={15} /></button>
            </div>
          ))}
          {staffs.length === 0 && <p className="text-sm text-gray-400 font-medium">担当者が登録されていません</p>}
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">担当者を追加</h4>
          <div className="flex gap-2">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="名前を入力"
              className="flex-1 p-3.5 border-2 border-gray-200 rounded-xl font-black outline-none focus:border-blue-400 hover:border-gray-300 transition-all" />
            <button onClick={handleAdd} disabled={!newName.trim()}
              className="px-5 py-3.5 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 disabled:opacity-40 active:scale-95 transition-all flex items-center gap-1.5">
              <Plus size={18} />登録
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal isOpen={!!toDelete} title="担当者を削除" message={`「${toDelete}」をリストから削除しますか？`} onConfirm={handleDelete} onCancel={() => setToDelete(null)} />
      <ConfirmModal isOpen={leaveConfirm} title="設定解除" message={`「${workspace}」の設定を解除します。データは保持されます。`} onConfirm={onLeave} onCancel={() => setLeaveConfirm(false)} confirmLabel="解除する" confirmColor="bg-orange-500" />
    </div>
  );
}

// --- Help View ---
function HelpView({ workspace }) {
  const steps = [
    { n: '①', title: 'マスタに担当者を登録', desc: '「マスタ」タブから担当者名を追加してください。' },
    { n: '②', title: '新規入力から登録', desc: '入院・退院日、顧客名を入力して保存します。' },
    { n: '③', title: 'れん太入力チェック', desc: '一覧の「未入力」ボタンをタップして処理済にします。' },
    { n: '④', title: '集計で売上確認', desc: '請求額と退院見通しを入力すると着地予測が出ます。' },
  ];
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl">
        <h2 className="text-2xl font-black flex items-center gap-2 mb-1"><HelpCircle size={26} /> 使い方ガイド</h2>
        <p className="text-blue-200 text-sm font-medium">グループ: {workspace}</p>
      </div>
      <div className="space-y-2.5">
        {steps.map(({ n, title, desc }) => (
          <div key={n} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex gap-4">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black text-sm flex-shrink-0">{n}</div>
            <div>
              <h3 className="font-black text-gray-800 text-sm mb-0.5">{title}</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
        <h3 className="font-black text-blue-700 text-sm mb-2 flex items-center gap-1"><Calendar size={15} /> 日付入力のコツ</h3>
        <ul className="text-sm text-blue-600 font-medium space-y-1.5">
          <li>• <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">5/6</code> → 今年の5月6日</li>
          <li>• <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">0506</code> → 5月6日</li>
          <li>• <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">20250506</code> → 2025年5月6日</li>
          <li>• カレンダーアイコンからも選択できます</li>
        </ul>
      </div>
    </div>
  );
}
