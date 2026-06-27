import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../../components/common/Skeleton';

const empty = { code: '', name: '', units: '' };

const TEMPLATE_CSV =
  'data:text/csv;charset=utf-8,' +
  encodeURIComponent(
    'code,name,units\n' +
    'PE101,Physical Education 1,2\n' +
    'PE102,Physical Education 2,2\n' +
    'MATH101,Mathematics in the Modern World,3\n'
  );

const parseCSV = (text) => {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  }).filter(r => r.code || r.name);
};

const Subjects = () => {
  const csvRef = useRef();
  const [subjects, setSubjects] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');

  const load = (showSpinner = false) => {
    if (showSpinner) setPageLoading(true);
    api.get('/subjects').then(({ data }) => setSubjects(data)).finally(() => setPageLoading(false));
  };
  useEffect(() => { load(true); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/subjects?id=${editId}`, form);
      else await api.post('/subjects', form);
      toast.success(editId ? 'Updated' : 'Subject added');
      setForm(empty); setEditId(null); setShowForm(false); load();
    } catch { toast.error('Error saving'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this subject?')) return;
    await api.delete(`/subjects?id=${id}`); toast.success('Deleted'); load();
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
        const { data } = await api.post('/subjects?action=import', { rows });
        toast.success(`Imported ${data.inserted} subject(s). ${data.skipped} skipped.`);
        if (data.errors?.length) data.errors.slice(0, 3).forEach(err => toast.error(err, { duration: 4000 }));
        load();
      } catch { toast.error('Import failed.'); }
      finally { setImporting(false); e.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const filtered = subjects.filter(s =>
    !search ||
    s.code?.toLowerCase().includes(search.toLowerCase()) ||
    s.name?.toLowerCase().includes(search.toLowerCase())
  );

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] transition';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{subjects.length} subject{subjects.length !== 1 ? 's' : ''} in curriculum</p>
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
          <a href={TEMPLATE_CSV} download="subjects_template.csv"
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
            Add Subject
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-60 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]"
          placeholder="Search code or subject name..." />
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-4">{editId ? 'Edit Subject' : 'Add New Subject'}</h3>
          <form onSubmit={save} className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject Code</label>
              <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className={inputCls} placeholder="e.g. PE101" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject Name</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g. Physical Education 1" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Units</label>
              <input type="number" min="1" max="9" value={form.units} onChange={e => setForm({ ...form, units: e.target.value })} className={inputCls} placeholder="3" />
            </div>
            <div className="col-span-3 flex gap-2 justify-end border-t border-gray-100 pt-4">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">Cancel</button>
              <button type="submit"
                className="px-5 py-2.5 text-sm bg-[#7B1C1C] text-white rounded-lg font-semibold hover:bg-[#6a1717] transition">
                {editId ? 'Update Subject' : 'Add Subject'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {pageLoading ? <TableSkeleton rows={6} cols={4} /> : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {['Code','Name','Units','Actions'].map((h, i) => (
                  <th key={h} className={`px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3.5 font-mono font-bold text-[#7B1C1C]">{s.code}</td>
                  <td className="px-5 py-3.5 text-gray-800 font-medium">{s.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                      {s.units} {s.units === 1 ? 'unit' : 'units'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setForm({ code: s.code, name: s.name, units: String(s.units) }); setEditId(s.id); setShowForm(true); }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">Edit</button>
                      <button onClick={() => remove(s.id)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400 text-sm">
                  {subjects.length === 0 ? 'No subjects yet — add one or import a CSV.' : 'No subjects match the search.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        CSV columns: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">code, name, units</span>
      </p>
    </div>
  );
};

export default Subjects;
