import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import ScheduleCalendar from '../../components/common/ScheduleCalendar';
import { InstructorCardSkeleton, CalendarSkeleton } from '../../components/common/Skeleton';

const PROGRAMS = ['BPED','BECED','BCAED'];

const progBadge = (dept) => {
  const map = { BPED: 'bg-blue-100 text-blue-700', BECED: 'bg-green-100 text-green-700', BCAED: 'bg-purple-100 text-purple-700' };
  return map[dept] || 'bg-gray-100 text-gray-600';
};

const InstructorSchedule = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [instructor, setInstructor] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSemester, setFilterSemester] = useState('');
  const [filterSchoolYear, setFilterSchoolYear] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/instructors/${id}`),
      api.get(`/schedules?instructor_id=${id}`),
    ]).then(([inst, sched]) => {
      setInstructor(inst.data);
      setSchedules(sched.data);
    }).finally(() => setLoading(false));
  }, [id]);

  const filtered = schedules.filter(s => {
    if (filterSemester && s.semester !== filterSemester) return false;
    if (filterSchoolYear && s.school_year !== filterSchoolYear) return false;
    return true;
  });

  const schoolYears = [...new Set(schedules.map(s => s.school_year).filter(Boolean))];
  const totalConflicts = filtered.filter(s => s.conflicts?.length > 0).length;

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/instructors')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5 transition"
      >
        ← Back to Instructors
      </button>

      {/* Instructor info card */}
      {loading && <InstructorCardSkeleton />}
      {!loading && instructor && (
        <div className="bg-white border rounded-xl p-5 mb-5 flex items-center gap-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
            style={{ background: '#7B1C1C' }}>
            {instructor.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-800">{instructor.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{instructor.position || ''}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${progBadge(instructor.department)}`}>
                {instructor.department || 'No dept.'}
              </span>
              {instructor.username && <span className="text-xs text-gray-400">@{instructor.username}</span>}
            </div>
          </div>
          {/* Mini stats */}
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-gray-800">{filtered.length}</p>
              <p className="text-xs text-gray-400">Classes</p>
            </div>
            {totalConflicts > 0 && (
              <div>
                <p className="text-xl font-bold text-red-500">{totalConflicts}</p>
                <p className="text-xs text-gray-400">Conflicts</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-base font-semibold text-gray-700">
          Schedule Calendar
          {totalConflicts > 0 && (
            <span className="ml-2 text-xs bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
              ⚠ {totalConflicts} conflict{totalConflicts > 1 ? 's' : ''}
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value="">All Semesters</option>
            <option value="1st">1st Semester</option>
            <option value="2nd">2nd Semester</option>
            <option value="Summer">Summer</option>
          </select>
          {schoolYears.length > 0 && (
            <select value={filterSchoolYear} onChange={e => setFilterSchoolYear(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-white">
              <option value="">All School Years</option>
              {schoolYears.map(y => <option key={y}>{y}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />BPED</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />BECED</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" />BCAED</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />Conflict</span>
      </div>

      {loading ? <CalendarSkeleton /> : <ScheduleCalendar schedules={filtered} loading={false} />}
    </div>
  );
};

export default InstructorSchedule;
