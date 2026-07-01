import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { DoorOpen, Pencil, Trash2, Plus, X, Users } from 'lucide-react';

const PRESET_ROOMS = [
  { group: 'Main Rooms', rooms: ['Rm 1','Rm 2','Rm 3','Rm 4','Rm 5','Rm 6','Rm 7','Rm 8'] },
  { group: 'Sub Rooms',  rooms: ['Rm 1A','Rm 1B','Rm 1C','Rm 1D'] },
  { group: 'Facilities', rooms: ['SPORT'] },
];

const empty = { room_code: '', capacity: '' };
const inputCls = 'w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500';

const Classrooms = () => {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [usePreset, setUsePreset] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/classrooms').then(({ data }) => setRooms(data));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(empty); setEditId(null); setUsePreset(true); setShowForm(true); };
  const startEdit = (r) => { setForm({ room_code: r.room_code, capacity: r.capacity || '' }); setUsePreset(false); setEditId(r.id); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm(empty); };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) await api.put(`/classrooms?id=${editId}`, form);
      else await api.post('/classrooms', form);
      toast.success(editId ? 'Room updated' : 'Room added');
      closeForm(); load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving');
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this room?')) return;
    try {
      await api.delete(`/classrooms?id=${id}`);
      toast.success('Deleted'); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not delete room.'); }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-stretch gap-3">
          <span className="w-1.5 rounded-full bg-[#7B1C1C] shrink-0" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Classrooms</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{rooms.length} room{rooms.length !== 1 ? 's' : ''} registered</p>
          </div>
        </div>
        <button onClick={openAdd}
          className="inline-flex items-center gap-2 bg-[#7B1C1C] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#6a1717] transition shadow-sm self-start">
          <Plus className="w-4 h-4" /> Add Room
        </button>
      </div>

      {/* Room cards */}
      {rooms.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl py-16 text-center shadow-sm">
          <DoorOpen className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 dark:text-gray-500 text-sm">No classrooms yet</p>
          <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">Add your first room using the button above</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {rooms.map(r => (
            <div key={r.id}
              className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[#7B1C1C]/40 transition flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <span className="w-10 h-10 rounded-lg bg-[#7B1C1C]/10 text-[#7B1C1C] dark:bg-[#7B1C1C]/25 dark:text-red-300 flex items-center justify-center shrink-0">
                  <DoorOpen className="w-5 h-5" />
                </span>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(r)} title="Edit"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(r.id)} title="Delete"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-lg font-black text-gray-900 dark:text-white truncate" title={r.room_code}>{r.room_code}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                {r.capacity
                  ? <><Users className="w-3.5 h-3.5" /> {r.capacity} seats</>
                  : <span className="text-gray-300 dark:text-gray-600">No capacity set</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={closeForm}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">{editId ? 'Edit Room' : 'Add New Room'}</h3>
              <button onClick={closeForm} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={save} className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Room Code</label>
                {!editId && (
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input type="radio" checked={usePreset} onChange={() => setUsePreset(true)} className="accent-[#7B1C1C]" /> Select preset
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input type="radio" checked={!usePreset} onChange={() => setUsePreset(false)} className="accent-[#7B1C1C]" /> Custom
                    </label>
                  </div>
                )}
                {usePreset && !editId ? (
                  <select required value={form.room_code} onChange={e => setForm({ ...form, room_code: e.target.value })} className={inputCls}>
                    <option value="">— Select room —</option>
                    {PRESET_ROOMS.map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.rooms.map(r => <option key={r} value={r}>{r}</option>)}
                      </optgroup>
                    ))}
                  </select>
                ) : (
                  <input required value={form.room_code} onChange={e => setForm({ ...form, room_code: e.target.value })}
                    className={inputCls} placeholder="e.g. Rm 1, Rm 1A, SPORT" />
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Capacity <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="number" min="0" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })}
                  className={inputCls} placeholder="40" />
              </div>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={closeForm}
                  className="flex-1 px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-5 py-2.5 text-sm bg-[#7B1C1C] text-white rounded-lg font-semibold hover:bg-[#6a1717] disabled:opacity-60 transition">
                  {saving ? 'Saving…' : editId ? 'Update Room' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Classrooms;
