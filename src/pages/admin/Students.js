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
      if (editId) await api.put(`/students/${editId}`, form);
      else await api.post('/students', form);
      toast.success(editId ? 'Updated' : 'Student added');
      setForm(empty); setEditId(null); setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this student?')) return;
    await api.delete(`/students/${id}`); toast.success('Deleted'); load();
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
        const { data } = await api.post('/students/import', { rows });
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

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">Students
          <span className="ml-2 text-sm font-normal text-gray-400">({students.length} total)</span>
        </h2>
        <div className="flex gap-2 flex-wrap">
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          <button onClick={() => csvRef.current.click()} disabled={importing}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            {importing ? 'Importing...' : '⬆ Import CSV'}
          </button>
          <a href={'data:text/csv;charset=utf-8,' + encodeURIComponent(
              'student_id,name,year_level,section_name\n' +
              '2024-00001,Juan dela Cruz,1,BPED-1A\n' +
              '2024-00002,Maria Santos,2,BECED-2B\n' +
              '2024-00003,Jose Reyes,3,BCAED-3C\n' +
              '2024-00004,Ana Garcia,4,BPED-4A\n'
            )}
            download="students_template.csv"
            className="border border-gray-300 text-gray-500 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
            ⬇ Template
          </a>
          <button onClick={() => { setForm(empty); setEditId(null); setShowForm(true); }}
            className="text-white px-4 py-2 rounded-lg text-sm" style={{ background: '#7B1C1C' }}>
            + Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white w-48" placeholder="Search name or ID..." />
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white">
          <option value="">All Year Levels</option>
          {[1,2,3,4].map(y => <option key={y} value={y}>{yearLabels[y]}</option>)}
        </select>
        <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white">
          <option value="">All Sections</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {(filterYear || filterSection || search) && (
          <button onClick={() => { setFilterYear(''); setFilterSection(''); setSearch(''); }}
            className="text-sm text-gray-400 hover:text-gray-600 underline">Clear</button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={save} className="bg-white border rounded-xl p-5 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">Student ID</label>
            <input required value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. 2024-00001" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Full Name</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Year Level</label>
            <select value={form.year_level} onChange={e => setForm({ ...form, year_level: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              {[1,2,3,4].map(y => <option key={y} value={y}>{yearLabels[y]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Section</label>
            <select required value={form.section_id} onChange={e => setForm({ ...form, section_id: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Select section</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
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
      {pageLoading ? <TableSkeleton rows={7} cols={5} /> : <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Student ID</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Year Level</th>
              <th className="px-4 py-3 text-left">Section</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm" style={{ color: '#7B1C1C' }}>{s.student_id}</td>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                    {yearLabels[s.year_level]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{s.section_name || '—'}</td>
                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                  <button onClick={() => { setForm({ student_id: s.student_id, name: s.name, year_level: String(s.year_level), section_id: String(s.section_id) }); setEditId(s.id); setShowForm(true); }}
                    className="text-blue-600 hover:underline text-xs">Edit</button>
                  <button onClick={() => remove(s.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                {students.length === 0 ? 'No students yet. Add one or import a CSV.' : 'No students match the filter.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>}

      <p className="text-xs text-gray-400 mt-2">
        CSV format: <span className="font-mono">student_id, name, year_level, section_name</span> — Download the template above.
      </p>
    </div>
  );
};

export default Students;
