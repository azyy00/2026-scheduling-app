import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import ScheduleCalendar from '../../components/common/ScheduleCalendar';

const Dashboard = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSemester, setFilterSemester] = useState('');

  useEffect(() => {
    api.get('/misc?action=instructor-schedules')
      .then(({ data }) => setSchedules(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = schedules.filter(s => !filterSemester || s.semester === filterSemester);
  const totalConflicts = filtered.filter(s => s.conflicts?.length > 0).length;
  const uniqueDays = [...new Set(filtered.map(s => s.day_of_week))].length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">{user?.name} · Instructor</p>
        </div>
        <div className="flex items-center gap-3">
          {totalConflicts > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {totalConflicts} conflict{totalConflicts > 1 ? 's' : ''} detected
            </div>
          )}
          <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]">
            <option value="">All Semesters</option>
            <option value="1st">1st Semester</option>
            <option value="2nd">2nd Semester</option>
            <option value="Summer">Summer</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Classes', value: filtered.length, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Days with Classes', value: uniqueDays, color: 'text-gray-900', bg: 'bg-white' },
          {
            label: totalConflicts > 0 ? 'Conflicts' : 'No Conflicts',
            value: totalConflicts > 0 ? totalConflicts : '✓',
            color: totalConflicts > 0 ? 'text-red-600' : 'text-emerald-600',
            bg: totalConflicts > 0 ? 'bg-red-50 border-red-200' : 'bg-white',
          },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} border border-gray-200 rounded-xl px-5 py-4 shadow-sm`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4">
        {[['bg-blue-500','BPED'],['bg-green-500','BECED'],['bg-purple-500','BCAED'],['bg-red-500','Conflict']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <span className={`w-3 h-3 rounded ${c}`} />{l}
          </span>
        ))}
      </div>

      <ScheduleCalendar schedules={filtered} loading={loading} />
    </div>
  );
};

export default Dashboard;
