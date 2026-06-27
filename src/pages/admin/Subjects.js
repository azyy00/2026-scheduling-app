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
      if (editId) await api.put(`/subjects/${editId}`, form);
      else await api.post('/subjects', form);
      toast.success(editId ? 'Updated' : 'Subject added');
      setForm(empty); setEditId(null); setShowForm(false); load();
    } catch { toast.error('Error saving'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this subject?')) return;
    await api.delete(`/subjects/${id}`); toast.success('Deleted'); load();
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

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">
          Subjects
          <span className="ml-2 text-sm font-normal text-gray-400">({subjects.length} total)</span>
        </h2>
        <div className="flex gap-2 flex-wrap">
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          <button onClick={() => csvRef.current.click()} disabled={importing}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            {importing ? 'Importing...' : '⬆ Import CSV'}
          </button>
          <a href={TEMPLATE_CSV} download="subjects_template.csv"
            className="border border-gray-300 text-gray-500 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
            ⬇ Template
          </a>
          <button onClick={() => { setForm(empty); setEditId(null); setShowForm(true); }}
            className="text-white px-4 py-2 rounded-lg text-sm" style={{ background: '#7B1C1C' }}>
            + Add Subject
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white w-56" placeholder="Search code or name..." />
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white border rounded-xl p-5 mb-6 grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">Subject Code</label>
            <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. PE101" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Subject Name</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="e.g. Physical Education 1" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Units</label>
            <input type="number" min="1" max="9" value={form.units} onChange={e => setForm({ ...form, units: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="3" />
          </div>
          <div className="col-span-3 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm text-white rounded-lg" style={{ background: '#7B1C1C' }}>
              {editId ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {pageLoading ? <TableSkeleton rows={6} cols={4} /> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Units</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium font-mono" style={{ color: '#7B1C1C' }}>{s.code}</td>
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                      {s.units} {s.units === 1 ? 'unit' : 'units'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right flex gap-2 justify-end">
                    <button onClick={() => { setForm({ code: s.code, name: s.name, units: String(s.units) }); setEditId(s.id); setShowForm(true); }}
                      className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => remove(s.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  {subjects.length === 0 ? 'No subjects yet. Add one or import a CSV.' : 'No subjects match the search.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-2">
        CSV format: <span className="font-mono">code, name, units</span> — Download the template above for reference.
      </p>
    </div>
  );
};

export default Subjects;
