import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../../components/common/Skeleton';

const empty = { name: '', department: '', position: '', username: '', password: '' };

const POSITIONS = [
  'Instructor I', 'Instructor II', 'Instructor III',
  'Assistant Professor I', 'Assistant Professor II', 'Assistant Professor III', 'Assistant Professor IV',
  'Associate Professor I', 'Associate Professor II', 'Associate Professor III', 'Associate Professor IV', 'Associate Professor V',
  'Professor I', 'Professor II', 'Professor III', 'Professor IV', 'Professor V', 'Professor VI',
  'Part-time Instructor',
];
const PROGRAMS = ['BPED', 'BECED', 'BCAED'];

const progBadge = (dept) => {
  const map = { BPED: 'bg-blue-100 text-blue-700', BECED: 'bg-green-100 text-green-700', BCAED: 'bg-purple-100 text-purple-700' };
  return map[dept] || 'bg-gray-100 text-gray-600';
};

const statusBadge = (status) => {
  if (status === 'active')       return 'bg-emerald-100 text-emerald-700';
  if (status === 'pending')      return 'bg-amber-100 text-amber-700';
  if (status === 'unactivated')  return 'bg-gray-100 text-gray-500';
  return 'bg-gray-100 text-gray-500';
};

const parseCSV = (text) => {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  }).filter(r => r.name);
};

const Instructors = () => {
  const navigate = useNavigate();
  const csvRef = useRef();
  const [instructors, setInstructors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = (showSpinner = false) => {
    if (showSpinner) setPageLoading(true);
    Promise.all([
      api.get('/instructors'),
      api.get('/misc?action=activation-requests'),
    ]).then(([inst, reqs]) => {
      setInstructors(inst.data);
      setRequests(reqs.data);
    }).finally(() => setPageLoading(false));
  };
  useEffect(() => { load(true); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/instructors?id=${editId}`, form);
      else await api.post('/instructors', form);
      toast.success(editId ? 'Updated' : 'Instructor added');
      setForm(empty); setEditId(null); setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this instructor?')) return;
    await api.delete(`/instructors?id=${id}`); toast.success('Deleted'); load();
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/misc?action=activation-requests&id=${id}&act=approve`);
      toast.success('Account activated!'); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Reject this request?')) return;
    await api.post(`/misc?action=activation-requests&id=${id}&act=reject`);
    toast.success('Request rejected.'); load();
  };

  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setImporting(true);
      try {
        const rows = parseCSV(ev.target.result);
        if (rows.length === 0) return toast.error('No valid rows found in CSV.');
        const { data } = await api.post('/instructors?action=import', { rows });
        toast.success(`Imported ${data.inserted} instructor(s). ${data.skipped} skipped.`);
        load();
      } catch (err) { toast.error('Import failed.'); }
      finally { setImporting(false); e.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] transition';

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Instructors</h1>
            {pendingRequests.length > 0 && (
              <button onClick={() => setShowRequests(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {pendingRequests.length} Pending Activation{pendingRequests.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{instructors.length} instructor{instructors.length !== 1 ? 's' : ''} registered</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          <button onClick={() => csvRef.current.click()} disabled={importing}
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <a href={'data:text/csv;charset=utf-8,' + encodeURIComponent('name,department,position\nJuan dela Cruz,BPED,Instructor I\nMaria Santos,BECED,Assistant Professor II\nJose Reyes,BCAED,Part-time Instructor\n')}
            download="instructors_template.csv"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Template
          </a>
          <button onClick={() => { setForm(empty); setEditId(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 bg-[#7B1C1C] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#6a1717] transition shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Instructor
          </button>
        </div>
      </div>

      {/* Activation Requests Panel */}
      {showRequests && pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5">
          <h3 className="text-sm font-bold text-amber-800 mb-3">Pending Activation Requests</h3>
          <div className="flex flex-col gap-2">
            {pendingRequests.map(r => (
              <div key={r.id} className="bg-white border border-amber-100 rounded-lg px-4 py-3.5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-sm text-gray-900">{r.instructor_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold mr-2 ${progBadge(r.department)}`}>{r.department || '—'}</span>
                    Username requested: <span className="font-mono font-semibold text-gray-700">{r.desired_username}</span>
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleApprove(r.id)}
                    className="text-xs px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition">
                    Approve
                  </button>
                  <button onClick={() => handleReject(r.id)}
                    className="text-xs px-3.5 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-semibold transition">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-4">{editId ? 'Edit Instructor' : 'Add New Instructor'}</h3>
          <form onSubmit={save} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full Name</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className={inputCls} placeholder="e.g. Juan dela Cruz" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Department / Program</label>
              <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className={inputCls}>
                <option value="">— Select —</option>
                {PROGRAMS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Position / Rank</label>
              <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className={inputCls}>
                <option value="">— Select position —</option>
                {POSITIONS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Username <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                className={inputCls} placeholder="Leave blank — instructor can request via Sign Up" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Password {editId && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
              </label>
              <input type="password" required={!editId && !!form.username} value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} className={inputCls} />
            </div>
            <div className="col-span-2 flex gap-2 justify-end border-t border-gray-100 pt-4">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">Cancel</button>
              <button type="submit"
                className="px-5 py-2.5 text-sm bg-[#7B1C1C] text-white rounded-lg font-semibold hover:bg-[#6a1717] transition">
                {editId ? 'Update Instructor' : 'Add Instructor'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {pageLoading ? <TableSkeleton rows={6} cols={6} /> : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Instructor','Position','Program','Username','Status','Actions'].map((h, i) => (
                  <th key={h} className={`px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {instructors.map(inst => (
                <tr key={inst.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3.5">
                    <button onClick={() => navigate(`/admin/instructors/${inst.id}/schedule`)}
                      className="flex items-center gap-2.5 group text-left">
                      <span className="w-8 h-8 rounded-full bg-[#7B1C1C] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {inst.name?.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-semibold text-gray-900 group-hover:text-[#7B1C1C] transition">
                        {inst.name}
                        <span className="block text-xs text-gray-400 font-normal opacity-0 group-hover:opacity-100 transition">View schedule →</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{inst.position || <span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${progBadge(inst.department)}`}>
                      {inst.department || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{inst.username || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${statusBadge(inst.status)}`}>
                      {inst.status === 'unactivated' ? 'Not activated' : inst.status === 'pending' ? 'Pending' : 'Active'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => navigate(`/admin/instructors/${inst.id}/schedule`)}
                        className="text-xs font-semibold text-[#7B1C1C] border border-[#7B1C1C]/30 px-3 py-1.5 rounded-lg hover:bg-[#7B1C1C]/5 transition">
                        Schedule
                      </button>
                      <button onClick={() => { setForm({ name: inst.name, department: inst.department || '', position: inst.position || '', username: inst.username || '', password: '' }); setEditId(inst.id); setShowForm(true); }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">Edit</button>
                      <button onClick={() => remove(inst.id)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {instructors.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">No instructors yet — add one or import a CSV.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        CSV columns: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">name, department, position</span>
      </p>
    </div>
  );
};

export default Instructors;
