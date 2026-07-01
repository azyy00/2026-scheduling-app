import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import ScheduleCalendar from '../../components/common/ScheduleCalendar';
import { InstructorCardSkeleton, CalendarSkeleton } from '../../components/common/Skeleton';
import { Plus, X, Trash2 } from 'lucide-react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const defaultSchoolYear = () => `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
const timeInputValue = (t) => (t ? String(t).slice(0, 5) : '');

const progBadge = (dept) => {
  const map = { BPED: 'bg-blue-100 text-blue-700', BECED: 'bg-green-100 text-green-700', BCAED: 'bg-purple-100 text-purple-700' };
  return map[dept] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
};

const InstructorSchedule = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [instructor, setInstructor] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [options, setOptions] = useState({ subjects: [], instructors: [], classrooms: [], sections: [] });
  const [term, setTerm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterSemester, setFilterSemester] = useState('');
  const [filterSchoolYear, setFilterSchoolYear] = useState('');

  // schedule form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const loadSchedules = () => api.get(`/schedules?instructor_id=${id}`).then(({ data }) => setSchedules(data));

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/instructors?id=${id}`),
      api.get(`/schedules?instructor_id=${id}`),
      api.get('/subjects'), api.get('/instructors'), api.get('/classrooms'), api.get('/sections'),
      api.get('/term?action=get'),
    ]).then(([inst, sched, subs, insts, rooms, secs, t]) => {
      setInstructor(inst.data);
      setSchedules(sched.data);
      setOptions({ subjects: subs.data, instructors: insts.data, classrooms: rooms.data, sections: secs.data });
      setTerm(t.data);
    }).finally(() => setLoading(false));
  }, [id]);

  const blankForm = (overrides = {}) => ({
    subject_id: '', instructor_id: String(id), classroom_id: '', section_id: '',
    day_of_week: 'Monday', time_start: '07:30', time_end: '08:30',
    semester: term?.active_semester || '1st',
    school_year: term?.active_school_year || defaultSchoolYear(),
    ...overrides,
  });

  const openCreate = (slot = {}) => {
    setEditingId(null);
    setForm(blankForm(slot));
    setShowForm(true);
  };

  const openEdit = (s) => {
    if (!s?.id || !s.subject_id || !s.classroom_id || !s.section_id) {
      toast.error('Schedule details are still loading. Please try again.');
      return;
    }
    setEditingId(s.id);
    setForm({
      subject_id: String(s.subject_id), instructor_id: String(s.instructor_id || id),
      classroom_id: String(s.classroom_id), section_id: String(s.section_id),
      day_of_week: s.day_of_week || 'Monday',
      time_start: timeInputValue(s.time_start) || '07:30',
      time_end: timeInputValue(s.time_end) || '08:30',
      semester: s.semester || term?.active_semester || '1st',
      school_year: s.school_year || term?.active_school_year || defaultSchoolYear(),
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(null); };

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editingId) await api.put(`/schedules?id=${editingId}`, form);
      else await api.post('/schedules', form);
      toast.success(editingId ? 'Schedule updated' : 'Schedule added');
      closeForm(); loadSchedules();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving'); }
    finally { setSaving(false); }
  };

  const removeSchedule = async () => {
    if (!editingId || !window.confirm('Delete this schedule?')) return;
    setSaving(true);
    try {
      await api.delete(`/schedules?id=${editingId}`);
      toast.success('Schedule deleted');
      closeForm(); loadSchedules();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not delete.'); }
    finally { setSaving(false); }
  };

  // Delete directly from a calendar card (confirmation handled in the calendar modal)
  const deleteFromCalendar = async (s) => {
    if (!s?.id) return;
    try {
      await api.delete(`/schedules?id=${s.id}`);
      toast.success('Schedule deleted');
      loadSchedules();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not delete.'); }
  };

  const filtered = schedules.filter(s => {
    if (filterSemester && s.semester !== filterSemester) return false;
    if (filterSchoolYear && s.school_year !== filterSchoolYear) return false;
    return true;
  });

  const schoolYears = [...new Set(schedules.map(s => s.school_year).filter(Boolean))];
  const totalConflicts = filtered.filter(s => s.conflicts?.length > 0).length;
  const selectCls = 'border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 dark:text-white';
  const fieldCls = 'w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mt-1 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]';

  return (
    <div>
      <button onClick={() => navigate('/admin/instructors')}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-5 transition">
        ← Back to Instructors
      </button>

      {loading && <InstructorCardSkeleton />}
      {!loading && instructor && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 mb-5 flex items-center gap-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0" style={{ background: '#7B1C1C' }}>
            {instructor.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{instructor.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{instructor.position || ''}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${progBadge(instructor.department)}`}>{instructor.department || 'No dept.'}</span>
              {instructor.username && <span className="text-xs text-gray-400 dark:text-gray-500">@{instructor.username}</span>}
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{filtered.length}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Classes</p>
            </div>
            {totalConflicts > 0 && (
              <div>
                <p className="text-xl font-bold text-red-500">{totalConflicts}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Conflicts</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header + actions */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200">
          Schedule Calendar
          {totalConflicts > 0 && (
            <span className="ml-2 text-xs bg-red-100 text-red-600 border border-red-200 dark:border-red-900/40 px-2 py-0.5 rounded-full font-medium">
              ⚠ {totalConflicts} conflict{totalConflicts > 1 ? 's' : ''}
            </span>
          )}
        </h3>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)} className={selectCls}>
            <option value="">All Semesters</option>
            <option value="1st">1st Semester</option>
            <option value="2nd">2nd Semester</option>
            <option value="Summer">Summer</option>
          </select>
          {schoolYears.length > 0 && (
            <select value={filterSchoolYear} onChange={e => setFilterSchoolYear(e.target.value)} className={selectCls}>
              <option value="">All School Years</option>
              {schoolYears.map(y => <option key={y}>{y}</option>)}
            </select>
          )}
          <button onClick={() => openCreate()} disabled={loading}
            className="inline-flex items-center gap-1.5 bg-[#7B1C1C] text-white px-3.5 py-2 rounded-lg text-sm font-semibold hover:bg-[#6a1717] transition shadow-sm disabled:opacity-60">
            <Plus className="w-4 h-4" /> Add Schedule
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-pink-500 inline-block" />BPED</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />BECED</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />BCAED</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Conflict</span>
      </div>

      {loading ? <CalendarSkeleton /> : (
        <ScheduleCalendar schedules={filtered} loading={false} onCreateSchedule={openCreate} onEditSchedule={openEdit} onDeleteSchedule={deleteFromCalendar} />
      )}

      {/* Schedule form dialog */}
      {showForm && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={closeForm}>
          <form onSubmit={save} onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-800 dark:text-white">{editingId ? 'Edit Schedule' : 'Add Schedule'}</h3>
              <button type="button" onClick={closeForm} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Subject</label>
                <select required value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} className={fieldCls}>
                  <option value="">Select subject</option>
                  {options.subjects.map(s => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Instructor</label>
                <select required value={form.instructor_id} onChange={e => setForm({ ...form, instructor_id: e.target.value })} className={fieldCls}>
                  {options.instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Room</label>
                <select required value={form.classroom_id} onChange={e => setForm({ ...form, classroom_id: e.target.value })} className={fieldCls}>
                  <option value="">Select room</option>
                  {options.classrooms.map(c => <option key={c.id} value={c.id}>{c.room_code}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Section</label>
                <select required value={form.section_id} onChange={e => setForm({ ...form, section_id: e.target.value })} className={fieldCls}>
                  <option value="">Select section</option>
                  {options.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Day</label>
                <select value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: e.target.value })} className={fieldCls}>
                  {DAYS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Time Start</label>
                <input type="time" required value={form.time_start} onChange={e => setForm({ ...form, time_start: e.target.value })} className={fieldCls} />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Time End</label>
                <input type="time" required value={form.time_end} onChange={e => setForm({ ...form, time_end: e.target.value })} className={fieldCls} />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Semester</label>
                <select value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} className={fieldCls}>
                  <option value="1st">1st Semester</option>
                  <option value="2nd">2nd Semester</option>
                  <option value="Summer">Summer</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">School Year</label>
                <input value={form.school_year} onChange={e => setForm({ ...form, school_year: e.target.value })} className={fieldCls} placeholder="2024-2025" />
              </div>
            </div>
            <div className="flex items-center gap-2 justify-between mt-5">
              {editingId ? (
                <button type="button" onClick={removeSchedule} disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 dark:border-red-900/40 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={closeForm} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60 hover:bg-[#6a1717] transition" style={{ background: '#7B1C1C' }}>
                  {saving ? 'Saving…' : editingId ? 'Update Schedule' : 'Save Schedule'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default InstructorSchedule;
