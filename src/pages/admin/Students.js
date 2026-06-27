import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../../components/common/Skeleton';

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
  const [pageLoading, setPageLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filterYear, setFilterYear] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [search, setSearch] = useState('');

  const load = (showSpinner = false) => {
    if (showSpinner) setPageLoading(true);
    Promise.all([
      api.get('/students'),
      api.get('/sections'),
    ]).then(([s, sec]) => {
      setStudents(s.data);
      setSections(sec.data);
    }).finally(() => setPageLoading(false));
  };
  useEffect(() => { load(true); }, []);

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
    await api.delete(`/students?id=${id}`); toast.success('Deleted'); load();
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

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] transition';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">{students.length} student{students.length !== 1 ? 's' : ''} enrolled</p>
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
          <a href={'data:text/csv;charset=utf-8,' + encodeURIComponent(
              'student_id,name,year_level,section_name\n2024-00001,Juan dela Cruz,1,BPED-1A\n2024-00002,Maria Santos,2,BECED-2B\n2024-00003,Jose Reyes,3,BCAED-3C\n2024-00004,Ana Garcia,4,BPED-4A\n'
            )} download="students_template.csv"
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
            Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-52 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]"
          placeholder="Search name or ID..." />
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]">
          <option value="">All Year Levels</option>
          {[1,2,3,4].map(y => <option key={y} value={y}>{yearLabels[y]}</option>)}
        </select>
        <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]">
          <option value="">All Sections</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {(filterYear || filterSection || search) && (
          <button onClick={() => { setFilterYear(''); setFilterSection(''); setSearch(''); }}
            className="text-sm text-gray-400 hover:text-gray-600 underline">Clear</button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-4">{editId ? 'Edit Student' : 'Add New Student'}</h3>
          <form onSubmit={save} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Student ID</label>
              <input required value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
                className={inputCls} placeholder="e.g. 2024-00001" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full Name</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year Level</label>
              <select value={form.year_level} onChange={e => setForm({ ...form, year_level: e.target.value })} className={inputCls}>
                {[1,2,3,4].map(y => <option key={y} value={y}>{yearLabels[y]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Section</label>
              <select required value={form.section_id} onChange={e => setForm({ ...form, section_id: e.target.value })} className={inputCls}>
                <option value="">Select section</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex gap-2 justify-end border-t border-gray-100 pt-4">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">Cancel</button>
              <button type="submit"
                className="px-5 py-2.5 text-sm bg-[#7B1C1C] text-white rounded-lg font-semibold hover:bg-[#6a1717] transition">
                {editId ? 'Update Student' : 'Add Student'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {pageLoading ? <TableSkeleton rows={7} cols={5} /> : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Student ID','Name','Year Level','Section','Actions'].map((h, i) => (
                  <th key={h} className={`px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3.5 font-mono text-sm font-semibold text-[#7B1C1C]">{s.student_id}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{s.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                      {yearLabels[s.year_level]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold">{s.section_name || '—'}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setForm({ student_id: s.student_id, name: s.name, year_level: String(s.year_level), section_id: String(s.section_id) }); setEditId(s.id); setShowForm(true); }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">Edit</button>
                      <button onClick={() => remove(s.id)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400 text-sm">
                  {students.length === 0 ? 'No students yet — add one or import a CSV.' : 'No students match the current filters.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        CSV columns: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">student_id, name, year_level, section_name</span>
      </p>
    </div>
  );
};

export default Students;
