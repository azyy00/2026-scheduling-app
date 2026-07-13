import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../../components/common/Skeleton';
import { notifyBus } from '../../utils/notificationBus';
import { programBadge as progBadge } from '../../utils/programTheme';

const yearLabels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' };
const empty = { student_id: '', name: '', year_level: '1', section_id: '', status: 'Regular' };

const STATUS_OPTIONS = ['Regular', 'Irregular', 'Returnee'];
// Normalize whatever is stored/typed into one of the known statuses.
const normStatus = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'irr' || s === 'ir' || s.startsWith('irreg')) return 'Irregular';
  if (s.startsWith('return')) return 'Returnee';
  return 'Regular';
};
const statusBadge = (status) => {
  switch (normStatus(status)) {
    case 'Irregular': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
    case 'Returnee':  return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300';
    default:          return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
  }
};

// Rows sent per request while importing — keeps progress updates frequent and
// each request small enough to stay well within serverless limits.
const IMPORT_BATCH_SIZE = 20;

// Format a millisecond duration as m:ss (or 0:ss under a minute).
const fmtDuration = (ms) => {
  if (ms == null || !isFinite(ms) || ms < 0) ms = 0;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Smoothly tweens a displayed number toward its target so counters "count up"
// instead of snapping between batch results.
const useCountUp = (target, duration = 480) => {
  const [val, setVal] = useState(target);
  const raf = useRef(0);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      fromRef.current = next;
      setVal(next);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
};

// Split one CSV line, honoring quoted fields so commas inside a value
// (e.g. "ABAD, NATHANIEL, ARNESTO") stay together. Handles "" as an escaped quote.
const parseCSVLine = (line) => {
  const out = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(v => v.trim());
};

const parseCSV = (text) => {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim(); });
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
  const [importProgress, setImportProgress] = useState(null);
  const [filterYear, setFilterYear] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [promoting, setPromoting] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const handleDeleteSelected = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`Delete ${selected.length} selected student(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const { data } = await api.post('/students?action=delete-bulk', { ids: selected });
      toast.success(data.message);
      notifyBus.push({ type: 'warning', title: 'Students Deleted', body: data.message });
      setSelected([]); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed.', { duration: 5000 }); }
    finally { setDeleting(false); }
  };

  const handleDeleteAll = async () => {
    if (students.length === 0) return;
    if (!window.confirm(`Delete ALL ${students.length} student(s)? This permanently removes every student record and cannot be undone.`)) return;
    if (!window.confirm('Are you absolutely sure? This action is irreversible.')) return;
    setDeleting(true);
    try {
      const { data } = await api.post('/students?action=delete-all');
      toast.success(data.message);
      notifyBus.push({ type: 'warning', title: 'All Students Deleted', body: data.message });
      setSelected([]); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed.', { duration: 5000 }); }
    finally { setDeleting(false); }
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
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      e.target.value = '';
      if (rows.length === 0) { toast.error('No valid rows found. Check CSV format.'); return; }
      runImport(rows);
    };
    reader.readAsText(file);
  };

  // Imports rows in small batches so the modal can show live percent, running
  // counts, elapsed time and a rolling estimate of the time remaining.
  const runImport = async (rows) => {
    const total = rows.length;
    const startedAt = Date.now();
    setImporting(true);
    setImportProgress({ total, processed: 0, inserted: 0, updated: 0, skipped: 0, noSection: 0, errors: [], elapsedMs: 0, etaMs: null, done: false, failed: false });

    let inserted = 0, updated = 0, skipped = 0, noSection = 0;
    const errors = [];
    let sectionsAvailable = [];
    try {
      for (let i = 0; i < total; i += IMPORT_BATCH_SIZE) {
        const batch = rows.slice(i, i + IMPORT_BATCH_SIZE);
        const { data } = await api.post('/students?action=import', { rows: batch });
        inserted += data.inserted || 0;
        updated += data.updated || 0;
        skipped += data.skipped || 0;
        noSection += data.noSection || 0;
        if (data.errors?.length) errors.push(...data.errors);
        if (data.sectionWarnings?.length) errors.push(...data.sectionWarnings);
        if (data.sectionsAvailable) sectionsAvailable = data.sectionsAvailable;

        const processed = Math.min(i + IMPORT_BATCH_SIZE, total);
        const elapsedMs = Date.now() - startedAt;
        const etaMs = processed > 0 ? Math.round((elapsedMs / processed) * (total - processed)) : null;
        setImportProgress({ total, processed, inserted, updated, skipped, noSection, errors, sectionsAvailable, elapsedMs, etaMs, done: false, failed: false });
      }
      setImportProgress({ total, processed: total, inserted, updated, skipped, noSection, errors, sectionsAvailable, elapsedMs: Date.now() - startedAt, etaMs: 0, done: true, failed: false });
      notifyBus.push({ type: 'success', title: `Imported ${inserted + updated} Student(s)`, body: `${inserted} added, ${updated} updated${noSection ? `, ${noSection} without a section` : ''}.` });
      load();
    } catch (err) {
      setImportProgress(prev => ({ ...(prev || { total, processed: 0, inserted, updated, skipped, noSection, errors }), elapsedMs: Date.now() - startedAt, etaMs: null, done: true, failed: true, message: err.response?.data?.message || 'Import failed. Some rows may not have been saved.' }));
      load();
    } finally {
      setImporting(false);
    }
  };

  const filtered = students.filter(s => {
    if (filterYear && String(s.year_level) !== filterYear) return false;
    if (filterSection && String(s.section_id) !== filterSection) return false;
    if (filterStatus && normStatus(s.status) !== filterStatus) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.student_id.includes(search)) return false;
    return true;
  });

  const inputCls = 'w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 transition';

  // Live, tweened values for the import modal (hooks run unconditionally).
  const ip = importProgress;
  const targetPct = ip ? (ip.total ? (ip.processed / ip.total) * 100 : 100) : 0;
  const animPct = useCountUp(targetPct);
  const animProcessed = useCountUp(ip ? ip.processed : 0);
  const animInserted = useCountUp(ip ? ip.inserted : 0);
  const animUpdated = useCountUp(ip ? (ip.updated || 0) : 0);
  const animSkipped = useCountUp(ip ? ip.skipped : 0);
  const importRunning = ip && !ip.done;
  const importDoneOk = ip && ip.done && !ip.failed;
  const importFailed = ip && ip.done && ip.failed;
  const closeImport = () => { if (ip && ip.done) setImportProgress(null); };

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
              'student_id,name,year_level,section_name,program,status\n' +
              '2024-00001,"dela Cruz, Juan, P.",1,BPED-1A,BPED,Regular\n' +
              '2024-00002,"Santos, Maria, L.",2,BECED-2B,BECED,Irregular\n' +
              '2024-00003,"Reyes, Jose",3,BCAED-3C,BCAED,Returnee\n' +
              '2024-00004,"Garcia, Ana",4,BPED-4A,BPED,Regular\n'
            )} download="students_template.csv"
            className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Template
          </a>
          {students.length > 0 && (
            <button onClick={handleDeleteAll} disabled={deleting}
              className="inline-flex items-center gap-2 border border-red-300 dark:border-red-900/50 text-red-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {deleting ? 'Deleting...' : 'Delete All'}
            </button>
          )}
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
                    {r.section_name && <span className={`px-2 py-0.5 rounded-md font-semibold ${progBadge(r.section_name)}`}>{r.section_name}</span>}
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
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
        </select>
        {(filterYear || filterSection || filterStatus || search) && (
          <button onClick={() => { setFilterYear(''); setFilterSection(''); setFilterStatus(''); setSearch(''); }}
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
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls}>
                {STATUS_OPTIONS.map(st => <option key={st} value={st}>{st}</option>)}
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
            <button onClick={handleDeleteSelected} disabled={deleting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-600 text-white px-4 py-1.5 rounded-lg hover:bg-red-700 transition disabled:opacity-60">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {deleting ? 'Deleting...' : 'Delete Selected'}
            </button>
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
                {['Student ID','Name','Year Level','Section','Status','Actions'].map((h) => (
                  <th key={h} className={`px-5 py-3.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
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
                    <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${progBadge(s.section_name)}`}>{s.section_name || '—'}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${statusBadge(s.status)}`}>{normStatus(s.status)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openHistory(s)}
                        className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">History</button>
                      <button onClick={() => { setForm({ student_id: s.student_id, name: s.name, year_level: String(s.year_level), section_id: s.section_id ? String(s.section_id) : '', status: normStatus(s.status) }); setEditId(s.id); setShowForm(true); }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">Edit</button>
                      <button onClick={() => remove(s.id)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
                  {students.length === 0 ? 'No students yet — add one or import a CSV.' : 'No students match the current filters.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        CSV columns: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">student_id, name, year_level, section_name, program, status</span>
        <span className="ml-1">— <span className="font-mono">section_name</span> must match a section (e.g. <span className="font-mono">BPED-2A</span>); add <span className="font-mono">program</span> to match by letter. <span className="font-mono">status</span> = Regular / Irregular / Returnee (optional). Names with commas should be "quoted".</span>
      </p>

      {/* Import Progress Modal */}
      {ip && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={closeImport}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-800 animate-modal-pop"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${importFailed ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : importDoneOk ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-[#7B1C1C]/10 text-[#7B1C1C]'}`}>
                {importRunning && (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {importDoneOk && (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {importFailed && (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {importRunning ? 'Importing Students' : importFailed ? 'Import Stopped' : 'Import Complete'}
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {importRunning
                    ? `Processing ${ip.total} row${ip.total !== 1 ? 's' : ''} from your CSV…`
                    : importFailed
                      ? (ip.message || 'Something interrupted the import.')
                      : `Finished ${ip.total} row${ip.total !== 1 ? 's' : ''} in ${fmtDuration(ip.elapsedMs)}.`}
                </p>
              </div>
            </div>

            {/* Big percent + progress bar */}
            <div className="px-6">
              <div className="flex items-end justify-between mb-2">
                <span className={`text-4xl font-extrabold tabular-nums tracking-tight ${importFailed ? 'text-red-600' : importDoneOk ? 'text-emerald-600' : 'text-[#7B1C1C]'}`}>
                  {Math.round(animPct)}<span className="text-2xl font-bold">%</span>
                </span>
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 tabular-nums pb-1">
                  {Math.round(animProcessed)} / {ip.total}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out ${importFailed ? 'bg-red-500' : importDoneOk ? 'bg-emerald-500' : 'bg-[#7B1C1C]'}`}
                  style={{ width: `${Math.max(importFailed ? animPct : animPct, importRunning ? 4 : 0)}%` }}>
                  {importRunning && <span className="import-bar-shimmer" />}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="px-6 pt-5 grid grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 px-2 py-2.5 text-center">
                <p className="text-lg font-bold text-emerald-600 tabular-nums">{Math.round(animInserted)}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-0.5">Added</p>
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 px-2 py-2.5 text-center">
                <p className="text-lg font-bold text-blue-600 tabular-nums">{Math.round(animUpdated)}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-0.5">Updated</p>
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 px-2 py-2.5 text-center">
                <p className="text-lg font-bold text-amber-500 tabular-nums">{Math.round(animSkipped)}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-0.5">Skipped</p>
              </div>
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 px-2 py-2.5 text-center">
                <p className={`text-lg font-bold tabular-nums ${ip.errors.length ? 'text-red-500' : 'text-gray-300 dark:text-gray-600'}`}>{ip.errors.length}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-0.5">Errors</p>
              </div>
            </div>

            {/* Time row */}
            <div className="px-6 pt-4 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Elapsed {fmtDuration(ip.elapsedMs)}
              </span>
              {importRunning && (
                <span className="tabular-nums">
                  {ip.etaMs == null ? 'Estimating…' : ip.etaMs <= 0 ? 'Almost done…' : `~${fmtDuration(ip.etaMs)} remaining`}
                </span>
              )}
            </div>

            {/* No-section warning */}
            {ip.done && ip.noSection > 0 && (
              <div className="mx-6 mt-4 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-900/40 px-4 py-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {ip.noSection} student{ip.noSection !== 1 ? 's' : ''} imported without a section.
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 leading-relaxed">
                  Their <span className="font-mono">section_name</span> didn't match any section. Make your CSV value match one of your section names below (or add a <span className="font-mono">program</span> column), then re-import — sections fill in.
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2 font-semibold">Your sections{ip.sectionsAvailable?.length ? ` (${ip.sectionsAvailable.length})` : ''}:</p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-mono break-words">
                  {ip.sectionsAvailable?.length ? ip.sectionsAvailable.join(' · ') : 'None yet — create sections in the Sections page first.'}
                </p>
              </div>
            )}

            {/* Errors preview */}
            {ip.done && ip.errors.length > 0 && (
              <div className="mx-6 mt-4 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-100 dark:border-red-900/40 px-4 py-3 max-h-28 overflow-y-auto">
                {ip.errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-red-600 dark:text-red-400 leading-relaxed">• {err}</p>
                ))}
                {ip.errors.length > 5 && <p className="text-xs text-red-400 mt-1">…and {ip.errors.length - 5} more.</p>}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-5 mt-2">
              {importRunning ? (
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">Please keep this tab open until the import finishes.</p>
              ) : (
                <button onClick={closeImport}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold text-white transition ${importFailed ? 'bg-red-600 hover:bg-red-700' : 'bg-[#7B1C1C] hover:bg-[#6a1717]'}`}>
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
