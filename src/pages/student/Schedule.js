import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, CalendarCheck2, Sun, MapPin, User, Pencil, CalendarRange, ListOrdered, Plus, Check, Search, Sparkles } from 'lucide-react';
import ScheduleCalendar from '../../components/common/ScheduleCalendar';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

// Per-program accent: a bold left stripe + a soft tinted background so cards stand out in both themes
const progAccent = (code = '') => {
  if (code.startsWith('BPED'))  return { bar: 'bg-pink-500',   bg: 'bg-pink-50 dark:bg-pink-500/10 hover:bg-pink-100 dark:hover:bg-pink-500/20' };
  if (code.startsWith('BECED')) return { bar: 'bg-amber-500',  bg: 'bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20' };
  if (code.startsWith('BCAED')) return { bar: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20' };
  return { bar: 'bg-[#7B1C1C]', bg: 'bg-[#7B1C1C]/5 dark:bg-[#7B1C1C]/20 hover:bg-[#7B1C1C]/10' };
};

const fmt = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

// One segment of the unified stat console
const StatSeg = ({ icon: Icon, label, value }) => (
  <div className="p-4 sm:p-5">
    <div className="flex items-start justify-between gap-2">
      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 leading-tight">{label}</p>
      <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#7B1C1C]/10 text-[#7B1C1C] dark:bg-[#7B1C1C]/30 dark:text-red-300 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </span>
    </div>
    <p className="text-2xl sm:text-[2rem] leading-none font-black tabular-nums mt-2 sm:mt-3 text-gray-900 dark:text-white">{value}</p>
  </div>
);

const Schedule = () => {
  const { user, refreshToken } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [sections, setSections] = useState([]);
  const [editForm, setEditForm] = useState({ year_level: '', section_id: '' });
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalog, setCatalog] = useState({ classes: [], picked: [] });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState('');
  const [busyId, setBusyId] = useState(null);

  const isIrregular = String(me?.status || '').toLowerCase().startsWith('irr');

  const loadSchedules = () => {
    setLoading(true);
    api.get('/misc?action=student-schedules').then(({ data }) => setSchedules(data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSchedules();
    api.get('/students?action=me').then(({ data }) => setMe(data)).catch(() => {});
  }, []);

  const openCatalog = async () => {
    setShowCatalog(true);
    setCatalogLoading(true);
    try { const { data } = await api.get('/misc?action=class-catalog'); setCatalog(data); }
    catch { setCatalog({ classes: [], picked: [] }); }
    finally { setCatalogLoading(false); }
  };

  const toggleClass = async (cls) => {
    const picked = catalog.picked.includes(cls.id);
    setBusyId(cls.id);
    try {
      if (picked) {
        await api.post('/students?action=drop-class', { schedule_id: cls.id });
        setCatalog(c => ({ ...c, picked: c.picked.filter(id => id !== cls.id) }));
      } else {
        await api.post('/students?action=enroll-class', { schedule_id: cls.id });
        setCatalog(c => ({ ...c, picked: [...c.picked, cls.id] }));
      }
      loadSchedules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update your schedule.', { duration: 5000 });
    } finally { setBusyId(null); }
  };

  const filteredCatalog = catalog.classes.filter(c => {
    if (!catalogFilter) return true;
    const q = catalogFilter.toLowerCase();
    return c.subject_code?.toLowerCase().includes(q) || c.subject_name?.toLowerCase().includes(q) || c.section_name?.toLowerCase().includes(q) || c.instructor_name?.toLowerCase().includes(q);
  });

  const openEdit = async () => {
    setEditForm({ year_level: user?.year_level ? String(user.year_level) : '', section_id: user?.section_id ? String(user.section_id) : '' });
    setShowEdit(true);
    if (sections.length === 0) {
      try { const { data } = await api.get('/auth?action=public-sections'); setSections(data); } catch {}
    }
  };

  const saveLevel = async (e) => {
    e.preventDefault();
    if (!editForm.year_level || !editForm.section_id) return toast.error('Select your year level and section.');
    setSaving(true);
    try {
      const { data } = await api.post('/students?action=update-self', editForm);
      refreshToken(data.token);
      toast.success(data.message);
      setShowEdit(false);
      loadSchedules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.');
    } finally { setSaving(false); }
  };

  const byDay = DAYS.reduce((acc, d) => {
    acc[d] = schedules.filter(s => s.day_of_week === d).sort((a, b) => a.time_start.localeCompare(b.time_start));
    return acc;
  }, {});

  const total = schedules.length;
  const activeDays = DAYS.filter(d => byDay[d].length > 0).length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-[#7B1C1C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-stretch gap-3">
          <span className="w-1.5 rounded-full bg-[#7B1C1C] shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">My Class Schedule</h1>
              {isIrregular && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  <Sparkles className="w-3 h-3" /> Irregular
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {user?.name}
              {user?.section_name && <><span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>{user.section_name}</>}
              {user?.year_level && <><span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>Year {user.year_level}</>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 self-start flex-wrap">
          {isIrregular && (
            <button onClick={openCatalog}
              className="inline-flex items-center gap-2 bg-[#7B1C1C] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#6a1717] transition shadow-sm">
              <Plus className="w-4 h-4" />
              Customize My Schedule
            </button>
          )}
          <button onClick={openEdit}
            className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            <Pencil className="w-4 h-4 text-gray-400" />
            Update Year / Section
          </button>
        </div>
      </div>

      {/* Update Year / Section Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowEdit(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Update Year & Section</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Moving up a year? Update it here to see your new schedule.</p>
            </div>
            <form onSubmit={saveLevel} className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Year Level</label>
                <select value={editForm.year_level}
                  onChange={e => setEditForm({ year_level: e.target.value, section_id: '' })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]">
                  <option value="">— Select —</option>
                  {[1,2,3,4].map(y => <option key={y} value={y}>{['1st','2nd','3rd','4th'][y-1]} Year</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Section</label>
                <select value={editForm.section_id} disabled={!editForm.year_level}
                  onChange={e => setEditForm({ ...editForm, section_id: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] disabled:opacity-50">
                  <option value="">{editForm.year_level ? '— Select —' : 'Pick year first'}</option>
                  {sections
                    .filter(s => !editForm.year_level || String(s.year_level) === String(editForm.year_level))
                    .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setShowEdit(false)}
                  className="flex-1 border border-gray-300 dark:border-gray-600 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-lg text-sm text-white font-semibold bg-[#7B1C1C] hover:bg-[#6a1717] disabled:opacity-60 transition">
                  {saving ? 'Saving...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customize (irregular) — class catalog modal */}
      {showCatalog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowCatalog(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Customize My Schedule</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Pick classes from any section. Time clashes with your picks are blocked. {catalog.picked.length} selected.</p>
              </div>
              <button onClick={() => setShowCatalog(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 pt-4">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={catalogFilter} onChange={e => setCatalogFilter(e.target.value)} placeholder="Search subject, section, or instructor…"
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]" />
              </div>
            </div>

            <div className="px-6 py-4 overflow-y-auto">
              {catalogLoading ? (
                <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[#7B1C1C] border-t-transparent rounded-full animate-spin" /></div>
              ) : filteredCatalog.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-12">{catalog.classes.length === 0 ? 'No classes available in the current term yet.' : 'No classes match your search.'}</p>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredCatalog.map(c => {
                    const picked = catalog.picked.includes(c.id);
                    return (
                      <div key={c.id} className={`flex items-center gap-3 px-3 py-2.5 ${picked ? 'bg-emerald-50/60 dark:bg-emerald-900/15' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-gray-900 dark:text-white">{c.subject_code}</span>
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{c.section_name}</span>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{c.subject_name}</p>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                            <span>{c.day_of_week?.slice(0,3)} {fmt(c.time_start)}–{fmt(c.time_end)}</span>
                            <span className="flex items-center gap-1 min-w-0"><User className="w-3 h-3 shrink-0" /><span className="truncate">{c.instructor_name}</span></span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.room_code}</span>
                          </div>
                        </div>
                        <button onClick={() => toggleClass(c)} disabled={busyId === c.id}
                          className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-60 ${picked ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                          {busyId === c.id ? <span className="w-3.5 h-3.5 border-2 border-current/40 border-t-current rounded-full animate-spin" /> : picked ? <><Check className="w-3.5 h-3.5" /> Added</> : <><Plus className="w-3.5 h-3.5" /> Add</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button onClick={() => setShowCatalog(false)} className="px-5 py-2.5 text-sm bg-[#7B1C1C] text-white rounded-lg font-semibold hover:bg-[#6a1717] transition">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Stat console */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden mb-6">
        <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800">
          <StatSeg icon={BookOpen} label="Total Classes" value={total} />
          <StatSeg icon={CalendarCheck2} label="Days w/ Classes" value={activeDays} />
          <StatSeg icon={Sun} label="Free Days" value={6 - activeDays} />
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-16 text-center shadow-sm">
          <p className="text-gray-400 dark:text-gray-500 text-sm">No classes scheduled yet.</p>
          {isIrregular && (
            <button onClick={openCatalog}
              className="mt-4 inline-flex items-center gap-2 bg-[#7B1C1C] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#6a1717] transition">
              <Plus className="w-4 h-4" /> Build your custom schedule
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Weekly calendar */}
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-gray-400" />
            Weekly Calendar
          </h2>
          <div className="mb-6">
            <ScheduleCalendar schedules={schedules} loading={false} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {DAYS.map(day => {
              const items = byDay[day];
              const empty = items.length === 0;
              const isToday = day === todayName;
              return (
                <div key={day}
                  className={`rounded-xl border bg-white dark:bg-gray-900 shadow-sm overflow-hidden transition
                    ${isToday ? 'border-[#7B1C1C]/40 ring-1 ring-[#7B1C1C]/20' : 'border-gray-200 dark:border-gray-800'}
                    ${empty ? 'opacity-75' : ''}`}>
                  {/* Header */}
                  <div className={`px-4 py-3 flex items-center justify-between border-b
                    ${isToday ? 'bg-[#7B1C1C] border-[#7B1C1C]' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${isToday ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>{day}</span>
                      {isToday && <span className="text-[10px] font-bold uppercase tracking-wide bg-white/25 text-white px-1.5 py-0.5 rounded">Today</span>}
                    </div>
                    {!empty && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isToday ? 'bg-white/20 text-white' : 'bg-[#7B1C1C]/10 text-[#7B1C1C] dark:bg-[#7B1C1C]/30 dark:text-red-300'}`}>
                        {items.length} class{items.length > 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>
                  {/* Body */}
                  {empty ? (
                    <div className="px-4 py-8 flex flex-col items-center justify-center text-center gap-1.5">
                      <Sun className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">No classes — free day</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {items.map(s => {
                        const a = progAccent(s.subject_code);
                        return (
                        <div key={s.id} className={`relative pl-5 pr-4 py-3.5 transition ${a.bg}`}>
                          <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${a.bar}`} />
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{s.subject_code}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{s.subject_name}</p>
                            </div>
                            <span className="shrink-0 text-[11px] font-bold text-[#7B1C1C] dark:text-red-300 bg-[#7B1C1C]/10 dark:bg-[#7B1C1C]/30 px-2 py-1 rounded-md whitespace-nowrap">
                              {fmt(s.time_start)} – {fmt(s.time_end)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                            <span className="flex items-center gap-1 shrink-0"><MapPin className="w-3.5 h-3.5" />{s.room_code}</span>
                            <span className="flex items-center gap-1 min-w-0"><User className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{s.instructor_name}</span></span>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Organized list view */}
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-gray-400" />
            Schedule List
          </h2>
          <div className="flex flex-col gap-3">
            {DAYS.filter(d => byDay[d].length > 0).map(day => (
              <div key={day} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <span className={`w-2.5 h-2.5 rounded-full ${day === todayName ? 'bg-[#7B1C1C]' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{day}</span>
                  {day === todayName && <span className="text-[10px] font-bold uppercase tracking-wide text-[#7B1C1C] dark:text-red-300">Today</span>}
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-medium">{byDay[day].length} class{byDay[day].length > 1 ? 'es' : ''}</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {byDay[day].map((s, idx) => (
                    <div key={s.id} className="flex items-center gap-3 sm:gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                      <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                      <div className="w-28 sm:w-32 shrink-0">
                        <span className="text-xs font-bold px-2 py-1 rounded-md bg-[#7B1C1C]/10 text-[#7B1C1C] dark:bg-[#7B1C1C]/30 dark:text-red-300 whitespace-nowrap">
                          {fmt(s.time_start)} – {fmt(s.time_end)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{s.subject_code}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.subject_name}</p>
                      </div>
                      <div className="items-center gap-1 text-xs text-gray-500 dark:text-gray-400 shrink-0 hidden sm:flex">
                        <User className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[120px]">{s.instructor_name}</span>
                      </div>
                      <div className="items-center gap-1 text-xs text-gray-500 dark:text-gray-400 shrink-0 hidden md:flex">
                        <MapPin className="w-3.5 h-3.5" />
                        {s.room_code}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Schedule;
