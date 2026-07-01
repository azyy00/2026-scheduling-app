import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  X, RefreshCw, Trash2, CalendarDays, GraduationCap, Users, Layers,
  BookOpen, DoorOpen, Star, CalendarRange, LogIn, Activity,
} from 'lucide-react';

const CATEGORY = {
  schedule:   { Icon: CalendarDays,  tint: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' },
  student:    { Icon: GraduationCap, tint: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
  instructor: { Icon: Users,         tint: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400' },
  section:    { Icon: Layers,        tint: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' },
  subject:    { Icon: BookOpen,      tint: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400' },
  classroom:  { Icon: DoorOpen,      tint: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400' },
  event:      { Icon: Star,          tint: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' },
  term:       { Icon: CalendarRange, tint: 'bg-[#7B1C1C]/10 text-[#7B1C1C] dark:bg-[#7B1C1C]/30 dark:text-red-300' },
  auth:       { Icon: LogIn,         tint: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  system:     { Icon: Activity,      tint: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

const relTime = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 172800) return 'yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const dayKey = (iso) => {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

const PAGE = 20;

const HistoryDrawer = ({ open, onClose }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (offset = 0) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/misc?action=activity-log&limit=${PAGE}&offset=${offset}`);
      setTotal(data.total);
      setItems(prev => offset === 0 ? data.items : [...prev, ...data.items]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) load(0); }, [open, load]);

  const clearAll = async () => {
    if (!window.confirm('Clear the entire activity history? This cannot be undone.')) return;
    try {
      await api.delete('/misc?action=activity-log');
      toast.success('History cleared.');
      setItems([]); setTotal(0);
    } catch { toast.error('Could not clear history.'); }
  };

  // group consecutive items by day
  const groups = [];
  let lastKey = null;
  items.forEach(it => {
    const k = dayKey(it.created_at);
    if (k !== lastKey) { groups.push({ key: k, rows: [] }); lastKey = k; }
    groups[groups.length - 1].rows.push(it);
  });

  return (
    <>
      {/* Backdrop */}
      <div className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose} />

      {/* Panel */}
      <aside className={`fixed top-0 right-0 z-[61] h-full w-[min(420px,100vw)] bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800 flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[#7B1C1C]/10 text-[#7B1C1C] dark:bg-[#7B1C1C]/30 dark:text-red-300 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Activity History</h2>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">{total} record{total === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => load(0)} title="Refresh" className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={clearAll} title="Clear all" className="p-2 rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} title="Close" className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <Activity className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-400 dark:text-gray-500">No activity recorded yet.</p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Actions across the system will appear here.</p>
            </div>
          ) : (
            <div className="pb-4">
              {groups.map(group => (
                <div key={group.key}>
                  <p className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur px-5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                    {group.key}
                  </p>
                  {group.rows.map(it => {
                    const c = CATEGORY[it.category] || CATEGORY.system;
                    const Icon = c.Icon;
                    return (
                      <div key={it.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition border-b border-gray-50 dark:border-gray-800/60">
                        <span className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.tint}`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-snug">{it.title}</p>
                          {it.detail && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words">{it.detail}</p>}
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                            <span className="font-medium">{it.actor_name || 'System'}</span>
                            {it.actor_role && <span className="px-1.5 py-px rounded bg-gray-100 dark:bg-gray-800 capitalize">{it.actor_role}</span>}
                            <span>·</span>
                            <span>{relTime(it.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {items.length < total && (
                <div className="px-5 py-4">
                  <button onClick={() => load(items.length)} disabled={loading}
                    className="w-full py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-60">
                    {loading ? 'Loading…' : `Load more (${total - items.length} older)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default HistoryDrawer;
