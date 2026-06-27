import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [showBell, setShowBell] = useState(false);
  const [pendingList, setPendingList] = useState([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const bellRef = useRef();
  const userRef = useRef();

  const fetchNotifications = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const { data } = await api.get('/misc?action=activation-requests');
      const pending = data.filter(r => r.status === 'pending');
      setPendingCount(pending.length);
      setPendingList(pending);
    } catch { }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false);
      if (userRef.current && !userRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleChangePw = async (e) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) return toast.error('Passwords do not match.');
    if (pwForm.next.length < 6) return toast.error('Password must be at least 6 characters.');
    setPwLoading(true);
    try {
      const { data } = await api.post('/auth?action=change-password', {
        current_password: pwForm.current,
        new_password: pwForm.next,
      });
      toast.success(data.message);
      setShowChangePw(false);
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.');
    } finally { setPwLoading(false); }
  };

  const roleLabel = { admin: 'Administrator', instructor: 'Instructor', student: 'Student' };
  const roleColors = { admin: 'bg-red-100 text-red-700', instructor: 'bg-blue-100 text-blue-700', student: 'bg-green-100 text-green-700' };

  return (
    <>
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between z-40 relative">
        {/* Left: Logo + title */}
        <div className="flex items-center gap-3">
          <img src={logo} alt="GCC Logo" className="w-9 h-9 rounded-full object-cover border-2 border-gray-200" />
          <div className="leading-tight">
            <p className="text-sm font-bold text-gray-900 tracking-tight">Goa Community College</p>
            <p className="text-xs text-gray-400">Class Scheduling System</p>
          </div>
          {user && (
            <span className={`ml-1 text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${roleColors[user.role] || 'bg-gray-100 text-gray-600'}`}>
              {roleLabel[user.role] || user.role}
            </span>
          )}
        </div>

        {/* Right */}
        {user && (
          <div className="flex items-center gap-2">
            {/* Bell — admin only */}
            {user.role === 'admin' && (
              <div className="relative" ref={bellRef}>
                <button
                  onClick={() => setShowBell(v => !v)}
                  className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition"
                  aria-label="Notifications"
                >
                  <BellIcon />
                  {pendingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </button>
                {showBell && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">Notifications</p>
                      {pendingCount > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">{pendingCount} pending</span>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {pendingList.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-400">No new notifications</div>
                      ) : pendingList.map(r => (
                        <button key={r.id} onClick={() => { navigate('/admin/instructors'); setShowBell(false); }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition">
                          <p className="text-sm font-medium text-gray-800">Activation Request</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            <span className="font-medium">{r.instructor_name}</span> — <span className="font-mono">{r.desired_username}</span>
                          </p>
                        </button>
                      ))}
                    </div>
                    {pendingList.length > 0 && (
                      <button onClick={() => { navigate('/admin/instructors'); setShowBell(false); }}
                        className="w-full text-center text-xs py-2.5 border-t border-gray-100 font-medium text-[#7B1C1C] hover:bg-gray-50 transition">
                        View all in Instructors →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* User menu */}
            <div className="relative" ref={userRef}>
              <button onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-100 transition">
                <div className="w-8 h-8 rounded-full bg-[#7B1C1C] flex items-center justify-center text-xs font-bold text-white">
                  {(user.name || user.student_id || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-gray-800 max-w-[120px] truncate">{user.name || user.student_id}</p>
                  <p className="text-[10px] text-gray-400">{roleLabel[user.role]}</p>
                </div>
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800 truncate">{user.name || user.student_id}</p>
                    <p className="text-xs text-gray-400 capitalize">{roleLabel[user.role]}</p>
                  </div>
                  {user.role !== 'student' && (
                    <button onClick={() => { setShowChangePw(true); setShowUserMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Change Password
                    </button>
                  )}
                  <button onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition border-t border-gray-100">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Change Password</h3>
                <p className="text-xs text-gray-400 mt-0.5">Update your account password</p>
              </div>
              <button onClick={() => { setShowChangePw(false); setPwForm({ current: '', next: '', confirm: '' }); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleChangePw} className="px-6 py-5 flex flex-col gap-4">
              {[
                { label: 'Current Password', key: 'current', placeholder: 'Enter current password' },
                { label: 'New Password', key: 'next', placeholder: 'Minimum 6 characters' },
                { label: 'Confirm New Password', key: 'confirm', placeholder: 'Re-enter new password' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
                  <input type="password" required placeholder={placeholder}
                    value={pwForm[key]}
                    onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/30 focus:border-[#7B1C1C] transition"
                  />
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => { setShowChangePw(false); setPwForm({ current: '', next: '', confirm: '' }); }}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50 transition">
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
      )}
    </>
  );
};

export default Navbar;
