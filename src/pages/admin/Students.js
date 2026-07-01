import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../../components/common/Skeleton';
import { notifyBus } from '../../utils/notificationBus';

const yearLabels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
const empty = { student_id: '', name: '', year_level: '1', section_id: '' };

const parseCSV = (text) => {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  }).filter(r => r.student_id || r.name);
};

const Students = () => {
  const csvRef = useRef();
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filterYear, setFilterYear] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [promoting, setPromoting] = useState(false);
  const [historyFor, setHistoryFor] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = (showSpinner = false) => {
    if (showSpinner) setPageLoading(true);
    Promise.all([
      api.get('/students'),
      api.get('/sections'),
      api.get('/misc?action=student-requests'),
    ]).then(([s, sec, reqs]) => {
      setStudents(s.data);
      setSections(sec.data);
      setRequests(reqs.data);
    }).finally(() => setPageLoading(false));
  };
  useEffect(() => { load(true); }, []);

  const pendingRequests = requests.filter(r => r.status === 'pending');

  const handleApprove = async (id) => {
    try {
      await api.post(`/misc?action=student-requests&id=${id}&act=approve`);
      toast.success('Student approved! Assign a section below.');
      notifyBus.push({ type: 'success', title: 'Student Approved', body: 'New student account has been created.' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Reject this registration?')) return;
    try {
      await api.post(`/misc?action=student-requests&id=${id}&act=reject`);
      toast.success('Registration rejected.'); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const openHistory = async (student) => {
    setHistoryFor(student);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const { data } = await api.get(`/term?action=student-history&student_id=${student.id}`);
      setHistory(data);
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  };

  const handlePromote = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`Promote ${selected.length} student(s) to the next year level? Sections will be remapped to the next year where a matching section exists.`)) return;
    setPromoting(true);
    try {
      const { data } = await api.post('/students?action=promote', { ids: selected });
      toast.success(data.message);
      notifyBus.push({ type: 'success', title: 'Students Promoted', body: data.message });
      setSelected([]); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Promotion failed.'); }
    finally { setPromoting(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/students?id=${editId}`, form);
      else await api.post('/students', form);
      toast.success(editId ? 'Updated' : 'Student added');
      setForm(empty); setEditId(null); setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this student?')) return;
    try {
      await api.delete(`/students?id=${id}`); toast.success('Deleted'); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete this student.', { duration: 5000 });
    }
  };

  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setImporting(true);
      try {
        const rows = parseCSV(ev.target.result);
        if (rows.length === 0) return toast.error('No valid rows found. Check CSV format.');
        const { data } = await api.post('/students?action=import', { rows });
        toast.success(`Imported ${data.inserted} student(s). ${data.skipped} skipped.`);
        notifyBus.push({ type: 'success', title: `Imported ${data.inserted} Student(s)`, body: `${data.skipped} skipped${data.errors?.length ? `, ${data.errors.length} error(s)` : ''}.` });
        if (data.errors?.length) data.errors.slice(0, 3).forEach(err => toast.error(err, { duration: 4000 }));
        load();
      } catch { toast.error('Import failed.'); }
      finally { setImporting(false); e.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const filtered = students.filter(s => {
    if (filterYear && String(s.year_level) !== filterYear) return false;
    if (filterSection && String(s.section_id) !== filterSection) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.student_id.includes(search)) return false;
    return true;
  });

  const inputCls = 'w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 transition';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Students</h1>
            {pendingRequests.length > 0 && (
              <button onClick={() => setShowRequests(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 border border-amber-200 dark:border-amber-900/40 hover:bg-amber-100 transition">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {pendingRequests.length} Pending Registration{pendingRequests.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{students.length} student{students.length !== 1 ? 's' : ''} enrolled</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          <button onClick={() => csvRef.current.click()} disabled={importing}
            className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <a href={'data:text/csv;charset=utf-8,' + encodeURIComponent(
              'student_id,name,year_level,section_name\n2024-00001,Juan dela Cruz,1,BPED-1A\n2024-00002,Maria Santos,2,BECED-2B\n2024-00003,Jose Reyes,3,BCAED-3C\n2024-00004,Ana Garcia,4,BPED-4A\n'
            )} download="students_template.csv"
            className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
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
            Add Student
          </button>
        </div>
      </div>

      {/* Registration Requests Panel */}
      {showRequests && pendingRequests.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-5 mb-5">
          <h3 className="text-sm font-bold text-amber-800 mb-3">Pending Registration Requests</h3>
          <div className="flex flex-col gap-2">
            {pendingRequests.map(r => (
              <div key={r.id} className="bg-white dark:bg-gray-900 border border-amber-100 dark:border-amber-900/40 rounded-lg px-4 py-3.5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-sm text-gray-900 dark:text-white">{r.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>ID: <span className="font-mono font-semibold text-gray-700 dark:text-gray-200">{r.student_id}</span></span>
                    {r.year_level && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">{yearLabels[r.year_level]}</span>}
                    {r.section_name && <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 font-semibold">{r.section_name}</span>}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleApprove(r.id)}
                    className="text-xs px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition">
                    Approve
                  </button>
                  <button onClick={() => handleReject(r.id)}
                    className="text-xs px-3.5 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold transition">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-700 mt-3">Students choose their year level and section at registration. You can adjust it anytime after approving.</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 w-52 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          placeholder="Search name or ID..." />
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500">
          <option value="">All Year Levels</option>
          {[1,2,3,4].map(y => <option key={y} value={y}>{yearLabels[y]}</option>)}
        </select>
        <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500">
          <option value="">All Sections</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {(filterYear || filterSection || search) && (
          <button onClick={() => { setFilterYear(''); setFilterSection(''); setSearch(''); }}
            className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-600 underline">Clear</button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">{editId ? 'Edit Student' : 'Add New Student'}</h3>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Student ID</label>
              <input required value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
                className={inputCls} placeholder="e.g. 2024-00001" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Full Name</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Year Level</label>
              <select value={form.year_level} onChange={e => setForm({ ...form, year_level: e.target.value })} className={inputCls}>
                {[1,2,3,4].map(y => <option key={y} value={y}>{yearLabels[y]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Section</label>
              <select required value={form.section_id} onChange={e => setForm({ ...form, section_id: e.target.value })} className={inputCls}>
                <option value="">Select section</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-2 flex gap-2 justify-end border-t border-gray-100 dark:border-gray-800 pt-4">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">Cancel</button>
              <button type="submit"
                className="px-5 py-2.5 text-sm bg-[#7B1C1C] text-white rounded-lg font-semibold hover:bg-[#6a1717] transition">
                {editId ? 'Update Student' : 'Add Student'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Selection / Promote toolbar */}
      {selected.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-3 bg-[#7B1C1C]/5 border border-[#7B1C1C]/20 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-[#7B1C1C]">{selected.length} selected</p>
          <div className="flex gap-2">
            <button onClick={() => setSelected([])}
              className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">Clear</button>
            <button onClick={handlePromote} disabled={promoting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700 transition disabled:opacity-60">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {promoting ? 'Promoting...' : 'Promote to Next Year'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {pageLoading ? <TableSkeleton rows={7} cols={6} /> : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3.5 w-10">
                  <input type="checkbox"
                    checked={filtered.length > 0 && filtered.every(s => selected.includes(s.id))}
                    onChange={e => setSelected(e.target.checked ? filtered.map(s => s.id) : [])}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-[#7B1C1C] focus:ring-[#7B1C1C]/30 cursor-pointer" />
                </th>
                {['Student ID','Name','Year Level','Section','Actions'].map((h, i) => (
                  <th key={h} className={`px-5 py-3.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition ${selected.includes(s.id) ? 'bg-[#7B1C1C]/5' : ''}`}>
                  <td className="px-4 py-3.5">
                    <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-[#7B1C1C] focus:ring-[#7B1C1C]/30 cursor-pointer" />
                  </td>
                  <td className="px-5 py-3.5 font-mono text-sm font-semibold text-[#7B1C1C]">{s.student_id}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-white">{s.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                      {yearLabels[s.year_level]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 font-semibold">{s.section_name || '—'}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openHistory(s)}
                        className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">History</button>
                      <button onClick={() => { setForm({ student_id: s.student_id, name: s.name, year_level: String(s.year_level), section_id: String(s.section_id) }); setEditId(s.id); setShowForm(true); }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">Edit</button>
                      <button onClick={() => remove(s.id)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                  {students.length === 0 ? 'No students yet — add one or import a CSV.' : 'No students match the current filters.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        CSV columns: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">student_id, name, year_level, section_name</span>
      </p>

      {/* Enrollment History Modal */}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setHistoryFor(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Enrollment History</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{historyFor.name} · {historyFor.student_id}</p>
              </div>
              <button onClick={() => setHistoryFor(null)} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-[10px] uppercase tracking-wide font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md">Now</span>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{yearLabels[historyFor.year_level]} · {historyFor.section_name || '—'}</p>
              </div>
              {historyLoading ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No past records yet. History is recorded each time a new academic year is started.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-mono text-xs font-semibold text-[#7B1C1C]">{h.school_year}</span>
                      <span className="text-gray-700 dark:text-gray-200">{yearLabels[h.year_level] || `Year ${h.year_level}`} · {h.section_name || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;
