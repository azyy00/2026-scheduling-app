import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import EventsSection from '../../components/common/EventsSection';

const CARD_COLORS = [
  { bg: 'from-violet-600 to-purple-700', light: 'bg-violet-50 dark:bg-violet-950/35', border: 'border-violet-200 dark:border-violet-800/60', badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100' },
  { bg: 'from-rose-500 to-pink-600',     light: 'bg-rose-50 dark:bg-rose-950/35',     border: 'border-rose-200 dark:border-rose-800/60',     badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-100' },
  { bg: 'from-amber-500 to-orange-600',  light: 'bg-amber-50 dark:bg-amber-950/35',   border: 'border-amber-200 dark:border-amber-800/60',   badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100' },
  { bg: 'from-cyan-500 to-blue-600',     light: 'bg-cyan-50 dark:bg-cyan-950/35',     border: 'border-cyan-200 dark:border-cyan-800/60',     badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-100' },
  { bg: 'from-emerald-500 to-teal-600',  light: 'bg-emerald-50 dark:bg-emerald-950/35',border: 'border-emerald-200 dark:border-emerald-800/60',badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100' },
];

const fmtDay   = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
const fmtNum   = (d) => new Date(d + 'T00:00:00').getDate();
const fmtMonth = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

const daysUntil = (d) => {
  const diff = Math.ceil((new Date(d + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return { label: '🔥 Today!', urgent: true };
  if (diff === 1) return { label: '⏰ Tomorrow', urgent: true };
  if (diff < 0)  return { label: `${Math.abs(diff)}d ago`, urgent: false, past: true };
  if (diff <= 7) return { label: `In ${diff} days`, urgent: true };
  return { label: `In ${diff} days`, urgent: false };
};

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/events').then(({ data }) => setEvents(data)).finally(() => setLoading(false));
  }, []);

  const upcoming = events.filter(ev => {
    const diff = Math.ceil((new Date(ev.event_date?.slice(0,10) + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 86400000);
    return diff >= 0;
  });
  const past = events.filter(ev => {
    const diff = Math.ceil((new Date(ev.event_date?.slice(0,10) + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 86400000);
    return diff < 0;
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">School Events</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{events.length} event{events.length !== 1 ? 's' : ''} total</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#7B1C1C] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 ? (
            <EventsSection events={upcoming} title="Upcoming Events" />
          ) : (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500 shadow-sm mb-6">
              No upcoming events scheduled.
            </div>
          )}

          {/* Past events */}
          {past.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                <span>🗂</span> Past Events
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {past.map((ev, i) => {
                  const color = CARD_COLORS[i % CARD_COLORS.length];
                  const d = ev.event_date?.slice(0, 10);
                  const { label } = daysUntil(d);
                  return (
                    <div key={ev.id} className={`rounded-2xl overflow-hidden shadow-sm border ${color.border} ${color.light} flex opacity-60`}>
                      <div className={`bg-gradient-to-br ${color.bg} flex flex-col items-center justify-center px-4 py-5 min-w-[72px] text-white shrink-0`}>
                        <p className="text-[11px] font-bold tracking-widest opacity-80">{fmtDay(d)}</p>
                        <p className="text-3xl font-black leading-none my-1">{fmtNum(d)}</p>
                        <p className="text-[10px] font-semibold opacity-80 text-center leading-tight">{fmtMonth(d)}</p>
                      </div>
                      <div className="flex flex-col justify-center px-4 py-4 flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-700 dark:text-gray-200 leading-tight truncate">{ev.title}</p>
                        {ev.description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">{ev.description}</p>}
                        <span className="mt-2 inline-flex self-start text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          {label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Events;
