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
      if (editId) await api.put(`/instructors/${editId}`, form);
      else await api.post('/instructors', form);
      toast.success(editId ? 'Updated' : 'Instructor added');
      setForm(empty); setEditId(null); setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this instructor?')) return;
    await api.delete(`/instructors/${id}`); toast.success('Deleted'); load();
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

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">Instructors</h2>
          {pendingRequests.length > 0 && (
            <button onClick={() => setShowRequests(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition">
              ⏳ {pendingRequests.length} Pending Activation{pendingRequests.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          <button onClick={() => csvRef.current.click()} disabled={importing}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1.5">
            {importing ? 'Importing...' : '⬆ Import CSV'}
          </button>
          <a href={'data:text/csv;charset=utf-8,' + encodeURIComponent(
              'name,department,position\n' +
              'Juan dela Cruz,BPED,Instructor I\n' +
              'Maria Santos,BECED,Assistant Professor II\n' +
              'Jose Reyes,BCAED,Part-time Instructor\n'
            )}
            download="instructors_template.csv"
            className="border border-gray-300 text-gray-500 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
            ⬇ Template
          </a>
          <button onClick={() => { setForm(empty); setEditId(null); setShowForm(true); }}
            className="text-white px-4 py-2 rounded-lg text-sm" style={{ background: '#7B1C1C' }}>
            + Add Instructor
          </button>
        </div>
      </div>

      {/* Activation Requests Panel */}
      {showRequests && pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">Pending Activation Requests</h3>
          <div className="flex flex-col gap-2">
            {pendingRequests.map(r => (
              <div key={r.id} className="bg-white border border-amber-100 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm text-gray-800">{r.instructor_name}</p>
                  <p className="text-xs text-gray-500">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs mr-2 ${progBadge(r.department)}`}>{r.department || '—'}</span>
                    Requesting username: <span className="font-mono font-medium">{r.desired_username}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleApprove(r.id)}
                    className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
                    Approve
                  </button>
                  <button onClick={() => handleReject(r.id)}
                    className="text-xs px-3 py-1.5 border border-red-300 text-red-500 rounded-lg hover:bg-red-50">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={save} className="bg-white border rounded-xl p-5 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">Full Name</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. Juan dela Cruz" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Department / Program</label>
            <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">— Select —</option>
              {PROGRAMS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 font-medium">Position / Rank</label>
            <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">— Select position —</option>
              {POSITIONS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">
              Username <span className="text-gray-400">(optional — instructor can request via Sign Up)</span>
            </label>
            <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="Leave blank to let instructor request" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">
              Password {editId && <span className="text-gray-400">(leave blank to keep)</span>}
            </label>
            <input type="password" required={!editId && !!form.username} value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div className="col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm text-white rounded-lg" style={{ background: '#7B1C1C' }}>
              {editId ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {pageLoading ? <TableSkeleton rows={6} cols={6} /> : <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Instructor</th>
              <th className="px-4 py-3 text-left">Position</th>
              <th className="px-4 py-3 text-left">Program</th>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {instructors.map(inst => (
              <tr key={inst.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button onClick={() => navigate(`/admin/instructors/${inst.id}/schedule`)}
                    className="font-medium text-left hover:underline flex items-center gap-2 group" style={{ color: '#7B1C1C' }}>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#7B1C1C' }}>
                      {inst.name?.charAt(0).toUpperCase()}
                    </span>
                    {inst.name}
                    <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition">→ Schedule</span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-600">{inst.position || <span className="text-gray-300">—</span>}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${progBadge(inst.department)}`}>
                    {inst.department || '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm font-mono">{inst.username || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusBadge(inst.status)}`}>
                    {inst.status === 'unactivated' ? 'Not activated' : inst.status === 'pending' ? '⏳ Pending' : '✓ Active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-3 justify-end items-center">
                    <button onClick={() => navigate(`/admin/instructors/${inst.id}/schedule`)}
                      className="text-xs font-medium px-2 py-1 rounded border transition hover:bg-gray-50"
                      style={{ color: '#7B1C1C', borderColor: '#7B1C1C' }}>
                      Schedule
                    </button>
                    <button onClick={() => { setForm({ name: inst.name, department: inst.department || '', position: inst.position || '', username: inst.username || '', password: '' }); setEditId(inst.id); setShowForm(true); }}
                      className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => remove(inst.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {instructors.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No instructors yet. Add one or import a CSV.</td></tr>
            )}
          </tbody>
        </table>
      </div>}

      {/* CSV format hint */}
      <p className="text-xs text-gray-400 mt-2">
        CSV format: <span className="font-mono">name, department, position</span> — Download the template above for reference.
      </p>
    </div>
  );
};

export default Instructors;
