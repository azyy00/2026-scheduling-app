import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Users } from 'lucide-react';

const MAROON = '#7B1C1C';

const AnalyticsPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/misc?action=analytics').then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-500 text-sm">
        <span className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-[#7B1C1C] rounded-full animate-spin mr-2" />
        Loading insights…
      </div>
    );
  }
  if (!data) return null;

  const rows = data.instructors || [];
  const max = Math.max(...rows.map(r => Number(r.hours) || 0), 1);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200">Insights</h2>
        {data.term?.school_year && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#7B1C1C]/10 text-[#7B1C1C] dark:bg-[#7B1C1C]/30 dark:text-red-300 font-semibold">
            {data.term.school_year} · {data.term.semester} Sem
          </span>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#7B1C1C]/10 text-[#7B1C1C] dark:bg-[#7B1C1C]/30 dark:text-red-300 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight">Instructor Load</h3>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">Teaching hours per instructor this term</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 py-6 text-center">No instructors scheduled this term.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {rows.map((r, i) => {
              const val = Number(r.hours) || 0;
              const pct = Math.round((val / max) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-32 sm:w-40 text-xs font-medium text-gray-600 dark:text-gray-300 truncate shrink-0" title={r.name}>{r.name}</span>
                  <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
                    <div className="h-full rounded-md flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${Math.max(pct, 10)}%`, background: MAROON }}>
                      <span className="text-[10px] font-bold text-white whitespace-nowrap">{val}h</span>
                    </div>
                  </div>
                  <span className="w-16 text-right text-[11px] text-gray-400 dark:text-gray-500 shrink-0">{r.classes} class{r.classes === 1 ? '' : 'es'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPanel;
