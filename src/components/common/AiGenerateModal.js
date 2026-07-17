import React, { useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { notifyBus } from '../../utils/notificationBus';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const inputCls = 'w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 transition';

// Gemini-powered schedule generator. Self-contained: manages its own request state.
// Props: open, onClose, sections, subjects, schoolYear, semester, onApplied()
const AiGenerateModal = ({ open, onClose, sections = [], subjects = [], schoolYear, semester, onApplied }) => {
  const [form, setForm] = useState({ section_id: '', subject_ids: [], days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], day_start: '07:30', day_end: '17:00', slot_minutes: 60 });
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposal, setProposal] = useState(null);

  if (!open) return null;

  const toggleSubject = (id) => setForm(f => ({ ...f, subject_ids: f.subject_ids.includes(id) ? f.subject_ids.filter(x => x !== id) : [...f.subject_ids, id] }));
  const toggleDay = (d) => setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] }));

  const close = () => { if (!loading && !applying) { setProposal(null); onClose(); } };

  const generate = async () => {
    if (!form.section_id) return toast.error('Select a section.');
    if (form.subject_ids.length === 0) return toast.error('Pick at least one subject.');
    if (form.days.length === 0) return toast.error('Pick at least one day.');
    setLoading(true); setProposal(null);
    try {
      const { data } = await api.post('/schedules?action=ai-generate', { ...form, semester, school_year: schoolYear });
      setProposal(data);
      if (!data.proposal?.length) toast.error('The AI could not place any classes. Try a wider time window or fewer subjects.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI generation failed.', { duration: 6000 });
    } finally { setLoading(false); }
  };

  const apply = async () => {
    const clear = (proposal?.proposal || []).filter(e => !e.conflict?.length);
    if (clear.length === 0) return toast.error('No conflict-free classes to apply.');
    setApplying(true);
    try {
      const { data } = await api.post('/schedules?action=ai-apply', { entries: clear });
      toast.success(data.message);
      notifyBus.push({ type: 'success', title: 'AI Schedule Applied', body: data.message });
      setProposal(null);
      onApplied && onApplied();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not apply the schedule.');
    } finally { setApplying(false); }
  };

  const clearCount = proposal ? proposal.proposal.filter(e => !e.conflict?.length).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={close}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800 flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#7B1C1C]/10 text-[#7B1C1C] dark:bg-[#7B1C1C]/25 dark:text-red-300 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </span>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">AI Schedule Generator</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">Gemini builds a conflict-free weekly timetable · {schoolYear} · {semester} Sem</p>
            </div>
          </div>
          <button onClick={close} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Section</label>
              <select value={form.section_id} onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))} className={inputCls}>
                <option value="">Select a section</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Class start (earliest)</label>
              <input type="time" value={form.day_start} onChange={e => setForm(f => ({ ...f, day_start: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Class end (latest)</label>
              <input type="time" value={form.day_end} onChange={e => setForm(f => ({ ...f, day_end: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Minutes per class</label>
              <input type="number" min="30" step="15" value={form.slot_minutes} onChange={e => setForm(f => ({ ...f, slot_minutes: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Days</label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map(d => (
                  <button key={d} type="button" onClick={() => toggleDay(d)}
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition ${form.days.includes(d) ? 'bg-[#7B1C1C] text-white border-[#7B1C1C]' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
              Subjects to schedule <span className="text-gray-400 font-normal">({form.subject_ids.length} selected · one meeting each)</span>
            </label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {subjects.length === 0 && <p className="text-xs text-gray-400 px-3 py-3">No subjects yet — add some first.</p>}
              {subjects.map(s => (
                <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <input type="checkbox" checked={form.subject_ids.includes(s.id)} onChange={() => toggleSubject(s.id)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-[#7B1C1C] focus:ring-[#7B1C1C]/30" />
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{s.code}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <button onClick={generate} disabled={loading}
              className="inline-flex items-center gap-2 bg-[#7B1C1C] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#6a1717] transition disabled:opacity-60">
              {loading ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating…</> : <>Generate with Gemini</>}
            </button>
          </div>

          {proposal && (
            <div className="mt-5 border-t border-gray-100 dark:border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">Proposed schedule ({proposal.proposal.length})</h4>
                <div className="flex items-center gap-2">
                  {proposal.proposal.some(e => e.conflict?.length > 0) && (
                    <span className="text-[11px] font-semibold text-amber-600">{proposal.proposal.filter(e => e.conflict?.length).length} with conflicts (skipped)</span>
                  )}
                  {proposal.usage && (
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">{proposal.usage.total} tokens</span>
                  )}
                </div>
              </div>
              {proposal.missing?.length > 0 && (
                <p className="text-[11px] text-amber-600 mb-2">Could not place: {proposal.missing.join(', ')}. Try a wider time window.</p>
              )}
              <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2 font-bold">Subject</th><th className="px-3 py-2 font-bold">Day</th>
                      <th className="px-3 py-2 font-bold">Time</th><th className="px-3 py-2 font-bold">Instructor</th><th className="px-3 py-2 font-bold">Room</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {proposal.proposal.map((e, i) => (
                      <tr key={i} className={e.conflict?.length ? 'bg-red-50/60 dark:bg-red-900/15' : ''}>
                        <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-100">
                          {e.subject_code}
                          {e.conflict?.length > 0 && <span className="ml-1.5 text-[10px] font-bold text-red-600">⚠ {e.conflict.join('/')}</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.day_of_week.slice(0, 3)}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{e.time_start}–{e.time_end}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[120px]">{e.instructor_name}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{e.room_code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
          <button onClick={close} className="px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">Close</button>
          {proposal && (
            <button onClick={apply} disabled={applying || clearCount === 0}
              className="px-5 py-2.5 text-sm bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-60">
              {applying ? 'Applying…' : `Apply ${clearCount} clear class(es)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiGenerateModal;
