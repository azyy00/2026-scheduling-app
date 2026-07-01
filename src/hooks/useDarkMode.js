import { useEffect, useState } from 'react';

export const useDarkMode = () => {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    const root = document.documentElement;
    if (dark) { root.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else       { root.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [dark]);

  return [dark, setDark];
};

// Apply saved theme immediately on load (before React mounts)
const saved = localStorage.getItem('theme');
if (saved === 'dark') document.documentElement.classList.add('dark');
