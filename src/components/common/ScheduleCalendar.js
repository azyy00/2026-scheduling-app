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
  if (sectionName.startsWith('BCAED'))return 'bg-purple-100 border-l-4 border-purple-500 text-purple-900';
  return 'bg-gray-100 border-l-4 border-gray-400 text-gray-800';
};

const getSlotIndex = (timeStart) => TIME_VALUES.indexOf((timeStart || '').slice(0, 5));

const ScheduleCalendar = ({ schedules = [], loading = false }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        Loading schedule...
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
        No schedules found.
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      {/* Day headers */}
      <div className="grid border-b bg-gray-50" style={{ gridTemplateColumns: '64px repeat(7, minmax(0,1fr))' }}>
        <div className="border-r px-2 py-2" />
        {DAYS.map(d => (
          <div key={d} className="border-r last:border-r-0 text-center py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {d.slice(0, 3)}
          </div>
        ))}
      </div>

      {/* Time rows */}
      {TIMES.map((time, rowIdx) => (
        <div key={time} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: '64px repeat(7, minmax(0,1fr))', minHeight: '52px' }}>
          <div className="border-r px-2 pt-1 text-right text-xs text-gray-400 font-medium whitespace-nowrap">
            {time}
          </div>
          {DAYS.map((day) => {
            const items = schedules.filter(s => s.day_of_week === day && getSlotIndex(s.time_start) === rowIdx);
            return (
              <div key={day} className="border-r last:border-r-0 p-1 relative">
                {items.length === 0 ? null : items.length === 1 ? (
                  <div className={`rounded text-xs p-1.5 h-full leading-tight relative ${items[0].conflicts?.length ? 'bg-red-100 border-l-4 border-red-500 text-red-900' : progColor(items[0].section_name)}`}>
                    {items[0].conflicts?.length > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" title={items[0].conflicts.join(', ')} />
                    )}
                    <div className="font-semibold truncate">{items[0].subject_code}</div>
                    <div className="opacity-80 truncate text-[10px]">{items[0].section_name}</div>
                    <div className="opacity-60 truncate text-[10px]">{items[0].room_code}</div>
                    <div className="opacity-60 truncate text-[10px]">{items[0].time_start} – {items[0].time_end}</div>
                    {items[0].conflicts?.length > 0 && (
                      <div className="text-red-600 text-[10px] font-medium">⚠ Conflict</div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-0.5 h-full">
                    {items.map(s => (
                      <div key={s.id} className="flex-1 rounded text-xs p-1 bg-red-100 border-l-2 border-red-500 text-red-900 leading-tight">
                        <div className="font-semibold" style={{ fontSize: '9px' }}>{s.subject_code}</div>
                        <div style={{ fontSize: '9px' }} className="opacity-80">{s.section_name}</div>
                        <div className="text-red-600 font-medium" style={{ fontSize: '9px' }}>⚠ Conflict</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default ScheduleCalendar;
