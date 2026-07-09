import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

/**
 * Type-to-filter dropdown. Drop-in replacement for a long <select>.
 * Props:
 *  - value: current selected value (string|number)
 *  - onChange: (value) => void
 *  - options: [{ value, label }]
 *  - placeholder, required, disabled, className (trigger classes)
 */
const SearchableSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  required = false,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find(o => String(o.value) === String(value));
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    setActive(0);
  }, [open, query]);

  const pick = (opt) => { onChange(opt.value); setOpen(false); setQuery(''); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) pick(filtered[active]); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  const triggerCls = className ||
    'w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C]';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`${triggerCls} flex items-center justify-between gap-2 text-left disabled:opacity-50`}
      >
        <span className={`truncate ${selected ? '' : 'text-gray-400 dark:text-gray-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-[60] mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type to search…"
              className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">No matches</p>
            ) : filtered.map((o, i) => {
              const isSel = String(o.value) === String(value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition
                    ${i === active ? 'bg-[#7B1C1C]/10 dark:bg-[#7B1C1C]/25' : ''}
                    ${isSel ? 'font-semibold text-[#7B1C1C] dark:text-red-300' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel && <Check className="w-4 h-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* keeps native "please fill this in" validation working */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value || ''}
          onChange={() => {}}
          style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: '2px', opacity: 0, pointerEvents: 'none' }}
        />
      )}
    </div>
  );
};

export default SearchableSelect;
