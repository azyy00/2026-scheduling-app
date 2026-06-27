import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const dayColors = {
  Monday:    'bg-blue-600',
  Tuesday:   'bg-indigo-600',
  Wednesday: 'bg-violet-600',
  Thursday:  'bg-emerald-600',
  Friday:    'bg-amber-600',
  Saturday:  'bg-rose-600',
};

const fmt = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
};

const Schedule = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/misc?action=student-schedules').then(({ data }) => setSchedules(data)).finally(() => setLoading(false));
  }, []);

  const byDay = days.reduce((acc, d) => {
    acc[d] = schedules.filter(s => s.day_of_week === d).sort((a, b) => a.time_start.localeCompare(b.time_start));
    return acc;
  }, {});

  const total = schedules.length;
  const activeDays = days.filter(d => byDay[d].length > 0).length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-[#7B1C1C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Class Schedule</h1>
        <p className="text-sm text-gray-500 mt-1">
          {user?.name}
          {user?.section_name && <span className="mx-1.5 text-gray-300">·</span>}
          {user?.section_name}
          {user?.year_level && <><span className="mx-1.5 text-gray-300">·</span>Year {user.year_level}</>}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Classes', value: total, icon: '📚' },
          { label: 'Days with Classes', value: activeDays, icon: '📅' },
          { label: 'Free Days', value: 6 - activeDays, icon: '☀️' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm flex items-center gap-4">
            <span className="text-2xl">{icon}</span>
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Day cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {days.map(day => (
          <div key={day} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className={`${dayColors[day]} px-4 py-3 flex items-center justify-between`}>
              <p className="text-white font-bold text-sm">{day}</p>
              {byDay[day].length > 0 && (
                <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                  {byDay[day].length} class{byDay[day].length > 1 ? 'es' : ''}
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {byDay[day].length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <p className="text-xs text-gray-400">No classes</p>
                </div>
              ) : byDay[day].map(s => (
                <div key={s.id} className="px-4 py-3.5 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm text-gray-900">{s.subject_code}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.subject_name}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[#7B1C1C] bg-red-50 px-2 py-0.5 rounded-md">
                      {fmt(s.time_start)} – {fmt(s.time_end)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                      </svg>
                      {s.room_code}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {s.instructor_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Schedule;
