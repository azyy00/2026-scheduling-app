import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { notifyBus } from '../../utils/notificationBus';
import { useDarkMode } from '../../hooks/useDarkMode';
import { Bell, Sun, Moon, Menu, ChevronDown, LogOut, KeyRound, CalendarDays, CalendarRange, GraduationCap, History, X, Mail } from 'lucide-react';
import HistoryDrawer from './HistoryDrawer';

const typeStyles = {
  success: { dot: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: '✓' },
  warning: { dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-400',  label: '!' },
  info:    { dot: 'bg-blue-500',  bg: 'bg-blue-50 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-400',    label: 'i' },
};

const Navbar = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useDarkMode();

  const [pendingList, setPendingList] = useState([]);
  const [studentReqs, setStudentReqs] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [eventLog, setEventLog]       = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [showBell, setShowBell]         = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [accountEmail, setAccountEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [term, setTerm] = useState(null);
  const [showTerm, setShowTerm] = useState(false);
  const [rollingOver, setRollingOver] = useState(false);
  const bellRef = useRef();
  const userRef = useRef();
  const termRef = useRef();

  useEffect(() => {
    const unsub = notifyBus.subscribe(item => setEventLog(prev => [item, ...prev].slice(0, 20)));
    return unsub;
  }, []);

  const fetchActivations = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try { const { data } = await api.get('/misc?action=activation-requests'); setPendingList(data.filter(r => r.status === 'pending')); } catch {}
    try { const { data } = await api.get('/misc?action=student-requests'); setStudentReqs(data.filter(r => r.status === 'pending')); } catch {}
    try { const { data } = await api.get('/misc?action=activity-log&limit=5'); setRecentActivity(data.items || []); } catch {}
  }, [user]);

  const fetchEvents = useCallback(async () => {
    try { const { data } = await api.get('/events?upcoming=1'); setUpcomingEvents(data); } catch {}
  }, []);

  const fetchTerm = useCallback(async () => {
    try { const { data } = await api.get('/term?action=get'); setTerm(data); } catch {}
  }, []);

  const setActiveTerm = async (school_year, semester) => {
    try {
      await api.post('/term?action=set', { school_year, semester });
      toast.success(`Now viewing ${school_year} · ${semester} Sem`);
      window.location.reload();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to switch term.'); }
  };

  const startNewYear = async () => {
    if (!window.confirm(
      `Start a NEW academic year?\n\nThis will:\n• Save a history snapshot of every student's current year & section\n• Promote ALL students up one year level (sections remapped where possible)\n• Set the new academic year as active\n\nThis cannot be undone automatically. Continue?`
    )) return;
    setRollingOver(true);
    try {
      const { data } = await api.post('/term?action=start-new-year');
      toast.success(data.message, { duration: 6000 });
      window.location.reload();
    } catch (err) { toast.error(err.response?.data?.message || 'Rollover failed.'); }
    finally { setRollingOver(false); }
  };

  useEffect(() => {
    fetchActivations(); fetchEvents(); fetchTerm();
    const interval = setInterval(() => { fetchActivations(); fetchEvents(); }, 60_000);
    return () => clearInterval(interval);
  }, [fetchActivations, fetchEvents, fetchTerm]);

  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false);
      if (userRef.current && !userRef.current.contains(e.target)) setShowUserMenu(false);
      if (termRef.current && !termRef.current.contains(e.target)) setShowTerm(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!showChangePw || user?.role !== 'admin') return;
    api.get('/auth?action=account')
      .then(({ data }) => setAccountEmail(data.email || ''))
      .catch(() => {});
  }, [showChangePw, user]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    if (!accountEmail.trim()) return toast.error('Recovery email is required.');
    setEmailLoading(true);
    try {
      const { data } = await api.put('/auth?action=account', { email: accountEmail.trim() });
      setAccountEmail(data.email || accountEmail.trim());
      toast.success(data.message || 'Recovery email saved.');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save recovery email.'); }
    finally { setEmailLoading(false); }
  };

  const handleChangePw = async (e) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) return toast.error('Passwords do not match.');
    if (pwForm.next.length < 8) return toast.error('Password must be at least 8 characters.');
    setPwLoading(true);
    try {
      const { data } = await api.post('/auth?action=change-password', { current_password: pwForm.current, new_password: pwForm.next });
      toast.success(data.message);
      setShowChangePw(false);
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to change password.'); }
    finally { setPwLoading(false); }
  };

  const totalCount = pendingList.length + studentReqs.length + eventLog.length + upcomingEvents.length;
  const clearEvents = () => setEventLog([]);
  const roleLabel  = { admin: 'Administrator', instructor: 'Instructor', student: 'Student' };
  const roleColors = { admin: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', instructor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', student: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' };

  const inputCls = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] transition';

  return (
    <>
      <nav className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 sm:px-6 py-2.5 flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onMenuToggle} className="lg:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition" aria-label="Toggle menu">
            <Menu className="w-5 h-5" />
          </button>
          <img src={logo} alt="GCC Logo" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700 shrink-0" />
          <div className="leading-tight min-w-0">
            <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white tracking-tight truncate">Goa Community College</p>
            <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 hidden sm:block">Class Scheduling System</p>
          </div>
        </div>

        {/* Right */}
        {user && (
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Active term */}
            {term?.active_school_year && (
              <div className="relative" ref={termRef}>
                <button onClick={() => user.role === 'admin' && setShowTerm(v => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition border
                    ${user.role === 'admin'
                      ? 'bg-[#7B1C1C]/5 text-[#7B1C1C] border-[#7B1C1C]/20 hover:bg-[#7B1C1C]/10 dark:bg-[#7B1C1C]/20 dark:text-red-300 dark:border-[#7B1C1C]/40 cursor-pointer'
                      : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 cursor-default'}`}
                  title="Active academic year & semester">
                  <CalendarRange className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{term.active_school_year} · {term.active_semester} Sem</span>
                  {user.role === 'admin' && <ChevronDown className="w-3 h-3 hidden sm:block" />}
                </button>

                {showTerm && user.role === 'admin' && (
                  <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Academic Term</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Controls what schedules everyone sees.</p>
                    </div>
                    <div className="px-4 py-3 flex flex-col gap-3">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide font-bold text-gray-400 dark:text-gray-500 mb-1">Academic Year</label>
                        <select value={term.active_school_year}
                          onChange={e => setActiveTerm(e.target.value, term.active_semester)}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30">
                          {(term.years || []).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide font-bold text-gray-400 dark:text-gray-500 mb-1">Semester</label>
                        <div className="flex gap-2">
                          {['1st', '2nd'].map(sem => (
                            <button key={sem} onClick={() => setActiveTerm(term.active_school_year, sem)}
                              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition border ${
                                term.active_semester === sem
                                  ? 'bg-[#7B1C1C] text-white border-[#7B1C1C]'
                                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                              {sem} Sem
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                      <button onClick={startNewYear} disabled={rollingOver}
                        className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60">
                        <GraduationCap className="w-4 h-4" />
                        {rollingOver ? 'Starting…' : 'Start New Academic Year'}
                      </button>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 leading-snug">
                        Snapshots history, promotes all students +1 year, and advances the active year.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <span className={`hidden sm:inline-flex text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${roleColors[user.role] || 'bg-gray-100 text-gray-600'}`}>
              {roleLabel[user.role] || user.role}
            </span>

            {/* Dark mode toggle */}
            <button onClick={() => setDark(d => !d)}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              aria-label="Toggle dark mode" title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Bell */}
            <div className="relative" ref={bellRef}>
              <button onClick={() => setShowBell(v => !v)}
                className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition" aria-label="Notifications">
                <Bell className="w-5 h-5" />
                {totalCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                    {totalCount > 9 ? '9+' : totalCount}
                  </span>
                )}
              </button>

              {showBell && (
                <div className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-1rem))] bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Notifications</p>
                    <div className="flex items-center gap-2">
                      {totalCount > 0 && <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full font-medium">{totalCount}</span>}
                      {eventLog.length > 0 && <button onClick={clearEvents} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline">Clear</button>}
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                    {pendingList.map(r => (
                      <button key={`act-${r.id}`} onClick={() => { navigate('/admin/instructors'); setShowBell(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0">!</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Activation Request</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5"><span className="font-medium">{r.instructor_name}</span> — <span className="font-mono">{r.desired_username}</span></p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Tap to review →</p>
                          </div>
                        </div>
                      </button>
                    ))}

                    {studentReqs.map(r => (
                      <button key={`stu-${r.id}`} onClick={() => { navigate('/admin/students'); setShowBell(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center shrink-0">!</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Student Registration</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5"><span className="font-medium">{r.name}</span> — <span className="font-mono">{r.student_id}</span></p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Tap to review →</p>
                          </div>
                        </div>
                      </button>
                    ))}

                    {upcomingEvents.map(ev => {
                      const diff = Math.ceil((new Date(ev.event_date.slice(0,10) + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 86400000);
                      const label = diff === 0 ? 'Today!' : diff === 1 ? 'Tomorrow' : `In ${diff} days`;
                      return (
                        <div key={`ev-${ev.id}`} className="px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900/40">
                          <div className="flex items-start gap-3">
                            <CalendarDays className="w-4 h-4 mt-0.5 shrink-0 text-indigo-500" />
                            <div>
                              <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">{ev.title}</p>
                              {ev.description && <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">{ev.description}</p>}
                              <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{label}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {eventLog.map(item => {
                      const s = typeStyles[item.type] || typeStyles.info;
                      return (
                        <div key={item.id} className={`px-4 py-3 ${s.bg}`}>
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 w-5 h-5 rounded-full ${item.type === 'success' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'} text-[10px] font-bold flex items-center justify-center shrink-0`}>
                              {s.label}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${s.text}`}>{item.title}</p>
                              {item.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.body}</p>}
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{item.time}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Recent activity (admin) */}
                    {user.role === 'admin' && recentActivity.length > 0 && (
                      <>
                        <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">Recent activity</p>
                        {recentActivity.map(a => (
                          <div key={`act-log-${a.id}`} className="px-4 py-2.5 flex items-start gap-3">
                            <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${a.type === 'success' ? 'bg-emerald-500' : a.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug">{a.title}</p>
                              {a.detail && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.detail}</p>}
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{a.actor_name || 'System'}</p>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {totalCount === 0 && recentActivity.length === 0 && (
                      <div className="px-4 py-8 text-center">
                        <p className="text-2xl mb-1">🔔</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500">No notifications yet</p>
                      </div>
                    )}
                  </div>

                  {user.role === 'admin' && (
                    <button onClick={() => { setShowHistory(true); setShowBell(false); }}
                      className="w-full inline-flex items-center justify-center gap-1.5 text-xs py-2.5 border-t border-gray-100 dark:border-gray-800 font-semibold text-[#7B1C1C] dark:text-red-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                      <History className="w-3.5 h-3.5" /> View all history
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative" ref={userRef}>
              <button onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-1.5 sm:gap-2.5 sm:px-3 py-2 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <div className="w-8 h-8 rounded-full bg-[#7B1C1C] flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {(user.name || user.student_id || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden md:block">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 max-w-[120px] truncate">{user.name || user.student_id}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">{roleLabel[user.role]}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{user.name || user.student_id}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{roleLabel[user.role]}</p>
                  </div>
                  {user.role !== 'student' && (
                    <button onClick={() => { setShowChangePw(true); setShowUserMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 transition">
                      <KeyRound className="w-4 h-4 text-gray-400" />
                      {user.role === 'admin' ? 'Account Security' : 'Change Password'}
                    </button>
                  )}
                  <button onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5 transition border-t border-gray-100 dark:border-gray-800">
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Change Password Modal */}
      {showChangePw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{user.role === 'admin' ? 'Account Security' : 'Change Password'}</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{user.role === 'admin' ? 'Recovery email and password' : 'Update your account password'}</p>
              </div>
              <button onClick={() => { setShowChangePw(false); setPwForm({ current: '', next: '', confirm: '' }); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-5">
              {user.role === 'admin' && (
                <form onSubmit={handleUpdateEmail} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-2.5">
                    <Mail className="w-4 h-4 mt-0.5 text-[#7B1C1C] dark:text-red-300" />
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Recovery Email</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Forgot-password codes are sent here.</p>
                    </div>
                  </div>
                  <input type="email" required placeholder="admin@email.com"
                    value={accountEmail} onChange={e => setAccountEmail(e.target.value)}
                    className={inputCls} />
                  <button type="submit" disabled={emailLoading}
                    className="w-full py-2.5 rounded-lg text-sm text-white font-semibold bg-[#7B1C1C] hover:bg-[#6a1717] disabled:opacity-60 transition">
                    {emailLoading ? 'Saving...' : 'Save Recovery Email'}
                  </button>
                </form>
              )}

              <form onSubmit={handleChangePw} className="flex flex-col gap-4">
                {[
                  { label: 'Current Password', key: 'current', placeholder: 'Enter current password' },
                  { label: 'New Password', key: 'next', placeholder: 'Minimum 8 characters' },
                  { label: 'Confirm New Password', key: 'confirm', placeholder: 'Re-enter new password' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
                    <input type="password" required placeholder={placeholder}
                      value={pwForm[key]} onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                      className={inputCls} />
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => { setShowChangePw(false); setPwForm({ current: '', next: '', confirm: '' }); }}
                    className="flex-1 border border-gray-300 dark:border-gray-600 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                    Cancel
                  </button>
                  <button type="submit" disabled={pwLoading}
                    className="flex-1 py-2.5 rounded-lg text-sm text-white font-semibold bg-[#7B1C1C] hover:bg-[#6a1717] disabled:opacity-60 transition">
                    {pwLoading ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Activity history side panel */}
      {user?.role === 'admin' && (
        <HistoryDrawer open={showHistory} onClose={() => setShowHistory(false)} />
      )}
    </>
  );
};

export default Navbar;
