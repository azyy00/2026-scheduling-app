import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import ScheduleCalendar from '../../components/common/ScheduleCalendar';
import SearchableSelect from '../../components/common/SearchableSelect';
import { Eye, Pencil } from 'lucide-react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const PROGRAMS = ['BPED','BECED','BCAED'];

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const fmtDateTime = (value) => {
  if (!value) return 'Unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const conflictTypeLabel = (detail) => {
  const types = detail?.types?.length ? detail.types : ['Schedule'];
  return `${types.join(' + ')} conflict`;
};

const scheduleLine = (s) => {
  if (!s) return '';
  return `${s.day_of_week || ''} ${fmtTime(s.time_start)}-${fmtTime(s.time_end)}`.trim();
};

const ConflictClassCard = ({ title, schedule, emphasis, onEditSchedule }) => {
  if (!schedule) return null;
  return (
    <div className={`rounded-xl border p-4 ${emphasis === 'first' ? 'border-emerald-200 bg-emerald-50/70' : 'border-red-200 bg-red-50/70'}`}>
      <p className={`text-[11px] font-black uppercase tracking-wider ${emphasis === 'first' ? 'text-emerald-700' : 'text-red-700'}`}>{title}</p>
      <div className="mt-2">
        <p className="text-base font-black text-gray-900">{schedule.subject_code || 'Subject'}</p>
        {schedule.subject_name && <p className="text-xs text-gray-500 mt-0.5">{schedule.subject_name}</p>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="font-bold text-gray-400 uppercase tracking-wide">Section</p>
          <p className="font-semibold text-gray-800">{schedule.section_name || 'Unknown'}</p>
        </div>
        <div>
          <p className="font-bold text-gray-400 uppercase tracking-wide">Room</p>
          <p className="font-semibold text-gray-800">{schedule.room_code || 'Unknown'}</p>
        </div>
        <div className="col-span-2">
          <p className="font-bold text-gray-400 uppercase tracking-wide">Instructor</p>
          <p className="font-semibold text-gray-800">{schedule.instructor_name || 'Unknown'}</p>
        </div>
        <div className="col-span-2">
          <p className="font-bold text-gray-400 uppercase tracking-wide">Schedule</p>
          <p className="font-semibold text-gray-800">{scheduleLine(schedule)}</p>
        </div>
        <div className="col-span-2">
          <p className="font-bold text-gray-400 uppercase tracking-wide">Created</p>
          <p className="font-semibold text-gray-800">{fmtDateTime(schedule.created_at)}</p>
        </div>
      </div>
      {onEditSchedule && schedule.id && (
        <button
          type="button"
          onClick={() => onEditSchedule(schedule)}
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black text-white shadow-sm transition focus:outline-none focus:ring-2 ${
            emphasis === 'first'
              ? 'bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-200'
              : 'bg-[#7B1C1C] hover:bg-[#6a1717] focus:ring-red-200'
          }`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit schedule
        </button>
      )}
    </div>
  );
};

const ConflictDetailModal = ({ detail, onClose, onEditSchedule }) => {
  if (!detail) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600">Conflict details</p>
            <h3 className="text-lg font-black text-gray-900 mt-1">{conflictTypeLabel(detail)}</h3>
            {detail.labels?.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">{detail.labels.join(' | ')}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close conflict details"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-5">
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-800">
              The first-created schedule is the older record. The later-created schedule is the newer record to review or adjust.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ConflictClassCard title="First created schedule" schedule={detail.first_created} emphasis="first" onEditSchedule={onEditSchedule} />
            <ConflictClassCard title="Later created schedule" schedule={detail.later_created} emphasis="later" onEditSchedule={onEditSchedule} />
          </div>
        </div>
      </div>
    </div>
  );
};


const STAT_ICONS = {
  schedules: (
    <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  classrooms: (
    <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  instructors: (
    <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  conflicts: (
    <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

// Per-card accent colors (icon + badge) for the stat cards.
const STAT_ACCENTS = {
  schedules:   { icon: 'text-[#7B1C1C] dark:text-red-300',        badge: 'bg-[#7B1C1C]/10 text-[#7B1C1C] dark:bg-[#7B1C1C]/25 dark:text-red-300' },
  classrooms:  { icon: 'text-blue-600 dark:text-blue-400',        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
  instructors: { icon: 'text-emerald-600 dark:text-emerald-400',  badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
};

// Active-term label used as the card footer (the equivalent of the reference's date range).
const fmtTerm = (term) =>
  (term ? `${term.active_school_year || ''}${term.active_semester ? ` · ${term.active_semester} Sem` : ''}`.trim() : '') || '—';

// A single dashboard stat card: colored icon + status badge, big value, term footer.
const StatCard = ({ label, value, iconKey, badgeText, footer, tone = 'info', actionLabel, onAction }) => {
  const isConflict = tone === 'conflict';
  const alert = isConflict && value > 0;
  const accent = STAT_ACCENTS[iconKey] || STAT_ACCENTS.schedules;

  const iconColor = isConflict
    ? (alert ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')
    : accent.icon;
  const badgeCls = isConflict
    ? (alert ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400')
    : accent.badge;
  const numCls = alert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white';

  return (
    <div className={`flex flex-col h-full rounded-xl border bg-white dark:bg-gray-900 shadow-sm p-5 transition-shadow hover:shadow-md ${alert ? 'border-red-200 dark:border-red-900/50' : 'border-gray-200 dark:border-gray-800'}`}>
      {/* Text top-left · big centered icon on the right */}
      <div className="flex-1 flex items-center justify-between gap-4">
        <div className="min-w-0 self-start">
          <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</div>
          <div className={`text-4xl font-bold tabular-nums ${numCls}`}>{value ?? '—'}</div>
        </div>
        <span className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 ${badgeCls}`}>
          <span className={iconColor}>{STAT_ICONS[iconKey]}</span>
        </span>
      </div>

      {/* Footer: term / action on the left, status badge on the right */}
      <div className="pt-3 mt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
        {isConflict && alert && actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300 hover:underline focus:outline-none"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {actionLabel}
          </button>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium truncate">{footer}</span>
        )}
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold shrink-0 ${badgeCls}`}>
          {isConflict ? (
            alert
              ? <><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Needs review</>
              : <><CheckIcon /> All clear</>
          ) : (
            <><span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" /> {badgeText}</>
          )}
        </span>
      </div>
    </div>
  );
};

const emptyInstructor = { name: '', department: 'BPED', username: '', password: '' };
const emptyRoom = { room_code: '', capacity: '', usePreset: true };
const emptySchedule = { subject_id: '', instructor_id: '', classroom_id: '', section_id: '', day_of_week: 'Monday', time_start: '07:30', time_end: '08:30', semester: '1st', school_year: '' };

const defaultSchoolYear = () => {
  const year = new Date().getFullYear();
  return `${year}-${year + 1}`;
};

const timeInputValue = (value) => (value || '').slice(0, 5);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [options, setOptions] = useState({ subjects: [], instructors: [], classrooms: [], sections: [] });
  const [filterProgram, setFilterProgram] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [modal, setModal] = useState(null);
  const [instForm, setInstForm] = useState(emptyInstructor);
  const [roomForm, setRoomForm] = useState(emptyRoom);
  const [schedForm, setSchedForm] = useState(emptySchedule);
  const [saving, setSaving] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [term, setTerm] = useState(null);

  const load = () => {
    api.get('/misc?action=dashboard-stats').then(({ data }) => setStats(data)).catch(() => {});
    api.get('/schedules').then(({ data }) => setSchedules(data)).catch(() => {});
    Promise.all([
      api.get('/subjects'), api.get('/instructors'),
      api.get('/classrooms'), api.get('/sections'), api.get('/term?action=get'),
    ]).then(([s, i, c, sec, t]) => {
      setOptions({ subjects: s.data, instructors: i.data, classrooms: c.data, sections: sec.data });
      setTerm(t.data);
      setSchedForm(form => ({
        ...form,
        school_year: form.school_year || t.data.active_school_year || form.school_year,
        semester: form.semester || t.data.active_semester || form.semester,
      }));
    }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  // Year prefix map: "1" → section names containing "-1" (e.g. BPED-1A, BECED-1B)
  const filteredSections = options.sections.filter(s => {
    if (filterProgram && !s.name?.startsWith(filterProgram)) return false;
    if (filterYear && !s.name?.includes(`-${filterYear}`)) return false;
    return true;
  });

  const filteredSchedules = schedules.filter(s => {
    if (filterSection && String(s.section_id) !== filterSection) return false;
    if (filterProgram && !s.section_name?.startsWith(filterProgram)) return false;
    if (filterYear && !s.section_name?.includes(`-${filterYear}`)) return false;
    return true;
  });

  const blankScheduleForm = (overrides = {}) => ({
    ...emptySchedule,
    semester: term?.active_semester || emptySchedule.semester,
    school_year: term?.active_school_year || defaultSchoolYear(),
    ...overrides,
  });

  const scheduleToForm = (schedule) => ({
    subject_id: String(schedule.subject_id || ''),
    instructor_id: String(schedule.instructor_id || ''),
    classroom_id: String(schedule.classroom_id || ''),
    section_id: String(schedule.section_id || ''),
    day_of_week: schedule.day_of_week || emptySchedule.day_of_week,
    time_start: timeInputValue(schedule.time_start) || emptySchedule.time_start,
    time_end: timeInputValue(schedule.time_end) || emptySchedule.time_end,
    semester: schedule.semester || term?.active_semester || emptySchedule.semester,
    school_year: schedule.school_year || term?.active_school_year || defaultSchoolYear(),
  });

  const openCreateSchedule = (slot = {}) => {
    setEditingScheduleId(null);
    setSchedForm(blankScheduleForm(slot));
    setModal('schedule');
  };

  const openEditSchedule = (schedule) => {
    if (!schedule?.id || !schedule.subject_id || !schedule.instructor_id || !schedule.classroom_id || !schedule.section_id) {
      toast.error('Schedule details are still loading. Please try again.');
      return;
    }
    setSelectedConflict(null);
    setEditingScheduleId(schedule.id);
    setSchedForm(scheduleToForm(schedule));
    setModal('schedule');
  };

  const openConflictSchedule = () => {
    const conflictSchedule = schedules.find(s => s.conflicts?.length > 0);
    const firstDetail = conflictSchedule?.conflict_details?.[0];

    if (firstDetail) {
      setSelectedConflict(firstDetail);
      return;
    }

    if (conflictSchedule) {
      setSelectedConflict({
        labels: conflictSchedule.conflicts,
        types: ['Schedule'],
        first_created: conflictSchedule,
        later_created: null,
      });
      return;
    }

    toast.error('Conflict schedules are still loading.');
  };

  const saveInstructor = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/instructors', instForm);
      toast.success('Instructor added'); setModal(null); setInstForm(emptyInstructor); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); } finally { setSaving(false); }
  };

  const saveRoom = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/classrooms', { room_code: roomForm.room_code, capacity: roomForm.capacity });
      toast.success('Room added'); setModal(null); setRoomForm(emptyRoom); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); } finally { setSaving(false); }
  };

  const saveSchedule = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editingScheduleId) await api.put(`/schedules?id=${editingScheduleId}`, schedForm);
      else await api.post('/schedules', schedForm);
      toast.success(editingScheduleId ? 'Schedule updated' : 'Schedule added');
      setModal(null); setEditingScheduleId(null); setSchedForm(blankScheduleForm()); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); } finally { setSaving(false); }
  };

  // Delete directly from a calendar card (confirmation handled in the calendar modal)
  const deleteSchedule = async (s) => {
    if (!s?.id) return;
    try {
      await api.delete(`/schedules?id=${s.id}`);
      toast.success('Schedule deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not delete.'); }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-stretch gap-3">
          <span className="w-1.5 rounded-full bg-[#7B1C1C] shrink-0" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7B1C1C] dark:text-red-300">Academic Overview</p>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Goa Community College · Goa, Camarines Sur</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setModal('instructor')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Instructor
          </button>
          <button onClick={() => setModal('room')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Room
          </button>
          <button onClick={() => openCreateSchedule()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#6a1717]" style={{background:'#7B1C1C'}}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Add Schedule
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Schedules"   value={stats?.schedules}   iconKey="schedules"   badgeText="This term"  footer={fmtTerm(term)} />
        <StatCard label="Classrooms"  value={stats?.classrooms}  iconKey="classrooms"  badgeText="Available"  footer={fmtTerm(term)} />
        <StatCard label="Instructors" value={stats?.instructors} iconKey="instructors" badgeText="Registered" footer={fmtTerm(term)} />
        <StatCard label="Conflicts"   value={stats?.conflicts}   iconKey="conflicts"   tone="conflict" actionLabel="View conflict sched" onAction={openConflictSchedule} footer={fmtTerm(term)} />
      </div>

      {/* Filters + Legend */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex gap-2 flex-wrap">
          <select value={filterProgram} onChange={e => { setFilterProgram(e.target.value); setFilterSection(''); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/20 focus:border-[#7B1C1C]">
            <option value="">All Programs</option>
            {PROGRAMS.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterSection(''); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/20 focus:border-[#7B1C1C]">
            <option value="">All Year Levels</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/20 focus:border-[#7B1C1C]">
            <option value="">All Sections</option>
            {filteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex gap-4 items-center">
          {[['bg-pink-500','BPED'],['bg-yellow-400','BECED'],['bg-orange-500','BCAED'],['bg-red-500','Conflict']].map(([c,l]) => (
            <span key={l} className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <span className={`w-2.5 h-2.5 rounded-sm ${c} shrink-0`} />{l}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <ScheduleCalendar
        schedules={filteredSchedules}
        onCreateSchedule={openCreateSchedule}
        onEditSchedule={openEditSchedule}
        onDeleteSchedule={deleteSchedule}
      />

      {/* Schedule List View */}
      {filteredSchedules.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Schedule List
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_110px_90px_90px_130px] gap-0 bg-gray-50 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <span>Subject</span>
              <span>Instructor</span>
              <span>Section</span>
              <span>Room</span>
              <span>Day</span>
              <span>Time / Conflict</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {[...filteredSchedules]
                .sort((a, b) => DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week) || a.time_start.localeCompare(b.time_start))
                .map(s => {
                  const isConflict = s.conflicts?.length > 0;
                  const conflictDetails = s.conflict_details || [];
                  return (
                    <div key={s.id} className={`grid grid-cols-[1fr_1fr_110px_90px_90px_130px] gap-0 px-4 py-3 text-sm items-start transition ${isConflict ? 'bg-red-50 dark:bg-red-950/25' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{s.subject_code}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.subject_name}</p>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 truncate pr-2 pt-0.5">{s.instructor_name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 pt-0.5">{s.section_name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 pt-0.5">{s.room_code}</p>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          s.day_of_week === 'Monday'    ? 'bg-blue-400' :
                          s.day_of_week === 'Tuesday'   ? 'bg-indigo-400' :
                          s.day_of_week === 'Wednesday' ? 'bg-violet-400' :
                          s.day_of_week === 'Thursday'  ? 'bg-emerald-400' :
                          s.day_of_week === 'Friday'    ? 'bg-amber-400' : 'bg-rose-400'
                        }`} />
                        <p className="text-xs text-gray-600 dark:text-gray-300">{s.day_of_week?.slice(0,3)}</p>
                      </div>
                      <div>
                        {isConflict ? (
                          <div>
                            {conflictDetails.length > 0 ? (
                              <div className="mb-1 flex flex-col gap-1">
                                {conflictDetails.map((detail, i) => (
                                  <button
                                    key={`${detail.other_schedule_id || i}-${detail.types?.join('-') || 'conflict'}`}
                                    type="button"
                                    onClick={() => setSelectedConflict(detail)}
                                    className="text-left text-[10px] font-bold text-red-700 dark:text-red-300 underline decoration-red-300 dark:decoration-red-500/60 underline-offset-2 hover:text-red-900 dark:hover:text-red-200"
                                  >
                                    View {conflictTypeLabel(detail)}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSelectedConflict({
                                  labels: s.conflicts,
                                  types: ['Schedule'],
                                  first_created: s,
                                  later_created: null,
                                })}
                                className="mb-1 block text-left text-[10px] font-bold text-red-700 dark:text-red-300 underline decoration-red-300 dark:decoration-red-500/60 underline-offset-2 hover:text-red-900 dark:hover:text-red-200"
                              >
                                View conflict details
                              </button>
                            )}
                            <span className="text-xs font-semibold text-[#7B1C1C] dark:text-red-200 bg-red-50 dark:bg-red-900/50 px-2 py-0.5 rounded-md whitespace-nowrap block mb-1">{fmtTime(s.time_start)}–{fmtTime(s.time_end)}</span>
                            {s.conflicts.some(c => c.startsWith('Room')) && <span className="text-[10px] font-bold text-red-600 dark:text-red-300 block">⚠ Room conflict</span>}
                            {s.conflicts.some(c => c.startsWith('Instructor')) && <span className="text-[10px] font-bold text-orange-600 dark:text-orange-300 block">⚠ Instructor conflict</span>}
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-[#7B1C1C] dark:text-red-200 bg-red-50 dark:bg-red-900/40 px-2 py-0.5 rounded-md whitespace-nowrap">{fmtTime(s.time_start)}–{fmtTime(s.time_end)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <ConflictDetailModal detail={selectedConflict} onClose={() => setSelectedConflict(null)} onEditSchedule={openEditSchedule} />

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          {/* Add Instructor */}
          {modal === 'instructor' && (
            <form onSubmit={saveInstructor} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <h3 className="text-base font-bold text-gray-800 mb-4">Add Instructor</h3>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Full Name</label>
                  <input required value={instForm.name} onChange={e => setInstForm({ ...instForm, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. Juan dela Cruz" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Department / Program</label>
                  <select value={instForm.department} onChange={e => setInstForm({ ...instForm, department: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    {PROGRAMS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Username</label>
                    <input required value={instForm.username} onChange={e => setInstForm({ ...instForm, username: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Password</label>
                    <input required type="password" value={instForm.password} onChange={e => setInstForm({ ...instForm, password: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-5">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save Instructor'}</button>
              </div>
            </form>
          )}

          {/* Add Room */}
          {modal === 'room' && (
            <form onSubmit={saveRoom} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <h3 className="text-base font-bold text-gray-800 mb-4">Add Room</h3>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Room Code</label>
                  <select value={roomForm.usePreset ? roomForm.room_code : '__custom'} onChange={e => {
                    if (e.target.value === '__custom') setRoomForm({ ...roomForm, usePreset: false, room_code: '' });
                    else setRoomForm({ ...roomForm, usePreset: true, room_code: e.target.value });
                  }} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    <option value="">— Select preset —</option>
                    <optgroup label="Main Rooms">{['Rm 1','Rm 2','Rm 3','Rm 4','Rm 5','Rm 6','Rm 7','Rm 8'].map(r => <option key={r}>{r}</option>)}</optgroup>
                    <optgroup label="Sub Rooms">{['Rm 1A','Rm 1B','Rm 1C','Rm 1D'].map(r => <option key={r}>{r}</option>)}</optgroup>
                    <optgroup label="Facilities"><option value="SPORT">SPORT</option></optgroup>
                    <option value="__custom">+ Custom room code</option>
                  </select>
                  {!roomForm.usePreset && (
                    <input value={roomForm.room_code} onChange={e => setRoomForm({ ...roomForm, room_code: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-2" placeholder="e.g. LAB-1" />
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Capacity</label>
                  <input type="number" value={roomForm.capacity} onChange={e => setRoomForm({ ...roomForm, capacity: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="40" />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-5">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving || !roomForm.room_code} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save Room'}</button>
              </div>
            </form>
          )}

          {/* Add Schedule */}
          {modal === 'schedule' && (
            <form onSubmit={saveSchedule} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-base font-bold text-gray-800 mb-4">{editingScheduleId ? 'Edit Schedule' : 'Add Schedule'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 font-medium">Subject</label>
                  <div className="mt-1">
                    <SearchableSelect
                      required
                      value={schedForm.subject_id}
                      onChange={val => setSchedForm({ ...schedForm, subject_id: val })}
                      options={options.subjects.map(s => ({ value: s.id, label: `${s.code} – ${s.name}` }))}
                      placeholder="Select subject"
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Instructor</label>
                  <select required value={schedForm.instructor_id} onChange={e => setSchedForm({ ...schedForm, instructor_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    <option value="">Select instructor</option>
                    {options.instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Room</label>
                  <select required value={schedForm.classroom_id} onChange={e => setSchedForm({ ...schedForm, classroom_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    <option value="">Select room</option>
                    {options.classrooms.map(c => <option key={c.id} value={c.id}>{c.room_code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Section</label>
                  <select required value={schedForm.section_id} onChange={e => setSchedForm({ ...schedForm, section_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    <option value="">Select section</option>
                    {options.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Day</label>
                  <select value={schedForm.day_of_week} onChange={e => setSchedForm({ ...schedForm, day_of_week: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    {DAYS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Time Start</label>
                  <input type="time" required value={schedForm.time_start} onChange={e => setSchedForm({ ...schedForm, time_start: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Time End</label>
                  <input type="time" required value={schedForm.time_end} onChange={e => setSchedForm({ ...schedForm, time_end: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Semester</label>
                  <select value={schedForm.semester} onChange={e => setSchedForm({ ...schedForm, semester: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    <option value="1st">1st Semester</option>
                    <option value="2nd">2nd Semester</option>
                    <option value="Summer">Summer</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">School Year</label>
                  <input value={schedForm.school_year} onChange={e => setSchedForm({ ...schedForm, school_year: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="2024-2025" />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-5">
                <button type="button" onClick={() => { setModal(null); setEditingScheduleId(null); setSchedForm(blankScheduleForm()); }} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60 hover:opacity-90" style={{background:'#7B1C1C'}}>{saving ? 'Saving...' : editingScheduleId ? 'Update Schedule' : 'Save Schedule'}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
