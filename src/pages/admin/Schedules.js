import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { notifyBus } from '../../utils/notificationBus';
import EventsSection from '../../components/common/EventsSection';
import SearchableSelect from '../../components/common/SearchableSelect';
import AiGenerateModal from '../../components/common/AiGenerateModal';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const empty = {
  subject_id: '', instructor_id: '', classroom_id: '',
  section_id: '', day_of_week: 'Monday', time_start: '', time_end: '',
  semester: '1st', school_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
};
const emptyEvent = { title: '', event_date: '', description: '' };

const inputCls = 'w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 transition';

const fmtDate = (d) => {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};



const Schedules = () => {
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [options, setOptions] = useState({ subjects: [], instructors: [], classrooms: [], sections: [] });
  const [filterSection, setFilterSection] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [term, setTerm] = useState(null);
  const [viewYear, setViewYear] = useState('');
  const [viewSem, setViewSem] = useState('');

  // Events state
  const [events, setEvents] = useState([]);
  const [showEvents, setShowEvents] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [editEventId, setEditEventId] = useState(null);

  // AI generator
  const [showAI, setShowAI] = useState(false);

  const load = (yr = viewYear, sem = viewSem) => {
    const params = [];
    if (yr) params.push(`school_year=${encodeURIComponent(yr)}`);
    if (sem) params.push(`semester=${encodeURIComponent(sem)}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return api.get(`/schedules${qs}`).then(({ data }) => setSchedules(data));
  };

  const loadEvents = () => api.get('/events').then(({ data }) => setEvents(data)).catch(() => {});

  useEffect(() => {
    loadEvents();
    Promise.all([
      api.get('/subjects'), api.get('/instructors'), api.get('/classrooms'), api.get('/sections'),
      api.get('/term?action=get'),
    ]).then(([s, i, c, sec, t]) => {
      setOptions({ subjects: s.data, instructors: i.data, classrooms: c.data, sections: sec.data });
      setTerm(t.data);
      const yr = t.data.active_school_year || '';
      const sem = t.data.active_semester || '';
      setViewYear(yr); setViewSem(sem);
      // Default the create form to the active term
      setForm(f => ({ ...f, school_year: yr || f.school_year, semester: sem || f.semester }));
      load(yr, sem);
    }).catch(() => load());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveEvent = async (e) => {
    e.preventDefault();
    try {
      if (editEventId) await api.put(`/events?id=${editEventId}`, eventForm);
      else await api.post('/events', eventForm);
      toast.success(editEventId ? 'Event updated' : 'Event added');
      if (!editEventId) notifyBus.push({ type: 'info', title: `Event Added: ${eventForm.title}`, body: fmtDate(eventForm.event_date) });
      setEventForm(emptyEvent); setEditEventId(null); setShowEventForm(false); loadEvents();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving event'); }
  };

  const removeEvent = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    await api.delete(`/events?id=${id}`); toast.success('Event deleted'); loadEvents();
  };

  const startEditEvent = (ev) => {
    setEventForm({ title: ev.title, event_date: ev.event_date?.slice(0, 10), description: ev.description || '' });
    setEditEventId(ev.id); setShowEventForm(true);
  };

  const upcomingEvents = events.filter(ev => {
    const diff = Math.ceil((new Date(ev.event_date + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 86400000);
    return diff >= 0 && diff <= 7;
  });

  const blankForm = () => ({ ...empty, school_year: viewYear || empty.school_year, semester: viewSem || empty.semester });

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/schedules?id=${editId}`, form);
      else await api.post('/schedules', form);
      toast.success(editId ? 'Schedule updated' : 'Schedule added');
      setForm(blankForm()); setEditId(null); setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    await api.delete(`/schedules?id=${id}`); toast.success('Deleted'); load();
  };

  const startEdit = (s) => {
    setForm({
      subject_id: String(s.subject_id), instructor_id: String(s.instructor_id),
      classroom_id: String(s.classroom_id), section_id: String(s.section_id),
      day_of_week: s.day_of_week, time_start: s.time_start, time_end: s.time_end,
      semester: s.semester, school_year: s.school_year,
    });
    setEditId(s.id); setShowForm(true);
  };

  const filtered = schedules.filter(s =>
    (!filterSection || String(s.section_id) === filterSection) &&
    (!filterDay || s.day_of_week === filterDay)
  );

  const conflicts = schedules.filter(s => s.conflicts?.length > 0).length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Schedules</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {schedules.length} schedule{schedules.length !== 1 ? 's' : ''}
            {conflicts > 0 && <span className="ml-2 text-red-500 font-semibold">· {conflicts} conflict{conflicts > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setEventForm(emptyEvent); setEditEventId(null); setShowEventForm(true); setShowEvents(true); }}
            className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Add Event
          </button>
          <button onClick={() => setShowAI(true)}
            className="inline-flex items-center gap-2 border border-[#7B1C1C]/30 text-[#7B1C1C] dark:text-red-300 dark:border-red-900/50 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#7B1C1C]/5 dark:hover:bg-[#7B1C1C]/20 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            AI Generate
          </button>
          <button onClick={() => { setForm(blankForm()); setEditId(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 bg-[#7B1C1C] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#6a1717] transition shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Schedule
          </button>
        </div>
      </div>

      {/* AI Generate Modal */}
      <AiGenerateModal
        open={showAI}
        onClose={() => setShowAI(false)}
        sections={options.sections}
        subjects={options.subjects}
        schoolYear={viewYear || term?.active_school_year}
        semester={viewSem || term?.active_semester}
        onApplied={load}
      />

      {/* Events Panel */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm mb-6 overflow-hidden">
        <button onClick={() => setShowEvents(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Events</span>
            {upcomingEvents.length > 0 && (
              <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                {upcomingEvents.length} upcoming
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">{events.length} total</span>
          </div>
          <svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${showEvents ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showEvents && (
          <div className="border-t border-gray-100 dark:border-gray-800">
            {/* Add/Edit event form */}
            {showEventForm && (
              <form onSubmit={saveEvent} className="px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-3">{editEventId ? 'Edit Event' : 'New Event'}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Title</label>
                    <input required value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                      placeholder="e.g. Foundation Day" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Date</label>
                    <input type="date" required value={eventForm.event_date} onChange={e => setEventForm({ ...eventForm, event_date: e.target.value })}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Description <span className="text-gray-400 dark:text-gray-500">(optional)</span></label>
                    <input value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                      placeholder="Short description..." className={inputCls} />
                  </div>
                </div>
                <div className="flex gap-2 mt-3 justify-end">
                  <button type="button" onClick={() => { setShowEventForm(false); setEditEventId(null); setEventForm(emptyEvent); }}
                    className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition">Cancel</button>
                  <button type="submit"
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">
                    {editEventId ? 'Update Event' : 'Save Event'}
                  </button>
                </div>
              </form>
            )}

            {/* Events list — legendary cards */}
            <div className="p-4">
              {events.length === 0 ? (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">No events yet. Click "Add Event" to create one.</p>
              ) : (
                <>
                  <EventsSection events={events} title="All Events" emptyMessage="No events yet." />
                  {/* Edit/Delete controls below cards */}
                  <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                    {events.map(ev => (
                      <div key={ev.id} className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate flex-1">{ev.title}</p>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => startEditEvent(ev)} className="text-xs text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition font-semibold">Edit</button>
                          <button onClick={() => removeEvent(ev.id)} className="text-xs text-red-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition font-semibold">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        {/* Academic term (history browsing) */}
        <div className="flex items-center gap-2 pr-3 mr-1 border-r border-gray-200 dark:border-gray-800">
          <select value={viewYear}
            onChange={e => { setViewYear(e.target.value); load(e.target.value, viewSem); }}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500">
            <option value="all">All Years</option>
            {(term?.years || []).map(y => (
              <option key={y} value={y}>{y}{term?.active_school_year === y ? ' (active)' : ''}</option>
            ))}
          </select>
          <select value={viewSem}
            onChange={e => { setViewSem(e.target.value); load(viewYear, e.target.value); }}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500">
            <option value="">All Sem</option>
            <option value="1st">1st Sem</option>
            <option value="2nd">2nd Sem</option>
          </select>
        </div>
        <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500">
          <option value="">All Sections</option>
          {options.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterDay} onChange={e => setFilterDay(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500">
          <option value="">All Days</option>
          {days.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {(filterSection || filterDay) && (
          <button onClick={() => { setFilterSection(''); setFilterDay(''); }}
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-600 underline">Clear filters</button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">{editId ? 'Edit Schedule' : 'Add New Schedule'}</h3>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Subject', key: 'subject_id', el: (
                <SearchableSelect
                  required
                  value={form.subject_id}
                  onChange={val => setForm({ ...form, subject_id: val })}
                  options={options.subjects.map(s => ({ value: s.id, label: `${s.code} – ${s.name}` }))}
                  placeholder="Select subject"
                  className={inputCls}
                />
              )},
              { label: 'Instructor', key: 'instructor_id', el: (
                <select required value={form.instructor_id} onChange={e => setForm({ ...form, instructor_id: e.target.value })} className={inputCls}>
                  <option value="">Select instructor</option>
                  {options.instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              )},
              { label: 'Classroom', key: 'classroom_id', el: (
                <select required value={form.classroom_id} onChange={e => setForm({ ...form, classroom_id: e.target.value })} className={inputCls}>
                  <option value="">Select room</option>
                  {options.classrooms.map(c => <option key={c.id} value={c.id}>{c.room_code}</option>)}
                </select>
              )},
              { label: 'Section', key: 'section_id', el: (
                <select required value={form.section_id} onChange={e => setForm({ ...form, section_id: e.target.value })} className={inputCls}>
                  <option value="">Select section</option>
                  {options.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )},
              { label: 'Day', key: 'day_of_week', el: (
                <select value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: e.target.value })} className={inputCls}>
                  {days.map(d => <option key={d}>{d}</option>)}
                </select>
              )},
              { label: 'Time Start', key: 'time_start', el: (
                <input type="time" required value={form.time_start} onChange={e => setForm({ ...form, time_start: e.target.value })} className={inputCls} />
              )},
              { label: 'Time End', key: 'time_end', el: (
                <input type="time" required value={form.time_end} onChange={e => setForm({ ...form, time_end: e.target.value })} className={inputCls} />
              )},
              { label: 'Semester', key: 'semester', el: (
                <select value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} className={inputCls}>
                  <option value="1st">1st Semester</option>
                  <option value="2nd">2nd Semester</option>
                  <option value="Summer">Summer</option>
                </select>
              )},
              { label: 'School Year', key: 'school_year', el: (
                <input value={form.school_year} onChange={e => setForm({ ...form, school_year: e.target.value })} className={inputCls} placeholder="e.g. 2024-2025" />
              )},
            ].map(({ label, key, el }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
                {el}
              </div>
            ))}
            <div className="col-span-1 sm:col-span-2 md:col-span-3 flex gap-2 justify-end border-t border-gray-100 dark:border-gray-800 pt-4">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                Cancel
              </button>
              <button type="submit"
                className="px-5 py-2.5 text-sm bg-[#7B1C1C] text-white rounded-lg font-semibold hover:bg-[#6a1717] transition">
                {editId ? 'Update Schedule' : 'Add Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              {['Subject','Instructor','Room','Section','Day / Time','Conflicts','Actions'].map((h, i) => (
                <th key={h} className={`px-5 py-3.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${i === 6 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map(s => (
              <tr key={s.id} className={`transition ${s.conflicts?.length ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100/60' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                <td className="px-5 py-3.5">
                  <p className="font-bold text-gray-900 dark:text-white">{s.subject_code}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.subject_name}</p>
                </td>
                <td className="px-5 py-3.5 text-gray-700 dark:text-gray-200">{s.instructor_name}</td>
                <td className="px-5 py-3.5">
                  <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">{s.room_code}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 px-2.5 py-1 rounded-md">{s.section_name}</span>
                </td>
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{s.day_of_week}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.time_start} – {s.time_end}</p>
                </td>
                <td className="px-5 py-3.5">
                  {s.conflicts?.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {s.conflicts.map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 border border-red-200 dark:border-red-900/40 rounded-md px-2 py-1">
                          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-md">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      No conflict
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => startEdit(s)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">Edit</button>
                    <button onClick={() => remove(s.id)}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                {schedules.length === 0 ? 'No schedules yet' : 'No schedules match the selected filters'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Schedules;
