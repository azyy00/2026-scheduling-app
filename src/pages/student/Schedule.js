import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const Schedule = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/misc?action=student-schedules').then(({ data }) => setSchedules(data)).finally(() => setLoading(false));
  }, []);

  const byDay = days.reduce((acc, d) => {
    acc[d] = schedules.filter(s => s.day_of_week === d);
    return acc;
  }, {});

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">My Class Schedule</h2>
        <p className="text-sm text-gray-500 mt-1">
          {user?.name} · {user?.section_name} · {user?.year_level && `Year ${user.year_level}`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {days.map(day => (
          <div key={day} className="bg-white rounded-xl border overflow-hidden shadow-sm">
            <div className="bg-blue-600 text-white px-4 py-2 font-semibold text-sm">{day}</div>
            <div className="divide-y">
              {byDay[day].length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-400">No classes</p>
              ) : byDay[day].map(s => (
                <div key={s.id} className="px-4 py-3">
                  <p className="font-medium text-sm">{s.subject_code}</p>
                  <p className="text-xs text-gray-600">{s.subject_name}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.time_start} – {s.time_end}</p>
                  <p className="text-xs text-gray-400">{s.room_code} · {s.instructor_name}</p>
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
