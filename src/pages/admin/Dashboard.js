import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const TIMES = [
  '7:30 AM','8:30 AM','9:30 AM','10:30 AM','11:30 AM',
  '12:30 PM','1:30 PM','2:30 PM','3:30 PM','4:30 PM',
  '5:30 PM','6:30 PM','7:00 PM',
];
const TIME_VALUES = [
  '07:30','08:30','09:30','10:30','11:30',
  '12:30','13:30','14:30','15:30','16:30',
  '17:30','18:30','19:00',
];
const PROGRAMS = ['BPED','BECED','BCAED'];

const progColor = (name = '') => {
  if (name.startsWith('BPED'))  return 'bg-blue-100 border-l-4 border-blue-500 text-blue-900';
  if (name.startsWith('BECED')) return 'bg-green-100 border-l-4 border-green-500 text-green-900';
  if (name.startsWith('BCAED'))return 'bg-purple-100 border-l-4 border-purple-500 text-purple-900';
  return 'bg-gray-100 border-l-4 border-gray-400 text-gray-800';
};

const StatCard = ({ label, value, color }) => (
  <div className={`rounded-xl p-4 text-white shadow ${color}`}>
    <p className="text-xs opacity-80">{label}</p>
    <p className="text-2xl font-bold mt-1">{value ?? '—'}</p>
  </div>
);

const emptyInstructor = { name: '', department: 'BPED', username: '', password: '' };
const emptyRoom = { room_code: '', capacity: '', usePreset: true };
const emptySchedule = { subject_id: '', instructor_id: '', classroom_id: '', section_id: '', day_of_week: 'Monday', time_start: '07:30', time_end: '08:30', semester: '1st', school_year: '' };

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [options, setOptions] = useState({ subjects: [], instructors: [], classrooms: [], sections: [] });
  const [filterProgram, setFilterProgram] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [modal, setModal] = useState(null);
  const [instForm, setInstForm] = useState(emptyInstructor);
  const [roomForm, setRoomForm] = useState(emptyRoom);
  const [schedForm, setSchedForm] = useState(emptySchedule);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/misc?action=dashboard-stats').then(({ data }) => setStats(data)).catch(() => {});
    api.get('/schedules').then(({ data }) => setSchedules(data)).catch(() => {});
    Promise.all([
      api.get('/subjects'), api.get('/instructors'),
      api.get('/classrooms'), api.get('/sections'),
    ]).then(([s, i, c, sec]) => setOptions({ subjects: s.data, instructors: i.data, classrooms: c.data, sections: sec.data })).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const filteredSchedules = schedules.filter(s => {
    if (filterSection && String(s.section_id) !== filterSection) return false;
    if (filterProgram && !s.section_name?.startsWith(filterProgram)) return false;
    return true;
  });

  const getSlotIndex = (timeStart) => {
    const t = timeStart?.slice(0, 5);
    if (!t) return -1;
    // Find the last slot whose time is <= the schedule's start time
    let idx = -1;
    for (let i = 0; i < TIME_VALUES.length; i++) {
      if (TIME_VALUES[i] <= t) idx = i;
      else break;
    }
    return idx;
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
      await api.post('/schedules', schedForm);
      toast.success('Schedule added'); setModal(null); setSchedForm(emptySchedule); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); } finally { setSaving(false); }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">Schedule — {stats?.school_year || '2024–2025'}</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setModal('instructor')} className="text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90" style={{background:'#059669'}}>+ Add Instructor</button>
          <button onClick={() => setModal('room')} className="text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90" style={{background:'#7c3aed'}}>+ Add Room</button>
          <button onClick={() => setModal('schedule')} className="text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90" style={{background:'#7B1C1C'}}>+ Add Schedule</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Schedules" value={stats?.schedules} color="bg-blue-600" />
        <StatCard label="Classrooms" value={stats?.classrooms} color="bg-emerald-600" />
        <StatCard label="Instructors" value={stats?.instructors} color="bg-violet-600" />
        <StatCard label="Conflicts" value={stats?.conflicts} color="bg-red-500" />
      </div>

      {/* Filters + Legend */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex gap-2 flex-wrap">
          <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="">All Programs</option>
            {PROGRAMS.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="">All Sections</option>
            {options.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3 text-xs text-gray-500 items-center">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />BPED</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />BECED</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" />BCAED</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Conflict</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid border-b bg-gray-50" style={{ gridTemplateColumns: '64px repeat(7, minmax(0,1fr))' }}>
          <div className="border-r px-2 py-2" />
          {DAYS.map(d => (
            <div key={d} className="border-r last:border-r-0 text-center py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {d.slice(0,3)}
            </div>
          ))}
        </div>

        {/* Time rows */}
        {TIMES.map((time, rowIdx) => (
          <div key={time} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: '64px repeat(7, minmax(0,1fr))', minHeight: '52px' }}>
            <div className="border-r px-2 pt-1 text-right text-xs text-gray-400 font-medium whitespace-nowrap">
              {time}
            </div>
            {DAYS.map((day, dayIdx) => {
              const items = filteredSchedules.filter(s => s.day_of_week === day && getSlotIndex(s.time_start) === rowIdx);
              return (
                <div key={day} className="border-r last:border-r-0 p-1 relative">
                  {items.length === 0 ? null : items.length === 1 ? (
                    <div className={`rounded text-xs p-1.5 h-full leading-tight ${items[0].conflicts?.length ? 'bg-red-100 border-l-4 border-red-500 text-red-900' : progColor(items[0].section_name)}`}>
                      {items[0].conflicts?.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
                      <div className="font-semibold truncate">{items[0].subject_code}</div>
                      <div className="opacity-80 truncate">{items[0].section_name}</div>
                      <div className="opacity-60 text-[10px] truncate">{items[0].room_code}</div>
                      {items[0].conflicts?.length > 0 && <div className="text-red-600 text-[10px] font-medium">⚠ Conflict</div>}
                    </div>
                  ) : (
                    <div className="flex gap-0.5 h-full">
                      {items.map(s => (
                        <div key={s.id} className="flex-1 rounded text-xs p-1 bg-red-100 border-l-2 border-red-500 text-red-900 leading-tight">
                          <div className="font-semibold" style={{ fontSize: '9px' }}>{s.subject_code}</div>
                          <div style={{ fontSize: '9px' }} className="opacity-80">{s.section_name}</div>
                          <div className="text-red-600 font-medium" style={{ fontSize: '9px' }}>⚠</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Modals ── */}
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
              <h3 className="text-base font-bold text-gray-800 mb-4">Add Schedule</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 font-medium">Subject</label>
                  <select required value={schedForm.subject_id} onChange={e => setSchedForm({ ...schedForm, subject_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                    <option value="">Select subject</option>
                    {options.subjects.map(s => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
                  </select>
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
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60 hover:opacity-90" style={{background:'#7B1C1C'}}>{saving ? 'Saving...' : 'Save Schedule'}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
