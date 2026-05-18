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
  Bell, TrendingUp, Printer, LogOut, Minus
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
const STORAGE_KEY_STAFF = 'app_my_staff';
const STORAGE_KEY_ZOOM = 'app_zoom_v2';
const HQ_CODE = '本社';

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
    } else if (/^\d{2}$/.test(val)) {
      const num = parseInt(val);
      if (num > 31) {
        p = `${y}-${val[0].padStart(2, '0')}-${val[1].padStart(2, '0')}`;
      } else {
        p = `${y}-${m}-${val}`;
      }
    } else if (/^\d{1}$/.test(val)) {
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
    className={`px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all duration-200 whitespace-nowrap border ${isActive
      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
    {label}
    {count !== undefined && (
      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
    )}
  </button>
));

const NavItem = React.memo(({ icon, label, isActive, onClick, badge }) => (
  <button onClick={onClick} className={`flex-1 py-3 flex flex-col items-center justify-center relative transition-all ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
    <div className={`transition-transform mb-1 ${isActive ? 'scale-110' : 'scale-100'}`}>
      {React.cloneElement(icon, { size: 28, strokeWidth: isActive ? 2.5 : 2 })}
    </div>
    {badge > 0 && (
      <span className="absolute top-2 right-[16%] bg-red-500 text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
    <span className="text-xs font-black">{label}</span>
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
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem(STORAGE_KEY_ZOOM)) || 130);

  const isHQ = workspace === HQ_CODE;
  const showToast = useCallback((message, type = 'error') => setToast({ message, type }), []);

  const uncheckedCount = useMemo(() =>
    records.filter(r => checkIsAdmitted(r) && !r.officeChecked).length, [records]);

  const changeZoom = useCallback((delta) => {
    setZoom(z => {
      const next = Math.min(150, Math.max(70, z + delta));
      localStorage.setItem(STORAGE_KEY_ZOOM, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !workspace) { setLoading(false); return; }
    setLoading(true);

    if (workspace === HQ_CODE) {
      const patientUnsubs = {};
      const officeRecords = {};
      const pushRecords = () => {
        setRecords(Object.entries(officeRecords).flatMap(([office, recs]) =>
          recs.map(r => ({ ...r, _office: office }))));
      };
      const unsubWs = onSnapshot(
        collection(db, 'artifacts', APP_ID, 'public', 'data', 'workspaces'),
        wsSnap => {
          const offices = wsSnap.docs.map(d => d.id).filter(id => id !== HQ_CODE);
          Object.keys(patientUnsubs).forEach(o => {
            if (!offices.includes(o)) { patientUnsubs[o](); delete patientUnsubs[o]; delete officeRecords[o]; }
          });
          offices.forEach(o => {
            if (patientUnsubs[o]) return;
            patientUnsubs[o] = onSnapshot(
              collection(db, 'artifacts', APP_ID, 'public', 'data', `${o}_patients`),
              pSnap => { officeRecords[o] = pSnap.docs.map(d => ({ id: d.id, ...d.data() })); pushRecords(); },
              console.error
            );
          });
          pushRecords();
          setLoading(false);
        },
        err => { console.error(err); setLoading(false); }
      );
      return () => { unsubWs(); Object.values(patientUnsubs).forEach(fn => fn()); };
    }

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
    if (!user) return;
    const targetWs = isHQ ? data._office : workspace;
    if (!targetWs) return;
    try {
      const { _office, ...clean } = data;
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', `${targetWs}_patients`, clean.id), { ...clean, updatedAt: Date.now() }, { merge: true });
    } catch { showToast('保存に失敗しました'); }
  }, [user, workspace, isHQ, showToast]);

  const handleJoinWorkspace = useCallback((name) => {
    setWorkspace(name);
    setActiveTab(name === HQ_CODE ? 'list' : 'new');
    localStorage.setItem(STORAGE_KEY_WORKSPACE, name);
    if (name !== HQ_CODE) {
      setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'workspaces', name), { name }, { merge: true }).catch(console.error);
    }
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
    <div className="min-h-screen bg-slate-50 font-sans pb-24 text-slate-900 print:bg-white print:pb-0" style={{ zoom: zoom / 100 }}>
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideDown { from { opacity:0; transform:translate(-50%,-16px); } to { opacity:1; transform:translate(-50%,0); } }
        .animate-fade-in-up { animation: fadeInUp .2s ease-out forwards; }
        .animate-toast { animation: slideDown .3s cubic-bezier(.16,1,.3,1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display:none; }
        .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
      `}</style>

      {toast && <div className="print:hidden"><Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /></div>}

      <header className="bg-blue-600 text-white px-4 py-3 shadow-md sticky top-0 z-40 print:hidden">
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-2">
          <h1 className="font-black text-base flex items-center gap-1.5 min-w-0">
            <Building2 size={20} className="flex-shrink-0" />
            <span className="truncate">{isHQ ? '本社管理' : '入退院管理フォーム'}</span>
          </h1>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center bg-blue-700/50 rounded-lg border border-blue-500/50 overflow-hidden">
              <button onClick={() => changeZoom(-10)} className="px-2 py-1.5 hover:bg-blue-800/50 transition-colors" aria-label="縮小"><Minus size={14} /></button>
              <span className="text-[10px] font-black px-1 w-9 text-center">{zoom}%</span>
              <button onClick={() => changeZoom(10)} className="px-2 py-1.5 hover:bg-blue-800/50 transition-colors" aria-label="拡大"><Plus size={14} /></button>
            </div>
            <div className="text-xs font-bold bg-blue-700/50 px-2.5 py-1.5 rounded-lg border border-blue-500/50">{workspace}</div>
            <button onClick={handleLeaveWorkspace} className="flex items-center gap-1 text-xs font-black bg-blue-700/50 px-2.5 py-1.5 rounded-lg border border-blue-500/50 hover:bg-blue-800/60 transition-colors">
              <LogOut size={13} /> ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 animate-fade-in-up">
        {activeTab === 'new' && !isHQ && <NewRecordView user={user} workspace={workspace} staffs={staffs} records={records} onSuccess={() => setActiveTab('list')} onUpdate={handleUpdateRecord} showToast={showToast} />}
        {activeTab === 'list' && <ListView user={user} workspace={workspace} records={records} staffs={staffs} isHQ={isHQ} showToast={showToast} onUpdate={handleUpdateRecord} onGoNew={() => setActiveTab('new')} />}
        {activeTab === 'stats' && <StatsView staffs={staffs} records={records} isHQ={isHQ} onUpdate={handleUpdateRecord} />}
        {activeTab === 'master' && !isHQ && <MasterView user={user} workspace={workspace} staffs={staffs} showToast={showToast} onLeave={handleLeaveWorkspace} />}
        {activeTab === 'help' && <HelpView workspace={workspace} />}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] z-40 print:hidden">
        <div className="max-w-4xl mx-auto flex justify-around py-1.5">
          {!isHQ && <NavItem icon={<FilePlus />} label="新規入力" isActive={activeTab === 'new'} onClick={() => setActiveTab('new')} />}
          <NavItem icon={<LayoutList />} label="一覧" isActive={activeTab === 'list'} onClick={() => setActiveTab('list')} badge={uncheckedCount} />
          <NavItem icon={<BarChart3 />} label="集計" isActive={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
          {!isHQ && <NavItem icon={<Settings />} label="マスタ" isActive={activeTab === 'master'} onClick={() => setActiveTab('master')} />}
          <NavItem icon={<HelpCircle />} label="使い方" isActive={activeTab === 'help'} onClick={() => setActiveTab('help')} />
        </div>
      </nav>
    </div>
  );
}

// --- Workspace Setup ---
const WORKSPACE_PASSWORD = 'TSS250';
const HQ_PASSWORD = 'TSS000';

function WorkspaceSetupView({ onJoin }) {
  const [inputName, setInputName] = useState('');
  const [inputPass, setInputPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const code = inputName.trim();
    if (!code) return;
    const expected = code === HQ_CODE ? HQ_PASSWORD : WORKSPACE_PASSWORD;
    if (inputPass !== expected) {
      setError('パスワードが違います');
      return;
    }
    onJoin(code);
  };

  return (
    <div className="min-h-screen bg-white flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200 w-full max-w-xs animate-fade-in-up">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <Building2 size={30} strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-lg font-black text-center text-gray-800 mb-1">入退院管理フォーム</h1>
        <p className="text-center text-gray-400 text-xs font-medium mb-5">コードとパスワードを入力してください</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-black text-gray-500 mb-1 block">コード（営業所名）</label>
            <input type="text" value={inputName} onChange={e => setInputName(e.target.value)} placeholder="例: 行橋"
              className="w-full p-3 border-2 border-gray-200 rounded-xl text-base font-black outline-none focus:border-blue-500 bg-gray-50 transition-all" autoFocus />
          </div>
          <div>
            <label className="text-xs font-black text-gray-500 mb-1 block">パスワード</label>
            <input type="password" value={inputPass} onChange={e => { setInputPass(e.target.value); setError(''); }} placeholder="パスワードを入力"
              className="w-full p-3 border-2 border-gray-200 rounded-xl text-base font-black outline-none focus:border-blue-500 bg-gray-50 transition-all" />
          </div>
          {error && <p className="text-xs text-red-500 font-bold text-center">{error}</p>}
          <button type="submit" disabled={!inputName.trim() || !inputPass}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-base hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 shadow-lg active:scale-95 transition-all">
            ログイン
          </button>
        </form>
      </div>
    </div>
  );
}

// --- New Record View ---
function NewRecordView({ user, workspace, staffs, records, onSuccess, onUpdate, showToast }) {
  const savedStaff = localStorage.getItem(STORAGE_KEY_STAFF) || '';
  const [mode, setMode] = useState('admit');
  const initForm = { id: null, staff: savedStaff, patientName: '', admissionDate: '', admissionPlanned: false, dischargeDate: '', dischargePlanned: false, remarks: '', officeChecked: false, officeCheckedAt: '', dischargeProspect: false, amount: 0 };
  const [form, setForm] = useState({ ...initForm });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const [dStaff, setDStaff] = useState(savedStaff);
  const [dPatientId, setDPatientId] = useState('');
  const [dDate, setDDate] = useState('');
  const [dPlanned, setDPlanned] = useState(false);
  const [dSaving, setDSaving] = useState(false);
  const [dSearch, setDSearch] = useState('');
  const [dDaysFilter, setDDaysFilter] = useState('ALL');
  const [dAmount, setDAmount] = useState(0);

  useEffect(() => {
    if (!form.staff && staffs.length > 0) {
      set('staff', savedStaff && staffs.includes(savedStaff) ? savedStaff : staffs[0]);
    }
    if (!dStaff && staffs.length > 0) {
      setDStaff(savedStaff && staffs.includes(savedStaff) ? savedStaff : staffs[0]);
    }
  }, [staffs]);

  const chooseStaff = (s) => {
    set('staff', s);
    localStorage.setItem(STORAGE_KEY_STAFF, s);
  };
  const chooseDStaff = (s) => {
    setDStaff(s);
    localStorage.setItem(STORAGE_KEY_STAFF, s);
  };

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
      setForm({ ...initForm, staff: form.staff });
      showToast('保存しました', 'success');
      onSuccess();
    } catch { showToast('エラーが発生しました'); }
    finally { setSaving(false); }
  };

  const dischargeCandidates = useMemo(() =>
    records.filter(r => {
      if (!checkIsAdmitted(r) || r.dischargeDate) return false;
      if (dStaff && r.staff !== dStaff) return false;
      if (dSearch && !r.patientName?.toLowerCase().includes(dSearch.toLowerCase())) return false;
      if (dDaysFilter !== 'ALL') {
        const days = calculateDaysFromAdmission(r.admissionDate);
        if (dDaysFilter === '30' && days > 30) return false;
        if (dDaysFilter === '60' && (days <= 30 || days > 60)) return false;
        if (dDaysFilter === '90' && (days <= 60 || days > 90)) return false;
        if (dDaysFilter === 'OVER_90' && days <= 90) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.admissionDate || 0) - new Date(a.admissionDate || 0)),
    [records, dStaff, dSearch, dDaysFilter]);

  const handleDischargeSave = async () => {
    if (!dPatientId) return showToast('退院する方を選択してください');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dDate)) return showToast('退院日を入力してください');
    const target = records.find(r => r.id === dPatientId);
    if (!target) return;
    setDSaving(true);
    try {
      await onUpdate({ ...target, dischargeDate: dDate, dischargePlanned: dPlanned, amount: dAmount || target.amount || 0 });
      showToast('退院日を登録しました', 'success');
      setDPatientId(''); setDDate(''); setDPlanned(false); setDAmount(0);
      onSuccess();
    } catch { showToast('エラーが発生しました'); }
    finally { setDSaving(false); }
  };

  const handleExpandPatient = (id) => {
    if (dPatientId === id) {
      setDPatientId('');
      setDDate('');
      setDPlanned(false);
      setDAmount(0);
    } else {
      const target = records.find(r => r.id === id);
      setDPatientId(id);
      setDDate('');
      setDPlanned(false);
      setDAmount(target?.amount || 0);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* モード切替 */}
      <div className="flex border-b border-gray-100">
        <button onClick={() => setMode('admit')}
          className={`flex-1 py-3.5 font-black text-sm flex items-center justify-center gap-1.5 transition-colors ${mode === 'admit' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
          <FilePlus size={17} /> 新規入院
        </button>
        <button onClick={() => setMode('discharge')}
          className={`flex-1 py-3.5 font-black text-sm flex items-center justify-center gap-1.5 transition-colors ${mode === 'discharge' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
          <Calendar size={17} /> 退院入力
        </button>
      </div>

      {mode === 'admit' ? (
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="p-5 space-y-5">
          {/* 顧客名 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">顧客名 <span className="text-red-500">*</span></label>
            <input type="text" value={form.patientName} onChange={e => set('patientName', e.target.value)}
              placeholder="山田 太郎"
              className="w-full p-4 border-2 border-slate-200 rounded-xl font-bold text-lg outline-none focus:border-blue-500 hover:border-slate-300 transition-all" />
          </div>

          {/* 担当者 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">担当者</label>
            <div className="flex flex-wrap gap-2">
              {staffs.map(s => (
                <button key={s} type="button" onClick={() => chooseStaff(s)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${form.staff === s ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                  {s}
                </button>
              ))}
              {staffs.length === 0 && <p className="text-sm text-slate-400 font-medium">マスタから担当者を登録してください</p>}
            </div>
          </div>

          {/* 入院日 */}
          <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2">
            <SmartDateInput label="入院・入所日" value={form.admissionDate} onChange={v => set('admissionDate', v)} />
            <label className="flex items-center gap-2 text-sm font-medium text-slate-500 cursor-pointer">
              <input type="checkbox" checked={form.admissionPlanned} onChange={e => set('admissionPlanned', e.target.checked)} className="w-4 h-4 accent-blue-600" />
              予定日として登録
            </label>
          </div>

          {/* 請求額 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              請求額 <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium">任意</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</span>
              <input type="number" value={form.amount || ''} onChange={e => set('amount', Number(e.target.value))}
                placeholder="0"
                className="w-full p-4 pl-8 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-blue-400 hover:border-slate-300 transition-all" />
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
            {saving
              ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />保存中...</>
              : <><Save size={20} />保存して登録</>}
          </button>
          <p className="text-xs text-slate-400 text-center font-medium">💡 入力後 Enter キーでも登録できます</p>
        </form>
      ) : (
        <div className="p-5 space-y-4">
          {/* 検索バー */}
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={dSearch} onChange={e => setDSearch(e.target.value)} placeholder="顧客名で検索..."
              className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-400 hover:border-slate-300 transition-all bg-slate-50" />
          </div>

          {/* 担当者フィルター */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">担当者</label>
            <div className="flex flex-wrap gap-2">
              {staffs.map(s => (
                <button key={s} type="button" onClick={() => chooseDStaff(dStaff === s ? '' : s)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${dStaff === s ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                  {s}
                </button>
              ))}
              {staffs.length === 0 && <p className="text-sm text-slate-400 font-medium">マスタから担当者を登録してください</p>}
            </div>
          </div>

          {/* 経過日数フィルター */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">経過日数</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'ALL', label: 'すべて' },
                { id: '30', label: '30日以内' },
                { id: '60', label: '60日以内' },
                { id: '90', label: '90日以内' },
                { id: 'OVER_90', label: '90日以上' },
              ].map(f => (
                <button key={f.id} type="button" onClick={() => setDDaysFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${dDaysFilter === f.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* 退院する方を選択（アコーディオン） */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">退院する方を選択 <span className="text-red-500">*</span>
              <span className="text-xs text-slate-400 font-medium ml-2">({dischargeCandidates.length}名)</span>
            </label>
            {dischargeCandidates.length > 0 ? (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {dischargeCandidates.map(p => {
                  const days = calculateDaysFromAdmission(p.admissionDate);
                  const daysInfo = getDaysInfo(days);
                  const isExpanded = dPatientId === p.id;
                  return (
                    <div key={p.id} className={`rounded-xl border-2 transition-all overflow-hidden ${isExpanded ? 'border-blue-500 shadow-md shadow-blue-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                      {/* カード本体（全域クリック） */}
                      <div onClick={() => handleExpandPatient(p.id)}
                        className="flex items-center justify-between p-3 cursor-pointer">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-800 truncate">{p.patientName}</span>
                          <span className="text-xs text-slate-400 font-medium flex-shrink-0">{p.staff}</span>
                          {days >= 0 && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${daysInfo.bg}`}>{days}日目</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {p.amount > 0 && (
                            <span className="text-xs text-slate-500 font-medium">請求金額 {formatCurrency(p.amount)}</span>
                          )}
                          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs">
                            <span className="text-xs text-slate-400 font-medium">
                              入院 {formatJapaneseDate(p.admissionDate)}
                            </span>
                          </div>
                          {isExpanded
                            ? <ChevronDown size={16} className="text-blue-500" />
                            : <ChevronRight size={16} className="text-slate-400" />}
                        </div>
                      </div>

                      {/* 展開エリア（インライン入力） */}
                      {isExpanded && (
                        <div className="border-t border-blue-200 bg-blue-50/50 p-4 space-y-3 animate-fade-in-up">
                          <SmartDateInput label="退院・退所日" value={dDate} onChange={setDDate} />
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-500 cursor-pointer">
                            <input type="checkbox" checked={dPlanned} onChange={e => setDPlanned(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                            予定日として登録
                          </label>
                          <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-600">請求金額</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">¥</span>
                              <input type="number" value={dAmount || ''} onChange={e => setDAmount(Number(e.target.value))} placeholder="0"
                                className="w-full p-3 pl-7 border-2 border-slate-200 rounded-xl font-bold outline-none focus:border-blue-400 hover:border-slate-300 transition-all bg-white" />
                            </div>
                          </div>
                          <button onClick={handleDischargeSave} disabled={dSaving}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                            {dSaving
                              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />保存中...</>
                              : <><Save size={16} />退院情報を登録</>}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 font-medium py-6 text-center bg-slate-50 rounded-xl">入院中の方がいません</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Patient Card ---
const PatientCard = React.memo(({ record, onEdit, onUpdate }) => {
  const days = calculateDaysFromAdmission(record.admissionDate);
  const { bg } = getDaysInfo(days);

  const handleToggle = useCallback((e) => {
    e.stopPropagation();
    onUpdate({ ...record, officeChecked: !record.officeChecked, officeCheckedAt: !record.officeChecked ? formatTimestamp() : '' });
  }, [record, onUpdate]);

  return (
    <div
      onClick={() => onEdit(record)}
      className={`bg-white rounded-xl border shadow-sm transition-all duration-200 cursor-pointer ${record.officeChecked ? 'border-slate-100 opacity-70' : 'border-slate-200 hover:border-blue-300 hover:shadow-md hover:bg-slate-50/50'}`}
    >
      <div className="p-3">
        {/* 上段: 名前・担当・日数 | ステータス・矢印 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-slate-800 text-base truncate">{record.patientName}</span>
            {record._office && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0">{record._office}</span>
            )}
            <span className="text-xs text-slate-400 font-medium flex-shrink-0">{record.staff}</span>
            {days >= 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${bg}`}>{days}日目</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleToggle}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${record.officeChecked
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-red-500 text-white border-red-500 hover:bg-red-600 shadow-sm shadow-red-200'}`}>
              {record.officeChecked ? <CheckCircle2 size={12} /> : <AlertIcon size={12} />}
              {record.officeChecked ? '入力済' : '未入力'}
            </button>
            <ChevronRight size={16} className="text-slate-300" />
          </div>
        </div>

        {/* 下段: 入院日・退院日・請求金額 */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {record.admissionDate && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium border border-blue-100">
              <Calendar size={10} />入院: {formatJapaneseDate(record.admissionDate)}{record.admissionPlanned && <span className="opacity-60">(予)</span>}
            </span>
          )}
          {record.dischargeDate && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-medium border border-orange-100">
              <Calendar size={10} />退院: {formatJapaneseDate(record.dischargeDate)}{record.dischargePlanned && <span className="opacity-60">(予)</span>}
            </span>
          )}
          {record.amount > 0 && (
            <span className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded text-xs font-medium border border-slate-100">請求金額 {formatCurrency(record.amount)}</span>
          )}
          {record.officeChecked && record.officeCheckedAt && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-xs font-medium border border-emerald-100">
              <CheckCircle2 size={10} />{record.officeCheckedAt}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

// --- List View ---
function ListView({ user, workspace, records, staffs, isHQ, showToast, onUpdate, onGoNew }) {
  const [filterStaff, setFilterStaff] = useState('全て');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDays, setFilterDays] = useState(0);
  const [sortBy, setSortBy] = useState('date');
  const [searchText, setSearchText] = useState('');
  const [includeDischarged, setIncludeDischarged] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const offices = useMemo(() =>
    isHQ ? [...new Set(records.map(r => r._office).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')) : [],
    [records, isHQ]);

  const filtered = useMemo(() => {
    const list = records.filter(r => {
      const matchStaff = filterStaff === '全て' || (isHQ ? r._office === filterStaff : r.staff === filterStaff);
      const matchStatus = filterStatus === 'all' || !r.officeChecked;
      const matchSearch = !searchText || r.patientName?.toLowerCase().includes(searchText.toLowerCase());
      const matchAdmitted = includeDischarged || checkIsAdmitted(r);
      const matchDays = filterDays === 0 || calculateDaysFromAdmission(r.admissionDate) >= filterDays;
      return matchStaff && matchStatus && matchSearch && matchAdmitted && matchDays;
    });
    list.sort((a, b) => {
      if (sortBy === 'days') return calculateDaysFromAdmission(b.admissionDate) - calculateDaysFromAdmission(a.admissionDate);
      if (sortBy === 'staff') return (a.staff || '').localeCompare(b.staff || '', 'ja');
      return new Date(b.admissionDate || 0) - new Date(a.admissionDate || 0);
    });
    return list;
  }, [records, filterStaff, filterStatus, filterDays, sortBy, includeDischarged, searchText, isHQ]);

  const summary = useMemo(() => {
    const admitted = records.filter(r => checkIsAdmitted(r));
    return { total: admitted.length, unchecked: admitted.filter(r => !r.officeChecked).length };
  }, [records]);

  return (
    <div className="space-y-3">
      {!isHQ && (
        <button onClick={onGoNew}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-2xl font-black text-base shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">
          <FilePlus size={20} /> 新規入力・退院入力へ
        </button>
      )}
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="text-2xl font-bold text-slate-800">{summary.total}<span className="text-sm font-medium text-slate-400 ml-1">名</span></div>
          <div className="text-xs font-medium text-slate-400 mt-0.5">入院中</div>
        </div>
        <div className={`rounded-2xl p-4 border shadow-sm ${summary.unchecked > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className={`text-2xl font-bold ${summary.unchecked > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {summary.unchecked}<span className="text-sm font-medium opacity-60 ml-1">件</span>
          </div>
          <div className={`text-xs font-medium mt-0.5 ${summary.unchecked > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
            {summary.unchecked > 0 ? 'れん太 未入力' : 'れん太 全員完了 ✓'}
          </div>
        </div>
      </div>

      {/* Filters - Sticky for 14-inch laptop */}
      <div className="bg-white/95 backdrop-blur rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3 sticky top-16 z-30">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="顧客名で検索..."
            className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-400 hover:border-slate-300 transition-all bg-slate-50" />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <FilterChip label={isHQ ? '全営業所' : '全員'} isActive={filterStaff === '全て'} onClick={() => setFilterStaff('全て')} />
          {(isHQ ? offices : staffs).map(s => {
            const cnt = records.filter(r => (isHQ ? r._office === s : r.staff === s) && checkIsAdmitted(r)).length;
            return <FilterChip key={s} label={s} isActive={filterStaff === s} onClick={() => setFilterStaff(s)} count={cnt} />;
          })}
        </div>
        <div className="flex gap-2 flex-wrap">
          <FilterChip label="全て" isActive={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
          <FilterChip label="未入力のみ" isActive={filterStatus === 'unconfirmed'} onClick={() => setFilterStatus('unconfirmed')} />
          <button onClick={() => setIncludeDischarged(!includeDischarged)}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition-all duration-200 ${includeDischarged ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
            {includeDischarged ? '退院済含む ✓' : '退院済を含める'}
          </button>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <div className="text-xs font-semibold text-slate-400 mb-2">入院日数でしぼり込み</div>
          <div className="flex gap-2 flex-wrap">
            <FilterChip label="全期間" isActive={filterDays === 0} onClick={() => setFilterDays(0)} />
            <FilterChip label="30日以上" isActive={filterDays === 30} onClick={() => setFilterDays(30)} />
            <FilterChip label="60日以上" isActive={filterDays === 60} onClick={() => setFilterDays(60)} />
            <FilterChip label="90日以上" isActive={filterDays === 90} onClick={() => setFilterDays(90)} />
          </div>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <div className="text-xs font-semibold text-slate-400 mb-2">並び替え</div>
          <div className="flex gap-2 flex-wrap">
            <FilterChip label="新しい順" isActive={sortBy === 'date'} onClick={() => setSortBy('date')} />
            <FilterChip label="入院日数が長い順" isActive={sortBy === 'days'} onClick={() => setSortBy('days')} />
            <FilterChip label="担当者順" isActive={sortBy === 'staff'} onClick={() => setSortBy('staff')} />
          </div>
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
            const ws = editingRecord._office || workspace;
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', `${ws}_patients`, id));
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
                  {[...new Set([form.staff, ...staffs].filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
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
function StatsView({ staffs, records, isHQ, onUpdate }) {
  const [expandedPeriod, setExpandedPeriod] = useState(null);
  const [filterStaff, setFilterStaff] = useState('全て');
  const [printScope, setPrintScope] = useState('all');

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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 print:hidden space-y-3">
        {!isHQ && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <FilterChip label="全員" isActive={filterStaff === '全て'} onClick={() => setFilterStaff('全て')} />
            {staffs.map(s => <FilterChip key={s} label={s} isActive={filterStaff === s} onClick={() => setFilterStaff(s)} />)}
          </div>
        )}
        <div>
          <div className="text-xs font-black text-gray-400 mb-2">印刷する期間をえらぶ</div>
          <div className="flex gap-2 flex-wrap">
            <FilterChip label="全期間" isActive={printScope === 'all'} onClick={() => setPrintScope('all')} />
            <FilterChip label="〜30日" isActive={printScope === 'under30'} onClick={() => setPrintScope('under30')} />
            <FilterChip label="〜60日" isActive={printScope === 'under60'} onClick={() => setPrintScope('under60')} />
            <FilterChip label="〜90日" isActive={printScope === 'under90'} onClick={() => setPrintScope('under90')} />
            <FilterChip label="90日〜" isActive={printScope === 'over90'} onClick={() => setPrintScope('over90')} />
          </div>
        </div>
        <button onClick={() => window.print()}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-black text-sm hover:bg-blue-700 active:scale-95 transition-all">
          <Printer size={18} /> 集計結果を印刷する
        </button>
      </div>

      {/* 印刷用見出し */}
      <div className="hidden print:block mb-2">
        <h1 className="text-xl font-black text-gray-900">入退院管理フォーム — 集計結果</h1>
        <p className="text-sm text-gray-600 mt-1">
          対象: {filterStaff === '全て' ? '全員' : filterStaff}
          {' ／ 期間: '}{printScope === 'all' ? '全期間' : (periods.find(p => p.key === printScope)?.label || '')}
          {' ／ 出力日: '}{formatTimestamp()}
        </p>
      </div>

      <div className={`grid grid-cols-2 gap-3 ${printScope !== 'all' ? 'print:hidden' : ''}`}>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Users size={13} /> 合計</div>
          <div className="text-3xl font-black text-gray-800">{stats.total.count}<span className="text-sm font-bold text-gray-400 ml-1">名</span></div>
          <div className="text-sm font-black text-gray-500 mt-1">{formatCurrency(stats.total.amount)}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-5 border border-orange-200 shadow-sm">
          <div className="text-xs font-black text-orange-500 uppercase tracking-widest mb-2 flex items-center gap-1"><TrendingUp size={13} /> 退院見込み</div>
          <div className="text-2xl font-black text-orange-600">{formatCurrency(stats.total.prospectAmount)}</div>
          <div className="text-xs font-medium text-orange-400 mt-1">着地予測</div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 print:hidden">
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

      {/* Expandable Periods (画面用) */}
      <div className="space-y-2.5 print:hidden">
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

      {/* 印刷用 明細テーブル */}
      <div className="hidden print:block space-y-4">
        {periods.filter(({ key }) => printScope === 'all' || printScope === key).map(({ key, label }) => {
          const s = stats[key];
          return (
            <div key={key}>
              <h3 className="text-sm font-black text-gray-900 mb-1 border-b-2 border-gray-800 pb-1">
                {label}（{s.count}名 ／ {formatCurrency(s.amount)}）
              </h3>
              {s.items.length > 0 ? (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-400">
                      <th className="text-left py-1 px-1">顧客名</th>
                      <th className="text-left py-1 px-1">担当者</th>
                      <th className="text-left py-1 px-1">入院日</th>
                      <th className="text-right py-1 px-1">入院日数</th>
                      <th className="text-right py-1 px-1">金額</th>
                      <th className="text-center py-1 px-1">退院見込み</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.items.map(p => (
                      <tr key={p.id} className="border-b border-gray-200">
                        <td className="py-1 px-1">{p.patientName}</td>
                        <td className="py-1 px-1">{p.staff}</td>
                        <td className="py-1 px-1">{formatJapaneseDate(p.admissionDate)}</td>
                        <td className="py-1 px-1 text-right">{calculateDaysFromAdmission(p.admissionDate)}日</td>
                        <td className="py-1 px-1 text-right">{formatCurrency(p.amount)}</td>
                        <td className="py-1 px-1 text-center">{p.dischargeProspect ? '◯' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-gray-500 py-1">該当なし</p>
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
      <button onClick={() => onUpdate({ ...patient, dischargeProspect: !patient.dischargeProspect })}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all ${patient.dischargeProspect ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
        <CheckCircle2 size={14} /> 退院見込み
      </button>
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
    { n: '②', title: '新規入力から登録', desc: '入院・退院日、顧客名を入力して保存します。入力後、Enterキーを押すだけで素早く登録できます。' },
    { n: '③', title: '退院処理', desc: '「退院入力」タブで患者カードをクリックすると、その場に入力フォームが展開し、退院日と請求金額を入力できます。' },
    { n: '④', title: '検索・絞り込み', desc: '上部のフィルターを使って、担当者や経過日数から目的の対象者をすぐに絞り込めます。' },
    { n: '⑤', title: 'れん太入力チェック', desc: '一覧の「未入力」ボタンをクリックして処理済にします。カード全体をクリックすると詳細編集画面が開きます。' },
    { n: '⑥', title: '集計で売上確認', desc: '請求額と退院見込みを入力すると着地予測が出ます。印刷も可能です。' },
  ];
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl">
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-1"><HelpCircle size={26} /> 使い方ガイド</h2>
        <p className="text-blue-200 text-sm font-medium">グループ: {workspace}</p>
      </div>

      {/* 操作のコツ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <span className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600"><CheckCircle2 size={14} /></span>
          操作のコツ
        </h3>
        <div className="grid gap-2">
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
            <span className="text-lg">⌨️</span>
            <div>
              <div className="font-bold text-slate-700 text-sm">Enterキーで素早く登録</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">新規入院フォームで入力後、Enterキーを押すだけで登録できます。</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
            <span className="text-lg">🔍</span>
            <div>
              <div className="font-bold text-slate-700 text-sm">検索・フィルターで絞り込み</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">担当者や経過日数を組み合わせて絞り込みできます。</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
            <span className="text-lg">👆</span>
            <div>
              <div className="font-bold text-slate-700 text-sm">カードをクリックして退院処理</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">患者カードのどこをクリックしても入力フォームが開きます。</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {steps.map(({ n, title, desc }) => (
          <div key={n} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex gap-4">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">{n}</div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-0.5">{title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
        <h3 className="font-bold text-blue-700 text-sm mb-2 flex items-center gap-1"><Calendar size={15} /> 日付入力のコツ</h3>
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
