import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const PROGRAMS = ['BPED', 'BECED', 'BCAED'];
const YEAR_LEVELS = [1, 2, 3, 4];
const SECTION_LETTERS = ['A', 'B', 'C'];
const yearLabel = (y) => ['1st', '2nd', '3rd', '4th'][y - 1] + ' Year';
const empty = { name: '', year_level: '1', program: 'BPED' };

const progBadge = (prog) => {
  if (prog === 'BPED')  return 'bg-blue-100 text-blue-700';
  if (prog === 'BECED') return 'bg-green-100 text-green-700';
  if (prog === 'BCAED') return 'bg-purple-100 text-purple-700';
  return 'bg-gray-100 text-gray-600';
};

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
      toast.success(editId ? 'Section updated' : 'Section added');
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sections</h1>
          <p className="text-sm text-gray-500 mt-0.5">{sections.length} section{sections.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button
          onClick={() => { setForm(empty); setEditId(null); setAutoName(true); setShowForm(true); }}
          className="inline-flex items-center gap-2 bg-[#7B1C1C] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#6a1717] transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Section
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-4">{editId ? 'Edit Section' : 'Add New Section'}</h3>
          <form onSubmit={save}>
            {!editId && (
              <div className="flex gap-4 mb-5">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer font-medium">
                  <input type="radio" checked={autoName} onChange={() => setAutoName(true)} className="accent-[#7B1C1C]" />
                  Auto-generate name
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer font-medium">
                  <input type="radio" checked={!autoName} onChange={() => setAutoName(false)} className="accent-[#7B1C1C]" />
                  Custom name
                </label>
              </div>
            )}

            {autoName && !editId ? (
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  { label: 'Program', content: (
                    <select value={form.program} onChange={e => setForm({ ...form, program: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]">
                      {PROGRAMS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  )},
                  { label: 'Year Level', content: (
                    <select value={form.year_level} onChange={e => setForm({ ...form, year_level: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]">
                      {YEAR_LEVELS.map(y => <option key={y} value={y}>{yearLabel(y)}</option>)}
                    </select>
                  )},
                  { label: 'Section Letter', content: (
                    <select value={form.section_letter || 'A'} onChange={e => setForm({ ...form, section_letter: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]">
                      {SECTION_LETTERS.map(l => <option key={l}>{l}</option>)}
                    </select>
                  )},
                ].map(({ label, content }) => (
                  <div key={label}>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
                    {content}
                  </div>
                ))}
                <div className="col-span-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Preview:</span>
                  <span className="text-sm font-bold text-[#7B1C1C]">{derivedName}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Section Name</label>
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]"
                    placeholder="e.g. BPED-2A" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year Level</label>
                  <select value={form.year_level} onChange={e => setForm({ ...form, year_level: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]">
                    {YEAR_LEVELS.map(y => <option key={y} value={y}>{yearLabel(y)}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end border-t border-gray-100 pt-4">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="submit"
                className="px-5 py-2.5 text-sm bg-[#7B1C1C] text-white rounded-lg font-semibold hover:bg-[#6a1717] transition">
                {editId ? 'Update Section' : 'Add Section'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Section</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Program</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Year Level</th>
              <th className="px-5 py-3.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sections.map(s => {
              const prog = PROGRAMS.find(p => s.name?.startsWith(p)) || '—';
              return (
                <tr key={s.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{s.name}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-md font-semibold ${progBadge(prog)}`}>{prog}</span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{yearLabel(s.year_level)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setForm({ name: s.name, year_level: String(s.year_level), program: prog }); setAutoName(false); setEditId(s.id); setShowForm(true); }}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">Edit</button>
                      <button onClick={() => remove(s.id)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sections.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400 text-sm">No sections yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Sections;
