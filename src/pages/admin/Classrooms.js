import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const PRESET_ROOMS = [
  { group: 'Main Rooms', rooms: ['Rm 1','Rm 2','Rm 3','Rm 4','Rm 5','Rm 6','Rm 7','Rm 8'] },
  { group: 'Sub Rooms',  rooms: ['Rm 1A','Rm 1B','Rm 1C','Rm 1D'] },
  { group: 'Facilities', rooms: ['SPORT'] },
];

const empty = { room_code: '', capacity: '' };

const Classrooms = () => {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [usePreset, setUsePreset] = useState(true);

  const load = () => api.get('/classrooms').then(({ data }) => setRooms(data));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editId) await api.put(`/classrooms?id=${editId}`, form);
      else await api.post('/classrooms', form);
      toast.success(editId ? 'Room updated' : 'Room added');
      setForm(empty); setEditId(null); setShowForm(false); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this room?')) return;
    await api.delete(`/classrooms?id=${id}`);
    toast.success('Deleted'); load();
  };

  const startEdit = (r) => {
    setForm({ room_code: r.room_code, capacity: r.capacity || '' });
    setUsePreset(false); setEditId(r.id); setShowForm(true);
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Classrooms</h1>
          <p className="text-sm text-gray-500 mt-0.5">{rooms.length} room{rooms.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button
          onClick={() => { setForm(empty); setEditId(null); setUsePreset(true); setShowForm(true); }}
          className="inline-flex items-center gap-2 bg-[#7B1C1C] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#6a1717] transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Room
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-4">{editId ? 'Edit Room' : 'Add New Room'}</h3>
          <form onSubmit={save} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Room Code</label>
              {!editId && (
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input type="radio" checked={usePreset} onChange={() => setUsePreset(true)} className="accent-[#7B1C1C]" />
                    Select preset
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input type="radio" checked={!usePreset} onChange={() => setUsePreset(false)} className="accent-[#7B1C1C]" />
                    Custom
                  </label>
                </div>
              )}
              {usePreset && !editId ? (
                <select required value={form.room_code} onChange={e => setForm({ ...form, room_code: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]">
                  <option value="">— Select room —</option>
                  {PRESET_ROOMS.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.rooms.map(r => <option key={r} value={r}>{r}</option>)}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <input required value={form.room_code} onChange={e => setForm({ ...form, room_code: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]"
                  placeholder="e.g. Rm 1, Rm 1A, SPORT" />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Capacity</label>
              <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]"
                placeholder="40" />
            </div>
            <div className="flex items-end gap-2 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="submit"
                className="px-5 py-2.5 text-sm bg-[#7B1C1C] text-white rounded-lg font-semibold hover:bg-[#6a1717] transition">
                {editId ? 'Update Room' : 'Add Room'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Room</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Capacity</th>
              <th className="px-5 py-3.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rooms.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition">
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-2 font-semibold text-gray-900">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </span>
                    {r.room_code}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-600">
                  {r.capacity ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">
                      {r.capacity} seats
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => startEdit(r)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">
                      Edit
                    </button>
                    <button onClick={() => remove(r.id)}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-12 text-center">
                  <p className="text-gray-400 text-sm">No classrooms yet</p>
                  <p className="text-gray-300 text-xs mt-1">Add your first room using the button above</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Classrooms;
