import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const PROGRAMS = ['BPED', 'BECED', 'BCAED'];
const YEAR_LEVELS = [1, 2, 3, 4];
const SECTION_LETTERS = ['A', 'B', 'C'];

const yearLabel = (y) => ['1st', '2nd', '3rd', '4th'][y - 1] + ' Year';
const empty = { name: '', year_level: '1', program: 'BPED' };

const Sections = () => {
  const [sections, setSections] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [autoName, setAutoName] = useState(true);

  const load = () => api.get('/sections').then(({ data }) => setSections(data));
  useEffect(() => { load(); }, []);

  const derivedName = `${form.program}-${form.year_level}${form.section_letter || 'A'}`;

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      name: autoName && !editId ? derivedName : form.name,
      year_level: form.year_level,
    };
    try {
      if (editId) await api.put(`/sections?id=${editId}`, payload);
      else await api.post('/sections', payload);
      toast.success(editId ? 'Updated' : 'Section added');
      setForm(empty); setEditId(null); setShowForm(false); load();
    } catch { toast.error('Error saving'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this section?')) return;
    await api.delete(`/sections?id=${id}`);
    toast.success('Deleted'); load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Sections</h2>
        <button
          onClick={() => { setForm(empty); setEditId(null); setAutoName(true); setShowForm(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + Add Section
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white border rounded-xl p-5 mb-6">
          {!editId && (
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={autoName} onChange={() => setAutoName(true)} /> Auto-generate name
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" checked={!autoName} onChange={() => setAutoName(false)} /> Custom name
              </label>
            </div>
          )}

          {autoName && !editId ? (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500 font-medium">Program</label>
                <select value={form.program} onChange={e => setForm({ ...form, program: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  {PROGRAMS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Year Level</label>
                <select value={form.year_level} onChange={e => setForm({ ...form, year_level: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  {YEAR_LEVELS.map(y => <option key={y} value={y}>{yearLabel(y)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Section Letter</label>
                <select value={form.section_letter || 'A'} onChange={e => setForm({ ...form, section_letter: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  {SECTION_LETTERS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <span className="text-xs text-gray-400">Preview: </span>
                <span className="text-sm font-semibold text-blue-600">{derivedName}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500 font-medium">Section Name</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  placeholder="e.g. BPED-2A"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Year Level</label>
                <select value={form.year_level} onChange={e => setForm({ ...form, year_level: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                  {YEAR_LEVELS.map(y => <option key={y} value={y}>{yearLabel(y)}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editId ? 'Update' : 'Add'}</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Section</th>
              <th className="px-4 py-3 text-left">Program</th>
              <th className="px-4 py-3 text-left">Year Level</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sections.map(s => {
              const prog = PROGRAMS.find(p => s.name?.startsWith(p)) || '—';
              return (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      prog === 'BPED' ? 'bg-blue-100 text-blue-700' :
                      prog === 'BECED' ? 'bg-green-100 text-green-700' :
                      prog === 'BCAED' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                    }`}>{prog}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{yearLabel(s.year_level)}</td>
                  <td className="px-4 py-3 text-right flex gap-2 justify-end">
                    <button onClick={() => { setForm({ name: s.name, year_level: String(s.year_level), program: prog }); setAutoName(false); setEditId(s.id); setShowForm(true); }} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => remove(s.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              );
            })}
            {sections.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No sections yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Sections;
