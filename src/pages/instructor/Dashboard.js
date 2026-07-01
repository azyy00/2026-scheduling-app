import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import ScheduleCalendar from '../../components/common/ScheduleCalendar';
import EventsSection from '../../components/common/EventsSection';
import { BookOpen, CalendarCheck2, MapPin, AlertTriangle, ListOrdered } from 'lucide-react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const StatSeg = ({ icon: Icon, label, value, tone = 'info', alert = false, sublabel }) => {
  const chip = tone === 'conflict'
    ? (alert ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400')
    : 'bg-[#7B1C1C]/10 text-[#7B1C1C] dark:bg-[#7B1C1C]/30 dark:text-red-300';
  const numCls = alert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white';
  return (
    <div className={`p-4 sm:p-5 transition-colors ${alert ? 'bg-red-50/70 dark:bg-red-900/15' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 leading-tight">{label}</p>
        <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${chip}`}>
          {tone === 'conflict' && !alert ? <CheckIcon /> : <Icon className="w-4 h-4" />}
        </span>
      </div>
      <p className={`text-2xl sm:text-[2rem] leading-none font-black tabular-nums mt-2 sm:mt-3 ${numCls}`}>{value}</p>
      {tone === 'conflict' ? (
        alert ? (
          <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold text-red-600 dark:text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Needs review
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckIcon /> All clear
          </span>
        )
      ) : (
        sublabel && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">{sublabel}</p>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSemester, setFilterSemester] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  useEffect(() => {
    api.get('/misc?action=instructor-schedules')
      .then(({ data }) => setSchedules(data))
      .finally(() => setLoading(false));
    api.get('/events?upcoming=1').then(({ data }) => setUpcomingEvents(data)).catch(() => {});
  }, []);

  const allSections = [...new Set(schedules.map(s => s.section_name).filter(Boolean))].sort();
  const filteredSections = allSections.filter(name => {
    if (filterYear && !name.includes(`-${filterYear}`)) return false;
    return true;
  });

  const filtered = schedules.filter(s => {
    if (filterSemester && s.semester !== filterSemester) return false;
    if (filterYear && !s.section_name?.includes(`-${filterYear}`)) return false;
    if (filterSection && s.section_name !== filterSection) return false;
    return true;
  });
  const totalConflicts = filtered.filter(s => s.conflicts?.length > 0).length;
  const uniqueDays = [...new Set(filtered.map(s => s.day_of_week))].length;

  const byDay = DAYS.reduce((acc, d) => {
    const rows = filtered.filter(s => s.day_of_week === d).sort((a, b) => a.time_start.localeCompare(b.time_start));
    if (rows.length) acc[d] = rows;
    return acc;
  }, {});

  const selectCls = 'border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-5 gap-4">
        <div className="flex items-stretch gap-3">
          <span className="w-1.5 rounded-full bg-[#7B1C1C] shrink-0" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">My Schedule</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{user?.name} · Instructor</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)} className={selectCls}>
            <option value="">All Semesters</option>
            <option value="1st">1st Semester</option>
            <option value="2nd">2nd Semester</option>
            <option value="Summer">Summer</option>
          </select>
          <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterSection(''); }} className={selectCls}>
            <option value="">All Year Levels</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className={selectCls}>
            <option value="">All Sections</option>
            {filteredSections.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <EventsSection events={upcomingEvents} title="Upcoming Events" />
      )}

      {/* Stat console */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden mb-6">
        <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800">
          <StatSeg icon={BookOpen} label="Total Classes" value={filtered.length} sublabel="this term" />
          <StatSeg icon={CalendarCheck2} label="Days w/ Classes" value={uniqueDays} sublabel="per week" />
          <StatSeg icon={AlertTriangle} label="Conflicts" value={totalConflicts} tone="conflict" alert={totalConflicts > 0} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 flex-wrap">
        {[['bg-pink-500','BPED'],['bg-amber-500','BECED'],['bg-orange-500','BCAED'],['bg-red-500','Conflict']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span className={`w-3 h-3 rounded ${c}`} />{l}
          </span>
        ))}
      </div>

      {/* Calendar */}
      <ScheduleCalendar schedules={filtered} loading={loading} />

      {/* Schedule List View */}
      {!loading && filtered.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-gray-400" />
            Schedule List
          </h2>
          <div className="flex flex-col gap-4">
            {Object.entries(byDay).map(([day, rows]) => (
              <div key={day} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <span className={`w-2.5 h-2.5 rounded-full ${day === todayName ? 'bg-[#7B1C1C]' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{day}</span>
                  {day === todayName && <span className="text-[10px] font-bold uppercase tracking-wide text-[#7B1C1C] dark:text-red-300">Today</span>}
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-medium">{rows.length} class{rows.length > 1 ? 'es' : ''}</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((s, idx) => {
                    const isConflict = s.conflicts?.length > 0;
                    return (
                      <div key={s.id} className={`flex items-center gap-3 sm:gap-4 px-4 py-3 text-sm transition ${isConflict ? 'bg-red-50 dark:bg-red-900/15' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                        <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                        <div className="w-28 sm:w-32 shrink-0">
                          <span className={`text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap ${isConflict ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-[#7B1C1C]/10 text-[#7B1C1C] dark:bg-[#7B1C1C]/30 dark:text-red-300'}`}>
                            {fmtTime(s.time_start)} – {fmtTime(s.time_end)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{s.subject_code}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{s.subject_name}</p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0 text-center hidden sm:block">{s.section_name}</p>
                        <div className="items-center gap-1 text-xs text-gray-500 dark:text-gray-400 shrink-0 hidden md:flex">
                          <MapPin className="w-3.5 h-3.5" />
                          {s.room_code}
                        </div>
                        {isConflict && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 shrink-0">
                            <AlertTriangle className="w-3 h-3" /> Conflict
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
