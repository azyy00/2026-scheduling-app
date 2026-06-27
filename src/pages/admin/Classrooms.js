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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Classrooms</h2>
        <button
          onClick={() => { setForm(empty); setEditId(null); setUsePreset(true); setShowForm(true); }}
          className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-violet-700"
        >
          + Add Room
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white border rounded-xl p-5 mb-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 font-medium">Room Code</label>
            {!editId && (
              <div className="flex gap-3 mt-1 mb-2">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="radio" checked={usePreset} onChange={() => setUsePreset(true)} /> Select preset
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="radio" checked={!usePreset} onChange={() => setUsePreset(false)} /> Custom
                </label>
              </div>
            )}
            {usePreset && !editId ? (
              <select
                required
                value={form.room_code}
                onChange={e => setForm({ ...form, room_code: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Select room —</option>
                {PRESET_ROOMS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.rooms.map(r => <option key={r} value={r}>{r}</option>)}
                  </optgroup>
                ))}
              </select>
            ) : (
              <input
                required
                value={form.room_code}
                onChange={e => setForm({ ...form, room_code: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                placeholder="e.g. Rm 1, Rm 1A, SPORT"
              />
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Capacity</label>
            <input
              type="number"
              value={form.capacity}
              onChange={e => setForm({ ...form, capacity: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              placeholder="40"
            />
          </div>
          <div className="flex items-end gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700">{editId ? 'Update' : 'Add'}</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Room Code</th>
              <th className="px-4 py-3 text-left">Capacity</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map(r => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.room_code}</td>
                <td className="px-4 py-3 text-gray-600">{r.capacity || '—'}</td>
                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                  <button onClick={() => startEdit(r)} className="text-blue-600 hover:underline text-xs">Edit</button>
                  <button onClick={() => remove(r.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No rooms yet — add one above</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Classrooms;
