import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const empty = {
  subject_id: '', instructor_id: '', classroom_id: '',
  section_id: '', day_of_week: 'Monday', time_start: '', time_end: '',
  semester: '1st', school_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
};

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] transition';

const Schedules = () => {
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [options, setOptions] = useState({ subjects: [], instructors: [], classrooms: [], sections: [] });
  const [filterSection, setFilterSection] = useState('');
  const [filterDay, setFilterDay] = useState('');

  const load = () => api.get('/schedules').then(({ data }) => setSchedules(data));

  useEffect(() => {
    load();
    Promise.all([api.get('/subjects'), api.get('/instructors'), api.get('/classrooms'), api.get('/sections')])
      .then(([s, i, c, sec]) => setOptions({ subjects: s.data, instructors: i.data, classrooms: c.data, sections: sec.data }));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/schedules?id=${editId}`, form);
      else await api.post('/schedules', form);
      toast.success(editId ? 'Schedule updated' : 'Schedule added');
      setForm(empty); setEditId(null); setShowForm(false); load();
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {schedules.length} schedule{schedules.length !== 1 ? 's' : ''}
            {conflicts > 0 && <span className="ml-2 text-red-500 font-semibold">· {conflicts} conflict{conflicts > 1 ? 's' : ''}</span>}
          </p>
        </div>
        <button onClick={() => { setForm(empty); setEditId(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 bg-[#7B1C1C] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#6a1717] transition shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Schedule
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]">
          <option value="">All Sections</option>
          {options.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterDay} onChange={e => setFilterDay(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]">
          <option value="">All Days</option>
          {days.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {(filterSection || filterDay) && (
          <button onClick={() => { setFilterSection(''); setFilterDay(''); }}
            className="text-sm text-gray-400 hover:text-gray-600 underline">Clear filters</button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-4">{editId ? 'Edit Schedule' : 'Add New Schedule'}</h3>
          <form onSubmit={save} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Subject', key: 'subject_id', el: (
                <select required value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} className={inputCls}>
                  <option value="">Select subject</option>
                  {options.subjects.map(s => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
                </select>
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
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
                {el}
              </div>
            ))}
            <div className="col-span-2 md:col-span-3 flex gap-2 justify-end border-t border-gray-100 pt-4">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {['Subject','Instructor','Room','Section','Day / Time','Conflicts','Actions'].map((h, i) => (
                <th key={h} className={`px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider ${i === 6 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(s => (
              <tr key={s.id} className={`transition ${s.conflicts?.length ? 'bg-red-50 hover:bg-red-100/60' : 'hover:bg-gray-50'}`}>
                <td className="px-5 py-3.5">
                  <p className="font-bold text-gray-900">{s.subject_code}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.subject_name}</p>
                </td>
                <td className="px-5 py-3.5 text-gray-700">{s.instructor_name}</td>
                <td className="px-5 py-3.5">
                  <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">{s.room_code}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md">{s.section_name}</span>
                </td>
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-gray-800">{s.day_of_week}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.time_start} – {s.time_end}</p>
                </td>
                <td className="px-5 py-3.5">
                  {s.conflicts?.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {s.conflicts.map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 border border-red-200 rounded-md px-2 py-1">
                          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
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
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">Edit</button>
                    <button onClick={() => remove(s.id)}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400 text-sm">
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
