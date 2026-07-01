import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tag, User, DoorClosed, CalendarDays, Clock, AlertTriangle, X, Pencil, Trash2, Plus, Download, Printer } from 'lucide-react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const TIMES = [
  '7:30','8:00','8:30','9:00','9:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','1:00','1:30','2:00','2:30','3:00','3:30','4:00',
  '4:30','5:00','5:30','6:00','6:30','7:00',
];
const TIME_VALUES = [
  '07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00',
  '16:30','17:00','17:30','18:00','18:30','19:00',
];

const DEFAULT_DAY_WIDTH = 300;
const DEFAULT_ROW_HEIGHT = 42;
const MIN_DAY_WIDTH = 120;
const MAX_DAY_WIDTH = 520;
const MIN_ROW_HEIGHT = 26;
const MAX_ROW_HEIGHT = 72;

const isOnHour = (t) => t.endsWith(':00');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const defaultDayWidths = () => DAYS.map(() => DEFAULT_DAY_WIDTH);

const defaultRowHeights = () => TIMES.map(() => DEFAULT_ROW_HEIGHT);

const sum = (values) => values.reduce((total, value) => total + value, 0);

const sumRange = (values, start, count) => values
  .slice(start, start + count)
  .reduce((total, value) => total + value, 0);

const progStyle = (sectionName = '') => {
  if (sectionName.startsWith('BPED'))  return { wrap: 'bg-pink-100 border-l-[5px] border-pink-500 ring-1 ring-pink-300/60 dark:bg-pink-500/25 dark:border-pink-400 dark:ring-pink-400/40',    text: 'text-pink-900 dark:text-pink-50' };
  if (sectionName.startsWith('BECED')) return { wrap: 'bg-amber-100 border-l-[5px] border-amber-500 ring-1 ring-amber-300/60 dark:bg-amber-500/25 dark:border-amber-400 dark:ring-amber-400/40', text: 'text-amber-900 dark:text-amber-50' };
  if (sectionName.startsWith('BCAED')) return { wrap: 'bg-orange-100 border-l-[5px] border-orange-500 ring-1 ring-orange-300/60 dark:bg-orange-500/25 dark:border-orange-400 dark:ring-orange-400/40', text: 'text-orange-900 dark:text-orange-50' };
  return { wrap: 'bg-gray-100 border-l-[5px] border-gray-400 ring-1 ring-gray-300/60 dark:bg-gray-600/40 dark:border-gray-400 dark:ring-gray-500/40', text: 'text-gray-800 dark:text-gray-100' };
};

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const getSectionLabel = (s = {}) => s.section_name || s.section || s.year_section || '';

const getTimeRange = (s = {}) => (
  s.time_start ? `${fmtTime(s.time_start)} - ${fmtTime(s.time_end)}` : ''
);

const htmlEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

const exportAccent = (s) => {
  if (s.conflicts?.length > 0) return { bg: '#fee2e2', border: '#ef4444', text: '#7f1d1d' };
  const n = getSectionLabel(s);
  if (n.startsWith('BPED')) return { bg: '#fce7f3', border: '#ec4899', text: '#831843' };
  if (n.startsWith('BECED')) return { bg: '#fef3c7', border: '#f59e0b', text: '#78350f' };
  if (n.startsWith('BCAED')) return { bg: '#ffedd5', border: '#f97316', text: '#7c2d12' };
  return { bg: '#f3f4f6', border: '#9ca3af', text: '#1f2937' };
};

const hexToRgb = (hex) => {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
};

const setPdfColor = (doc, method, color) => {
  doc[method](...hexToRgb(color));
};

const truncatePdfText = (doc, text, maxWidth) => {
  const value = String(text || '');
  if (doc.getTextWidth(value) <= maxWidth) return value;

  let next = value;
  while (next.length > 0 && doc.getTextWidth(`${next}...`) > maxWidth) {
    next = next.slice(0, -1);
  }
  return next ? `${next}...` : '';
};

const toMinutes = (timeStr) => {
  const [h, m] = (timeStr || '').split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const toTimeValue = (minutes) => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = String(Math.floor(normalized / 60)).padStart(2, '0');
  const m = String(normalized % 60).padStart(2, '0');
  return `${h}:${m}`;
};

const addMinutes = (timeStr, minutes) => {
  const base = toMinutes(timeStr);
  return base === null ? '' : toTimeValue(base + minutes);
};

const getSlotIndex = (timeStr) => {
  const t = (timeStr || '').slice(0, 5);
  let idx = -1;
  for (let i = 0; i < TIME_VALUES.length; i++) {
    if (TIME_VALUES[i] <= t) idx = i;
    else break;
  }
  return idx;
};

const getEndSlotIndex = (timeStr) => {
  const t = (timeStr || '').slice(0, 5);
  let idx = -1;
  for (let i = 0; i < TIME_VALUES.length; i++) {
    if (TIME_VALUES[i] < t) idx = i;
    else break;
  }
  return idx < 0 ? 0 : idx;
};

const sectionAccent = (s) => {
  if (s.conflicts?.length > 0) return { border: 'border-red-500',    icon: 'text-red-500',    text: 'text-red-600 dark:text-red-400' };
  const n = getSectionLabel(s);
  if (n.startsWith('BPED'))  return { border: 'border-pink-500',   icon: 'text-pink-500',   text: 'text-pink-700 dark:text-pink-300' };
  if (n.startsWith('BECED')) return { border: 'border-yellow-500', icon: 'text-yellow-600', text: 'text-yellow-700 dark:text-yellow-300' };
  if (n.startsWith('BCAED')) return { border: 'border-orange-500', icon: 'text-orange-500', text: 'text-orange-700 dark:text-orange-300' };
  return { border: 'border-gray-400', icon: 'text-gray-500', text: 'text-gray-600 dark:text-gray-400' };
};

const detailRows = (s) => [
  { Icon: Tag,          label: 'Section',    value: getSectionLabel(s) },
  { Icon: User,         label: 'Instructor', value: s.instructor_name },
  { Icon: DoorClosed,   label: 'Room',       value: s.room_code },
  { Icon: CalendarDays, label: 'Day',        value: s.day_of_week },
  { Icon: Clock,        label: 'Time',       value: s.time_start ? `${fmtTime(s.time_start)} – ${fmtTime(s.time_end)}` : null },
];

// Full-info modal shown on click — portaled to body so it escapes the grid's stacking context
const ScheduleModal = ({ s, onClose, onEdit, onDelete }) => {
  if (!s) return null;
  const a = sectionAccent(s);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden border-t-4 ${a.border}`}
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-3">
          <div>
            <p className={`text-base font-black ${a.text}`}>{s.subject_code}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.subject_name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {detailRows(s).map(({ Icon, label, value }) => value ? (
            <div key={label} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center shrink-0 ${a.icon}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500 leading-none">{label}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5">{value}</p>
              </div>
            </div>
          ) : null)}
          {s.conflicts?.length > 0 && (
            <div className="mt-1 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">
              <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Conflict detected
              </p>
              {s.conflicts.map((c, i) => <p key={i} className="text-xs text-red-500 dark:text-red-400 mt-0.5">{c}</p>)}
            </div>
          )}
        </div>
        {(onEdit || onDelete) && (
          <div className="px-5 pb-5 flex gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => { onClose(); onEdit(s); }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#7B1C1C] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#6a1717] focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </button>
            )}
            {onDelete && s.id && (
              <button
                type="button"
                onClick={() => { if (window.confirm('Delete this schedule?')) { onClose(); onDelete(s); } }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-900/40 px-4 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// Individual card — horizontal compact layout + hover tooltip + click modal
const EventCard = ({ s, isConflict, height, onEditSchedule, onDeleteSchedule }) => {
  const [hovered, setHovered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const cardRef = useRef();
  const [tipPos, setTipPos] = useState({ top: 0, left: 0, right: 'auto' });
  const sectionLabel = getSectionLabel(s);
  const timeRange = getTimeRange(s);
  const courseFontSize = height <= 36 ? 8 : height <= 64 ? 9 : 10;
  const metaFontSize = height <= 36 ? 7 : height <= 64 ? 8 : 9;

  const style = isConflict
    ? { wrap: 'bg-red-100 border-l-[5px] border-red-500 ring-1 ring-red-300/60 dark:bg-red-500/25 dark:border-red-400 dark:ring-red-400/40', text: 'text-red-900 dark:text-red-50' }
    : progStyle(sectionLabel);

  const handleMouseEnter = () => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const tipW = 220;
    const winW = window.innerWidth;
    // prefer right side, but flip if too close to edge
    const spaceRight = winW - rect.right;
    const left = spaceRight >= tipW + 8 ? rect.right + 6 : rect.left - tipW - 6;
    setTipPos({ top: rect.top, left });
    setHovered(true);
  };

  return (
    <>
      <div ref={cardRef}
        className={`rounded-md h-full overflow-hidden cursor-pointer select-none relative shadow-sm hover:shadow-md hover:-translate-y-px transition-all ${style.wrap} ${style.text}`}
        onClick={() => setModalOpen(true)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
      >
        {isConflict && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-[7px] font-bold px-0.5 leading-tight rounded-bl">⚠</span>
        )}
        <div className="h-full min-h-0 flex flex-col items-center justify-center gap-[1px] px-2 py-1 text-center">
          <p className="font-black truncate leading-tight" style={{ fontSize: courseFontSize }} title={s.subject_code}>
            {s.subject_code}
          </p>
          <p className="opacity-90 truncate leading-tight font-semibold" style={{ fontSize: metaFontSize }} title={sectionLabel}>
            {sectionLabel || 'Year/Section'}
          </p>
          <p className="opacity-80 truncate leading-tight" style={{ fontSize: metaFontSize }} title={s.instructor_name}>
            {s.instructor_name}
          </p>
          <p className="opacity-80 truncate leading-tight tabular-nums" style={{ fontSize: metaFontSize }} title={timeRange}>
            {timeRange}
          </p>
          <p className="opacity-80 truncate leading-tight" style={{ fontSize: metaFontSize }} title={s.room_code}>
            Room: {s.room_code}
          </p>
        </div>
      </div>

      {/* Desktop hover tooltip — portaled to body to escape grid stacking context */}
      {hovered && createPortal(
        <div className="fixed z-[9998] pointer-events-none" style={{ top: tipPos.top, left: tipPos.left, width: 220 }}>
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-t-4 ${sectionAccent(s).border} border-x border-b border-gray-200 dark:border-gray-700 overflow-hidden`}>
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
              <p className={`text-xs font-black ${sectionAccent(s).text}`}>{s.subject_code}</p>
              {s.subject_name && <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{s.subject_name}</p>}
            </div>
            <div className="px-3 py-2 flex flex-col gap-1.5">
              {detailRows(s).filter(r => r.value).map(({ Icon, value }) => (
                <div key={value} className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${sectionAccent(s).icon}`} />
                  <span className="text-xs text-gray-700 dark:text-gray-200 truncate">{value}</span>
                </div>
              ))}
              {isConflict && (
                <p className="text-[10px] font-bold text-red-600 dark:text-red-400 mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Scheduling conflict
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Click modal — full info */}
      {modalOpen && <ScheduleModal s={s} onClose={() => setModalOpen(false)} onEdit={onEditSchedule} onDelete={onDeleteSchedule} />}
    </>
  );
};

const ScheduleCalendar = ({ schedules = [], loading = false, onCreateSchedule, onEditSchedule, onDeleteSchedule }) => {
  const [slotSelection, setSlotSelection] = useState(null);
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
  const [dayWidths, setDayWidths] = useState(defaultDayWidths);
  const [rowHeights, setRowHeights] = useState(defaultRowHeights);
  const [exporting, setExporting] = useState(false);
  const slotSelectionRef = useRef(null);
  const resizeRef = useRef(null);

  const setAllDayWidths = (value) => {
    const nextWidth = Number(value);
    setDayWidth(nextWidth);
    setDayWidths(DAYS.map(() => nextWidth));
  };

  const setAllRowHeights = (value) => {
    const nextHeight = Number(value);
    setRowHeight(nextHeight);
    setRowHeights(TIMES.map(() => nextHeight));
  };

  const beginGridResize = (event, axis, index) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      axis,
      index,
      startX: event.clientX,
      startY: event.clientY,
      dayWidths,
      rowHeights,
    };
  };

  const updateGridResize = (event) => {
    const active = resizeRef.current;
    if (!active) return;

    if (active.axis === 'column') {
      const next = [...active.dayWidths];
      next[active.index] = clamp(Math.round(active.dayWidths[active.index] + event.clientX - active.startX), MIN_DAY_WIDTH, MAX_DAY_WIDTH);
      setDayWidths(next);
      return;
    }

    const next = [...active.rowHeights];
    next[active.index] = clamp(Math.round(active.rowHeights[active.index] + event.clientY - active.startY), MIN_ROW_HEIGHT, MAX_ROW_HEIGHT);
    setRowHeights(next);
  };

  const finishGridResize = () => {
    resizeRef.current = null;
  };

  const resetCalendarSize = () => {
    setDayWidth(DEFAULT_DAY_WIDTH);
    setRowHeight(DEFAULT_ROW_HEIGHT);
    setDayWidths(defaultDayWidths());
    setRowHeights(defaultRowHeights());
  };

  const beginSlotSelection = (event, dayIdx, rowIdx) => {
    if (!onCreateSchedule || event.button !== 0) return;
    event.preventDefault();

    const next = { dayIdx, startIdx: rowIdx, endIdx: rowIdx, moved: false };
    slotSelectionRef.current = next;
    setSlotSelection(next);
  };

  const updateSlotSelection = (event) => {
    const active = slotSelectionRef.current;
    if (!active || !onCreateSchedule) return;

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-calendar-cell="true"]');
    if (!target) return;

    const dayIdx = Number(target.dataset.dayIdx);
    const rowIdx = Number(target.dataset.rowIdx);
    if (dayIdx !== active.dayIdx || Number.isNaN(rowIdx)) return;

    const next = {
      ...active,
      endIdx: rowIdx,
      moved: active.moved || rowIdx !== active.startIdx,
    };
    slotSelectionRef.current = next;
    setSlotSelection(next);
  };

  const finishSlotSelection = () => {
    const active = slotSelectionRef.current;
    if (!active || !onCreateSchedule) return;

    slotSelectionRef.current = null;
    setSlotSelection(null);

    const startIdx = Math.min(active.startIdx, active.endIdx);
    const endIdx = Math.max(active.startIdx, active.endIdx);
    const timeStart = TIME_VALUES[startIdx];
    const timeEnd = active.moved
      ? addMinutes(TIME_VALUES[endIdx], 30)
      : addMinutes(timeStart, 60);

    onCreateSchedule({
      day_of_week: DAYS[active.dayIdx],
      time_start: timeStart,
      time_end: timeEnd,
    });
  };

  const cancelSlotSelection = () => {
    slotSelectionRef.current = null;
    setSlotSelection(null);
  };

  useEffect(() => {
    const handlePointerMove = (event) => {
      updateGridResize(event);
      updateSlotSelection(event);
    };
    const handlePointerUp = () => {
      finishGridResize();
      finishSlotSelection();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') cancelSlotSelection();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCreateSchedule]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500 text-sm">
        <span className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-[#7B1C1C] rounded-full animate-spin mr-2" />
        Loading schedule...
      </div>
    );
  }

  if (schedules.length === 0 && !onCreateSchedule) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-center py-16 text-gray-400 dark:text-gray-500 text-sm">
        No schedules found.
      </div>
    );
  }

  const groups = {};
  schedules.forEach(s => {
    const dayIdx = DAYS.indexOf(s.day_of_week);
    const startIdx = getSlotIndex(s.time_start);
    if (dayIdx === -1 || startIdx === -1) return;
    const key = `${dayIdx}_${startIdx}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  // Turn groups into placement blocks and assign side-by-side lanes so cards that
  // overlap in the same day column never sit on top of each other.
  const placedBlocks = Object.entries(groups).map(([key, events]) => {
    const [dayIdx, startIdx] = key.split('_').map(Number);
    const endIdx = Math.max(...events.map(s => getEndSlotIndex(s.time_end)));
    return { key, dayIdx, startIdx, endIdx, events, lane: 0, laneCount: 1 };
  });
  const blocksByDay = {};
  placedBlocks.forEach(b => { (blocksByDay[b.dayIdx] = blocksByDay[b.dayIdx] || []).push(b); });
  Object.values(blocksByDay).forEach(list => {
    list.sort((a, b) => (a.startIdx - b.startIdx) || (a.endIdx - b.endIdx));
    let i = 0;
    while (i < list.length) {
      // grow a cluster of transitively-overlapping blocks
      let clusterEnd = list[i].endIdx;
      let j = i + 1;
      while (j < list.length && list[j].startIdx <= clusterEnd) { clusterEnd = Math.max(clusterEnd, list[j].endIdx); j++; }
      const cluster = list.slice(i, j);
      // interval-partition the cluster into lanes
      const laneEnds = [];
      cluster.forEach(b => {
        let lane = laneEnds.findIndex(e => e < b.startIdx);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(b.endIdx); }
        else laneEnds[lane] = b.endIdx;
        b.lane = lane;
      });
      cluster.forEach(b => { b.laneCount = laneEnds.length; });
      i = j;
    }
  });

  const TIME_COL_W = 56;
  const calendarWidth = TIME_COL_W + sum(dayWidths);
  const gridTemplateColumns = `${TIME_COL_W}px ${dayWidths.map(width => `${width}px`).join(' ')}`;
  const gridTemplateRows = `48px ${rowHeights.map(height => `${height}px`).join(' ')}`;

  const buildCalendarDocument = () => {
    const screenColumns = dayWidths.map(width => `${Math.max(width, 130)}px`).join(' ');
    const screenRows = rowHeights.map(height => `${Math.max(height, 34)}px`).join(' ');
    const printRowHeight = 24;
    const generatedAt = new Date().toLocaleString();
    const headersHtml = [
      '<div class="corner" style="grid-row:1;grid-column:1;"></div>',
      ...DAYS.map((day, index) => (
        `<div class="day-head" style="grid-row:1;grid-column:${index + 2};">${htmlEscape(day)}</div>`
      )),
    ].join('');

    const cellsHtml = TIMES.map((time, rowIdx) => {
      const hourClass = isOnHour(time) ? ' hour' : '';
      const timeCell = `<div class="time-cell${hourClass}" style="grid-row:${rowIdx + 2};grid-column:1;">${htmlEscape(time)}</div>`;
      const dayCells = DAYS.map((day, dayIdx) => (
        `<div class="slot-cell${hourClass}" aria-label="${htmlEscape(day)} ${htmlEscape(time)}" style="grid-row:${rowIdx + 2};grid-column:${dayIdx + 2};"></div>`
      )).join('');
      return `${timeCell}${dayCells}`;
    }).join('');

    const eventsHtml = Object.entries(groups).map(([key, events]) => {
      const [dayIdx, startIdx] = key.split('_').map(Number);
      const endIdx = Math.max(...events.map(s => getEndSlotIndex(s.time_end)));
      const span = Math.max(1, endIdx - startIdx + 1);
      const cardsHtml = events.map((s) => {
        const accent = exportAccent(s);
        const section = getSectionLabel(s) || 'Year/Section';
        const timeRange = getTimeRange(s) || 'Time TBD';
        const subject = s.subject_code || 'Course';
        const instructor = s.instructor_name || 'Instructor TBD';
        const room = s.room_code || 'Room TBD';
        const conflict = s.conflicts?.length > 0 ? '<span class="conflict-label">Conflict</span>' : '';

        return `
          <div class="event-card" style="border-left-color:${accent.border};background:${accent.bg};color:${accent.text};">
            <div class="event-course">${htmlEscape(subject)}${conflict}</div>
            <div class="event-line">${htmlEscape(section)}</div>
            <div class="event-line">${htmlEscape(instructor)}</div>
            <div class="event-line">${htmlEscape(timeRange)}</div>
            <div class="event-line">Room: ${htmlEscape(room)}</div>
          </div>
        `;
      }).join('');

      return `<div class="event-stack" style="grid-row:${startIdx + 2} / span ${span};grid-column:${dayIdx + 2};">${cardsHtml}</div>`;
    }).join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Schedule Calendar</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: #f8fafc;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 16px;
    }
    h1 { margin: 0; font-size: 22px; line-height: 1.2; }
    .meta { margin-top: 4px; color: #6b7280; font-size: 12px; }
    .actions { display: flex; gap: 8px; }
    .actions button {
      border: 1px solid #d1d5db;
      background: #ffffff;
      color: #374151;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .calendar-wrap {
      overflow: auto;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    }
    .calendar-grid {
      min-width: ${64 + sum(dayWidths)}px;
      display: grid;
      grid-template-columns: 64px ${screenColumns};
      grid-template-rows: 44px ${screenRows};
      position: relative;
    }
    .corner,
    .day-head,
    .time-cell,
    .slot-cell {
      border-right: 1px solid #e5e7eb;
      border-bottom: 1px solid #e5e7eb;
    }
    .corner,
    .day-head {
      background: #f3f4f6;
    }
    .day-head {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #374151;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .time-cell {
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      padding: 4px 8px 0 0;
      color: #4b5563;
      font-size: 10px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .time-cell.hour,
    .slot-cell.hour {
      background: #f9fafb;
    }
    .event-stack {
      z-index: 2;
      min-width: 0;
      display: flex;
      gap: 2px;
      padding: 2px;
      overflow: hidden;
    }
    .event-card {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      border-left: 5px solid #9ca3af;
      border-radius: 6px;
      padding: 6px 8px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
      font-size: 10px;
      line-height: 1.25;
      text-align: center;
    }
    .event-course {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 900;
      margin-bottom: 2px;
    }
    .event-line {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 700;
      opacity: 0.9;
    }
    .conflict-label {
      border-radius: 999px;
      background: #ef4444;
      color: #ffffff;
      padding: 2px 5px;
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
    }
    @page { size: landscape; margin: 8mm; }
    @media print {
      body { padding: 0; background: #ffffff; }
      .no-print { display: none !important; }
      .topbar { margin-bottom: 8px; align-items: flex-start; }
      h1 { font-size: 16px; }
      .meta { font-size: 9px; }
      .calendar-wrap { overflow: visible; border-radius: 0; box-shadow: none; }
      .calendar-grid {
        min-width: 0;
        width: 100%;
        grid-template-columns: 52px ${dayWidths.map(width => `${width}fr`).join(' ')};
        grid-template-rows: 32px repeat(${TIMES.length}, ${printRowHeight}px);
      }
      .day-head { font-size: 8px; letter-spacing: 0; }
      .time-cell { padding-right: 4px; font-size: 7px; }
      .event-stack { gap: 1px; padding: 1px; }
      .event-card {
        border-left-width: 3px;
        border-radius: 4px;
        padding: 3px 4px;
        box-shadow: none;
        font-size: 6.5px;
        line-height: 1.12;
      }
      .event-course { font-size: 7px; margin-bottom: 1px; gap: 3px; }
      .conflict-label { padding: 1px 3px; font-size: 5px; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div>
      <h1>Schedule Calendar</h1>
      <div class="meta">${schedules.length} schedule${schedules.length === 1 ? '' : 's'} &middot; Generated ${htmlEscape(generatedAt)}</div>
    </div>
    <div class="actions no-print">
      <button type="button" onclick="window.print()">Print landscape</button>
    </div>
  </div>
  <div class="calendar-wrap">
    <div class="calendar-grid">
      ${headersHtml}
      ${cellsHtml}
      ${eventsHtml}
    </div>
  </div>
</body>
</html>`;
  };

  const downloadCalendar = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const headerTop = 26;
      const gridTop = 62;
      const gridWidth = pageWidth - (margin * 2);
      const gridHeight = pageHeight - gridTop - margin;
      const pdfTimeColW = 48;
      const headerHeight = 30;
      const dayTotal = sum(dayWidths);
      const rowTotal = sum(rowHeights);
      const pdfDayWidths = dayWidths.map(width => ((gridWidth - pdfTimeColW) * width) / dayTotal);
      const pdfRowHeights = rowHeights.map(height => ((gridHeight - headerHeight) * height) / rowTotal);
      const dayLefts = pdfDayWidths.reduce((acc, width, index) => {
        acc.push(index === 0 ? margin + pdfTimeColW : acc[index - 1] + pdfDayWidths[index - 1]);
        return acc;
      }, []);
      const rowTops = pdfRowHeights.reduce((acc, height, index) => {
        acc.push(index === 0 ? gridTop + headerHeight : acc[index - 1] + pdfRowHeights[index - 1]);
        return acc;
      }, []);

      pdf.setProperties({ title: 'Schedule Calendar' });
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      setPdfColor(pdf, 'setTextColor', '#111827');
      pdf.text('Schedule Calendar', margin, headerTop);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      setPdfColor(pdf, 'setTextColor', '#6b7280');
      pdf.text(`${schedules.length} schedule${schedules.length === 1 ? '' : 's'} - Generated ${new Date().toLocaleString()}`, margin, headerTop + 14);

      setPdfColor(pdf, 'setDrawColor', '#e5e7eb');
      setPdfColor(pdf, 'setFillColor', '#f3f4f6');
      pdf.rect(margin, gridTop, pdfTimeColW, headerHeight, 'FD');

      DAYS.forEach((day, index) => {
        const x = dayLefts[index];
        const width = pdfDayWidths[index];
        setPdfColor(pdf, 'setFillColor', '#f3f4f6');
        setPdfColor(pdf, 'setDrawColor', '#e5e7eb');
        pdf.rect(x, gridTop, width, headerHeight, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        setPdfColor(pdf, 'setTextColor', '#374151');
        pdf.text(truncatePdfText(pdf, day.toUpperCase(), width - 8), x + (width / 2), gridTop + 18, { align: 'center' });
      });

      TIMES.forEach((time, rowIdx) => {
        const y = rowTops[rowIdx];
        const height = pdfRowHeights[rowIdx];
        const fill = isOnHour(time) ? '#f9fafb' : '#ffffff';

        setPdfColor(pdf, 'setFillColor', fill);
        setPdfColor(pdf, 'setDrawColor', '#e5e7eb');
        pdf.rect(margin, y, pdfTimeColW, height, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6.5);
        setPdfColor(pdf, 'setTextColor', '#4b5563');
        pdf.text(time, margin + pdfTimeColW - 5, y + Math.min(10, height - 2), { align: 'right' });

        DAYS.forEach((day, dayIdx) => {
          const x = dayLefts[dayIdx];
          const width = pdfDayWidths[dayIdx];
          setPdfColor(pdf, 'setFillColor', fill);
          setPdfColor(pdf, 'setDrawColor', '#e5e7eb');
          pdf.rect(x, y, width, height, 'FD');
        });
      });

      Object.entries(groups).forEach(([key, events]) => {
        const [dayIdx, startIdx] = key.split('_').map(Number);
        const endIdx = Math.max(...events.map(s => getEndSlotIndex(s.time_end)));
        const span = Math.max(1, endIdx - startIdx + 1);
        const x = dayLefts[dayIdx] + 2;
        const y = rowTops[startIdx] + 2;
        const width = pdfDayWidths[dayIdx] - 4;
        const height = Math.max(sumRange(pdfRowHeights, startIdx, span) - 4, 10);
        const gap = 2;
        const cardWidth = (width - gap * (events.length - 1)) / events.length;

        events.forEach((schedule, eventIdx) => {
          const accent = exportAccent(schedule);
          const cardX = x + eventIdx * (cardWidth + gap);
          const cardY = y;
          const textX = cardX + (cardWidth / 2);
          const maxTextWidth = Math.max(cardWidth - 11, 8);
          const lineGap = Math.max(6.4, Math.min(8.4, height / 5.8));
          const baseFont = Math.max(5.2, Math.min(7.2, height / 8));
          const lines = [
            schedule.subject_code || 'Course',
            getSectionLabel(schedule) || 'Year/Section',
            schedule.instructor_name || 'Instructor TBD',
            getTimeRange(schedule) || 'Time TBD',
            `Room: ${schedule.room_code || 'Room TBD'}`,
          ];

          setPdfColor(pdf, 'setFillColor', accent.bg);
          setPdfColor(pdf, 'setDrawColor', accent.border);
          pdf.rect(cardX, cardY, cardWidth, height, 'F');
          setPdfColor(pdf, 'setFillColor', accent.border);
          pdf.rect(cardX, cardY, 3, height, 'F');
          setPdfColor(pdf, 'setDrawColor', '#d1d5db');
          pdf.rect(cardX, cardY, cardWidth, height, 'S');

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(baseFont + 0.8);
          setPdfColor(pdf, 'setTextColor', accent.text);
          pdf.text(truncatePdfText(pdf, lines[0], maxTextWidth), textX, cardY + lineGap, { align: 'center' });

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(baseFont);
          lines.slice(1).forEach((line, lineIdx) => {
            const textY = cardY + lineGap * (lineIdx + 2);
            if (textY > cardY + height - 2) return;
            pdf.text(truncatePdfText(pdf, line, maxTextWidth), textX, textY, { align: 'center' });
          });

          if (schedule.conflicts?.length > 0 && height > 18) {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(4.8);
            setPdfColor(pdf, 'setFillColor', '#ef4444');
            pdf.roundedRect(cardX + cardWidth - 28, cardY + 3, 23, 8, 3, 3, 'F');
            setPdfColor(pdf, 'setTextColor', '#ffffff');
            pdf.text('CONFLICT', cardX + cardWidth - 16.5, cardY + 9, { align: 'center' });
          }
        });
      });

      pdf.save(`schedule-calendar-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const printCalendar = () => {
    const popup = window.open('', '_blank', 'width=1280,height=900');
    if (!popup) {
      downloadCalendar();
      return;
    }

    popup.opener = null;
    popup.document.open();
    popup.document.write(buildCalendarDocument());
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 300);
  };

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          All widths
          <input
            type="range"
            min={MIN_DAY_WIDTH}
            max={MAX_DAY_WIDTH}
            value={dayWidth}
            onChange={event => setAllDayWidths(event.target.value)}
            className="w-24 accent-[#7B1C1C]"
            aria-label="Set all calendar column widths"
          />
          <span className="w-10 text-right tabular-nums text-gray-400">{dayWidth}px</span>
        </label>
        <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          All heights
          <input
            type="range"
            min={MIN_ROW_HEIGHT}
            max={MAX_ROW_HEIGHT}
            value={rowHeight}
            onChange={event => setAllRowHeights(event.target.value)}
            className="w-24 accent-[#7B1C1C]"
            aria-label="Set all calendar row heights"
          />
          <span className="w-9 text-right tabular-nums text-gray-400">{rowHeight}px</span>
        </label>
        <button
          type="button"
          onClick={downloadCalendar}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {exporting ? 'Making PDF' : 'PDF'}
        </button>
        <button
          type="button"
          onClick={printCalendar}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          Print
        </button>
        <button
          type="button"
          onClick={resetCalendarSize}
          className="rounded-md border border-gray-200 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          Reset
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="bg-white dark:bg-gray-900" style={{
        minWidth: `${calendarWidth}px`,
        display: 'grid',
        gridTemplateColumns,
        gridTemplateRows,
      }}>
        {/* Corner */}
        <div className="border-r border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60" style={{ gridRow: 1, gridColumn: 1 }} />

        {/* Day headers */}
        {DAYS.map((d, i) => {
          const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
          const isToday = d === todayName;
          return (
            <div key={d}
              className={`relative flex items-center justify-center border-b ${i < 6 ? 'border-r' : ''} border-gray-100 dark:border-gray-800 ${isToday ? 'bg-[#7B1C1C]' : 'bg-gray-50 dark:bg-gray-800/60'}`}
              style={{ gridRow: 1, gridColumn: i + 2 }}>
              <span className={`text-[11px] font-extrabold uppercase tracking-widest ${isToday ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{d.slice(0, 3)}</span>
              <button
                type="button"
                onPointerDown={event => beginGridResize(event, 'column', i)}
                aria-label={`Resize ${d} column`}
                title={`Resize ${d} column`}
                className={`absolute right-0 top-0 h-full w-2 cursor-col-resize transition hover:bg-[#7B1C1C]/25 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 ${isToday ? 'bg-white/10' : 'bg-transparent'}`}
              />
            </div>
          );
        })}

        {/* Time labels + row backgrounds */}
        {TIMES.map((time, rowIdx) => {
          const onHour = isOnHour(time);
          return (
            <React.Fragment key={`row${rowIdx}`}>
              <div className={`relative border-r border-b border-gray-100 dark:border-gray-800 flex items-start justify-end pr-2 pt-0.5 ${onHour ? 'bg-gray-50/40 dark:bg-gray-800/30' : 'bg-white dark:bg-gray-900'}`}
                style={{ gridRow: rowIdx + 2, gridColumn: 1 }}>
                <span className={`tabular-nums leading-none ${onHour ? 'text-[9px] text-gray-300 dark:text-gray-600 font-medium' : 'text-[10px] text-gray-600 dark:text-gray-400 font-bold'}`}>
                  {time}
                </span>
                <button
                  type="button"
                  onPointerDown={event => beginGridResize(event, 'row', rowIdx)}
                  aria-label={`Resize ${time} row`}
                  title={`Resize ${time} row`}
                  className="absolute bottom-0 left-0 h-2 w-full cursor-row-resize transition hover:bg-[#7B1C1C]/20 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30"
                />
              </div>
              {DAYS.map((day, dayIdx) => {
                const isSelected = slotSelection?.dayIdx === dayIdx
                  && rowIdx >= Math.min(slotSelection.startIdx, slotSelection.endIdx)
                  && rowIdx <= Math.max(slotSelection.startIdx, slotSelection.endIdx);
                const cellBg = isSelected
                  ? 'bg-red-100/80 dark:bg-red-900/25'
                  : onHour
                    ? 'bg-gray-50/40 dark:bg-gray-800/30'
                    : 'bg-white dark:bg-gray-900';
                const cellClass = `border-b ${dayIdx < 6 ? 'border-r' : ''} border-gray-100 dark:border-gray-800 ${cellBg}`;
                const slot = {
                  day_of_week: day,
                  time_start: TIME_VALUES[rowIdx],
                  time_end: addMinutes(TIME_VALUES[rowIdx], 60),
                };

                if (!onCreateSchedule) {
                  return (
                    <div key={`bg${rowIdx}-${dayIdx}`}
                      className={cellClass}
                      style={{ gridRow: rowIdx + 2, gridColumn: dayIdx + 2 }} />
                  );
                }

                return (
                  <button
                    key={`bg${rowIdx}-${dayIdx}`}
                    type="button"
                    data-calendar-cell="true"
                    data-day-idx={dayIdx}
                    data-row-idx={rowIdx}
                    onPointerDown={(event) => beginSlotSelection(event, dayIdx, rowIdx)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      onCreateSchedule(slot);
                    }}
                    onDragStart={(event) => event.preventDefault()}
                    aria-label={`Create schedule on ${day} at ${fmtTime(slot.time_start)}`}
                    title={`Click or drag to create schedule on ${day} at ${fmtTime(slot.time_start)}`}
                    className={`group relative select-none text-left transition hover:bg-red-50/70 focus:z-[3] focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 dark:hover:bg-red-900/10 ${isSelected ? 'z-[1] ring-1 ring-inset ring-[#7B1C1C]/30' : ''} ${cellClass}`}
                    style={{ gridRow: rowIdx + 2, gridColumn: dayIdx + 2 }}
                  >
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#7B1C1C] shadow-sm ring-1 ring-red-200 dark:bg-gray-900 dark:ring-red-900/60">
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* Events */}
        {placedBlocks.map(({ key, dayIdx, startIdx, endIdx, events, lane, laneCount }) => {
          const span = Math.max(1, endIdx - startIdx + 1);
          const cardH = sumRange(rowHeights, startIdx, span) - 4;

          return (
            <div key={key} style={{
              gridRow: `${startIdx + 2} / span ${span}`,
              gridColumn: dayIdx + 2,
              justifySelf: 'start',
              width: `${100 / laneCount}%`,
              marginLeft: `${(lane * 100) / laneCount}%`,
              padding: '2px',
              zIndex: 2,
              minWidth: 0,
            }}>
              {events.length === 1 ? (
                <EventCard s={events[0]} isConflict={events[0].conflicts?.length > 0} height={cardH} onEditSchedule={onEditSchedule} onDeleteSchedule={onDeleteSchedule} />
              ) : (
                <div className="flex gap-0.5 h-full">
                  {events.map(s => (
                    <div key={s.id} className="flex-1 min-w-0">
                      <EventCard s={s} isConflict={s.conflicts?.length > 0} height={cardH} onEditSchedule={onEditSchedule} onDeleteSchedule={onDeleteSchedule} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
};

export default ScheduleCalendar;
