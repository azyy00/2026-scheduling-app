import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const empty = {
  subject_id: '', instructor_id: '', classroom_id: '',
  section_id: '', day_of_week: 'Monday', time_start: '', time_end: '',
  semester: '1st', school_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
};

const ConflictBadge = ({ conflicts }) => {
  if (!conflicts || conflicts.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 mt-1">
      {conflicts.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 border border-red-300 rounded px-2 py-0.5">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {c}
        </span>
      ))}
    </div>
  );
};

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
    Promise.all([
      api.get('/subjects'),
      api.get('/instructors'),
      api.get('/classrooms'),
      api.get('/sections'),
    ]).then(([s, i, c, sec]) => {
      setOptions({ subjects: s.data, instructors: i.data, classrooms: c.data, sections: sec.data });
    });
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Schedules</h2>
        <button onClick={() => { setForm(empty); setEditId(null); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Add Schedule</button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Sections</option>
          {options.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterDay} onChange={e => setFilterDay(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All Days</option>
          {days.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {(filterSection || filterDay) && (
          <button onClick={() => { setFilterSection(''); setFilterDay(''); }} className="text-sm text-gray-500 hover:text-gray-700 underline">Clear</button>
        )}
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white border rounded-xl p-5 mb-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">Subject</label>
            <select required value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Select subject</option>
              {options.subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Instructor</label>
            <select required value={form.instructor_id} onChange={e => setForm({ ...form, instructor_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Select instructor</option>
              {options.instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Classroom</label>
            <select required value={form.classroom_id} onChange={e => setForm({ ...form, classroom_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Select room</option>
              {options.classrooms.map(c => <option key={c.id} value={c.id}>{c.room_code}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Section</label>
            <select required value={form.section_id} onChange={e => setForm({ ...form, section_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Select section</option>
              {options.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Day</label>
            <select value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Time Start</label>
            <input type="time" required value={form.time_start} onChange={e => setForm({ ...form, time_start: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Time End</label>
            <input type="time" required value={form.time_end} onChange={e => setForm({ ...form, time_end: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Semester</label>
            <select value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="1st">1st Semester</option>
              <option value="2nd">2nd Semester</option>
              <option value="Summer">Summer</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">School Year</label>
            <input value={form.school_year} onChange={e => setForm({ ...form, school_year: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. 2024-2025" />
          </div>
          <div className="col-span-2 md:col-span-3 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editId ? 'Update' : 'Add'}</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">Instructor</th>
              <th className="px-4 py-3 text-left">Room</th>
              <th className="px-4 py-3 text-left">Section</th>
              <th className="px-4 py-3 text-left">Day / Time</th>
              <th className="px-4 py-3 text-left">Conflicts</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className={`border-t ${s.conflicts?.length ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                <td className="px-4 py-3 font-medium">{s.subject_code}<br /><span className="text-xs text-gray-500 font-normal">{s.subject_name}</span></td>
                <td className="px-4 py-3 text-gray-600">{s.instructor_name}</td>
                <td className="px-4 py-3 text-gray-600">{s.room_code}</td>
                <td className="px-4 py-3 text-gray-600">{s.section_name}</td>
                <td className="px-4 py-3">
                  <span className="font-medium">{s.day_of_week}</span><br />
                  <span className="text-xs text-gray-500">{s.time_start} – {s.time_end}</span>
                </td>
                <td className="px-4 py-3">
                  {s.conflicts?.length > 0
                    ? <ConflictBadge conflicts={s.conflicts} />
                    : <span className="text-xs text-emerald-600 font-medium">✓ No conflict</span>
                  }
                </td>
                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                  <button onClick={() => startEdit(s)} className="text-blue-600 hover:underline text-xs">Edit</button>
                  <button onClick={() => remove(s.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No schedules found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Schedules;
