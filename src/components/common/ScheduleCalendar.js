import React from 'react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const TIMES = [
  '7:30 AM','8:30 AM','9:30 AM','10:30 AM','11:30 AM',
  '12:30 PM','1:30 PM','2:30 PM','3:30 PM','4:30 PM',
  '5:30 PM','6:30 PM','7:00 PM',
];
const TIME_VALUES = [
  '07:30','08:30','09:30','10:30','11:30',
  '12:30','13:30','14:30','15:30','16:30',
  '17:30','18:30','19:00',
];

const progColor = (sectionName = '') => {
  if (sectionName.startsWith('BPED'))  return 'bg-blue-100 border-l-4 border-blue-500 text-blue-900';
  if (sectionName.startsWith('BECED')) return 'bg-green-100 border-l-4 border-green-500 text-green-900';
  if (sectionName.startsWith('BCAED')) return 'bg-purple-100 border-l-4 border-purple-500 text-purple-900';
  return 'bg-gray-100 border-l-4 border-gray-400 text-gray-800';
};

// Last TIME_VALUE <= timeStr
const getSlotIndex = (timeStr) => {
  const t = (timeStr || '').slice(0, 5);
  if (!t) return -1;
  let idx = -1;
  for (let i = 0; i < TIME_VALUES.length; i++) {
    if (TIME_VALUES[i] <= t) idx = i;
    else break;
  }
  return idx;
};

// Last TIME_VALUE < timeStr (last row the event occupies)
const getEndSlotIndex = (timeStr) => {
  const t = (timeStr || '').slice(0, 5);
  if (!t) return -1;
  let idx = -1;
  for (let i = 0; i < TIME_VALUES.length; i++) {
    if (TIME_VALUES[i] < t) idx = i;
    else break;
  }
  return idx < 0 ? 0 : idx;
};

const ScheduleCalendar = ({ schedules = [], loading = false }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        <span className="w-5 h-5 border-2 border-gray-300 border-t-[#7B1C1C] rounded-full animate-spin mr-2" />
        Loading schedule...
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl flex items-center justify-center py-16 text-gray-400 text-sm">
        No schedules found.
      </div>
    );
  }

  // Group events by day + start slot so they can share a cell and span the same rows
  const groups = {};
  schedules.forEach(s => {
    const dayIdx = DAYS.indexOf(s.day_of_week);
    const startIdx = getSlotIndex(s.time_start);
    if (dayIdx === -1 || startIdx === -1) return;
    const key = `${dayIdx}_${startIdx}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
      style={{
        display: 'grid',
        gridTemplateColumns: '64px repeat(7, minmax(0,1fr))',
        gridTemplateRows: `auto repeat(${TIMES.length}, 52px)`,
      }}
    >
      {/* Header row */}
      <div className="border-r border-b bg-gray-50" style={{ gridRow: 1, gridColumn: 1 }} />
      {DAYS.map((d, i) => (
        <div
          key={d}
          className={`border-b bg-gray-50 text-center py-2 text-xs font-bold text-gray-500 uppercase tracking-wider${i < 6 ? ' border-r' : ''}`}
          style={{ gridRow: 1, gridColumn: i + 2 }}
        >
          {d.slice(0, 3)}
        </div>
      ))}

      {/* Time labels */}
      {TIMES.map((time, rowIdx) => (
        <div
          key={`t${rowIdx}`}
          className="border-r border-b px-2 pt-1 text-right text-xs text-gray-400 font-medium whitespace-nowrap"
          style={{ gridRow: rowIdx + 2, gridColumn: 1 }}
        >
          {time}
        </div>
      ))}

      {/* Background grid cells */}
      {TIMES.map((_, rowIdx) =>
        DAYS.map((__, dayIdx) => (
          <div
            key={`bg${rowIdx}-${dayIdx}`}
            className={`border-b${dayIdx < 6 ? ' border-r' : ''}`}
            style={{ gridRow: rowIdx + 2, gridColumn: dayIdx + 2 }}
          />
        ))
      )}

      {/* Events — spanning rows based on duration */}
      {Object.entries(groups).map(([key, events]) => {
        const [dayIdx, startIdx] = key.split('_').map(Number);
        const endIdx = Math.max(...events.map(s => getEndSlotIndex(s.time_end)));
        const span = Math.max(1, endIdx - startIdx + 1);

        return (
          <div
            key={key}
            style={{
              gridRow: `${startIdx + 2} / span ${span}`,
              gridColumn: dayIdx + 2,
              padding: '2px',
              zIndex: 2,
              minWidth: 0,
            }}
          >
            {events.length === 1 ? (() => {
              const s = events[0];
              const isConflict = s.conflicts?.length > 0;
              return (
                <div className={`rounded text-xs p-1.5 h-full leading-tight relative${isConflict ? ' bg-red-100 border-l-4 border-red-500 text-red-900' : ' ' + progColor(s.section_name)}`}>
                  {isConflict && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
                  <div className="font-bold truncate">{s.subject_code}</div>
                  <div className="opacity-80 truncate text-[10px] mt-0.5">{s.section_name}</div>
                  <div className="opacity-60 truncate text-[10px]">{s.room_code}</div>
                  <div className="opacity-60 truncate text-[10px]">{s.time_start} – {s.time_end}</div>
                  {isConflict && <div className="text-red-600 text-[10px] font-semibold mt-0.5">⚠ Conflict</div>}
                </div>
              );
            })() : (
              <div className="flex gap-0.5 h-full">
                {events.map(s => (
                  <div key={s.id} className="flex-1 rounded text-xs p-1 bg-red-100 border-l-2 border-red-500 text-red-900 leading-tight">
                    <div className="font-bold" style={{ fontSize: '9px' }}>{s.subject_code}</div>
                    <div style={{ fontSize: '9px' }} className="opacity-80">{s.section_name}</div>
                    <div className="text-red-600 font-semibold" style={{ fontSize: '9px' }}>⚠</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ScheduleCalendar;
