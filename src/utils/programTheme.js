// Program theme colors — the single source of truth used everywhere a program is shown.
//   BPED  → pink   ·   BECED → amber/yellow   ·   BCAED → orange
// Matches the schedule calendar card colors so instructors and courses read the same.

export const programBadge = (program = '') => {
  const p = String(program).toUpperCase();
  if (p.startsWith('BPED'))  return 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300';
  if (p.startsWith('BECED')) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
  if (p.startsWith('BCAED')) return 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
};

// Solid dot color (for legends / small indicators)
export const programDot = (program = '') => {
  const p = String(program).toUpperCase();
  if (p.startsWith('BPED'))  return 'bg-pink-500';
  if (p.startsWith('BECED')) return 'bg-amber-500';
  if (p.startsWith('BCAED')) return 'bg-orange-500';
  return 'bg-gray-400';
};
