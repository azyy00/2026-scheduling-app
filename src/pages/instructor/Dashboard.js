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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">My Schedule</h2>
          <p className="text-sm text-gray-400 mt-0.5">{user?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {totalConflicts > 0 && (
            <span className="text-sm bg-red-100 text-red-600 border border-red-200 px-3 py-1 rounded-full font-medium">
              ⚠ {totalConflicts} conflict{totalConflicts > 1 ? 's' : ''} detected
            </span>
          )}
          <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="">All Semesters</option>
            <option value="1st">1st Semester</option>
            <option value="2nd">2nd Semester</option>
            <option value="Summer">Summer</option>
          </select>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">{filtered.length}</p>
          <p className="text-xs text-gray-400 mt-1">Total Classes</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-800">
            {[...new Set(filtered.map(s => s.day_of_week))].length}
          </p>
          <p className="text-xs text-gray-400 mt-1">Days with Classes</p>
        </div>
        <div className={`border rounded-xl p-4 text-center ${totalConflicts > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
          <p className={`text-2xl font-bold ${totalConflicts > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {totalConflicts > 0 ? totalConflicts : '✓'}
          </p>
          <p className={`text-xs mt-1 ${totalConflicts > 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {totalConflicts > 0 ? 'Conflicts' : 'No Conflicts'}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />BPED</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />BECED</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" />BCAED</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Conflict</span>
      </div>

      <ScheduleCalendar schedules={filtered} loading={loading} />
    </div>
  );
};

export default Dashboard;
