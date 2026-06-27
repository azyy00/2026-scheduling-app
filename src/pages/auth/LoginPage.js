import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import logo from '../../assets/logo.png';
import building from '../../assets/gcc-building.jpg';

const MAROON = '#7B1C1C';

const EyeIcon = ({ show }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    {show
      ? <><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></>
      : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
    }
  </svg>
);

const PasswordInput = ({ value, onChange, placeholder, required }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value} onChange={onChange} placeholder={placeholder}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-[#7B1C1C] transition"
      />
      <button type="button" onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        <EyeIcon show={show} />
      </button>
    </div>
  );
};

const LoginPage = () => {
  const [activeTab, setActiveTab] = useState('Admin');
  const [instructorMode, setInstructorMode] = useState('signin');
  const [form, setForm] = useState({ username: '', password: '', student_id: '' });
  const [signupForm, setSignupForm] = useState({ last_name: '', first_name: '', desired_username: '', password: '', confirm_password: '' });
  const [signupLoading, setSignupLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const role = activeTab.toLowerCase();
    const credentials =
      role === 'student'
        ? { student_id: form.student_id }
        : { username: form.username, password: form.password };
    const result = await login(credentials, role);
    if (result.success) {
      if (role === 'admin') navigate('/admin/dashboard');
      else if (role === 'instructor') navigate('/instructor/dashboard');
      else navigate('/student/schedule');
    } else {
      toast.error(result.message);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (signupForm.password !== signupForm.confirm_password)
      return toast.error('Passwords do not match.');
    if (signupForm.password.length < 6)
      return toast.error('Password must be at least 6 characters.');
    setSignupLoading(true);
    try {
      const { data } = await api.post('/auth?action=instructor-signup', {
        last_name: signupForm.last_name,
        first_name: signupForm.first_name,
        desired_username: signupForm.desired_username,
        password: signupForm.password,
      });
      toast.success(data.message);
      setInstructorMode('signin');
      setSignupForm({ last_name: '', first_name: '', desired_username: '', password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed.');
    } finally {
      setSignupLoading(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#7B1C1C] transition';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4" style={{
      backgroundImage: `url(${building})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}>
      {/* Overlay */}
      <div className="absolute inset-0" style={{ background: 'rgba(40,5,5,0.58)', backdropFilter: 'blur(1.5px)' }} />

      {/* Login Card */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex flex-col items-center py-7 px-6" style={{ background: MAROON }}>
          <img src={logo} alt="GCC Logo" className="w-20 h-20 rounded-full object-cover border-4 border-white/30 shadow-lg mb-3"
            onError={e => e.target.style.display='none'} />
          <h1 className="text-white text-xl font-bold text-center">Goa Community College</h1>
          <p className="text-white/70 text-sm mt-0.5">Class Scheduling System</p>
          <p className="text-white/45 text-xs mt-0.5">Goa, Camarines Sur</p>
        </div>

        {/* Role Tabs */}
        <div className="flex border-b">
          {['Admin','Instructor','Student'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setInstructorMode('signin'); setShowForgot(false); }}
              className="flex-1 py-3 text-sm font-medium transition"
              style={activeTab === tab ? { borderBottom: `2px solid ${MAROON}`, color: MAROON } : { color: '#6b7280' }}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── Forgot Password overlay ── */}
        {showForgot && (
          <div className="px-8 py-6">
            <button onClick={() => setShowForgot(false)} className="text-xs flex items-center gap-1 mb-4" style={{ color: MAROON }}>
              ← Back to Sign In
            </button>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
              <p className="text-2xl mb-2">🔒</p>
              <p className="font-semibold text-gray-800 text-sm mb-2">Forgot your password?</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Please contact your <span className="font-semibold text-gray-700">System Administrator</span> to reset your password.
              </p>
              <div className="mt-4 bg-white border rounded-lg px-4 py-3 text-left text-xs text-gray-600 space-y-1">
                <p className="font-semibold text-gray-700 mb-1.5">Admin can reset passwords via:</p>
                <p>• Admin Panel → Instructors → Edit instructor → set new password</p>
              </div>
            </div>
            <button onClick={() => setShowForgot(false)}
              className="mt-4 w-full text-white py-2.5 rounded-lg text-sm font-medium" style={{ background: MAROON }}>
              Back to Login
            </button>
          </div>
        )}

        {/* ── Admin / Student form ── */}
        {!showForgot && activeTab !== 'Instructor' && (
          <form onSubmit={handleSubmit} className="px-8 py-6 flex flex-col gap-4">
            {activeTab === 'Student' ? (
              <div>
                <label className={labelCls}>Student ID</label>
                <input type="text" required placeholder="e.g. 2024-00001" value={form.student_id}
                  onChange={e => setForm({ ...form, student_id: e.target.value })} className={inputCls} />
              </div>
            ) : (
              <>
                <div>
                  <label className={labelCls}>Username</label>
                  <input type="text" required autoComplete="username" value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <PasswordInput required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="flex justify-end -mt-2">
                  <button type="button" onClick={() => setShowForgot(true)}
                    className="text-xs hover:underline" style={{ color: MAROON }}>
                    Forgot password?
                  </button>
                </div>
              </>
            )}
            <button type="submit" disabled={loading}
              className="text-white py-2.5 rounded-lg font-medium text-sm transition disabled:opacity-60"
              style={{ background: MAROON }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : `Sign in as ${activeTab}`}
            </button>
          </form>
        )}

        {/* ── Instructor: Sign In / Sign Up toggle ── */}
        {!showForgot && activeTab === 'Instructor' && (
          <div className="px-8 py-5">
            <div className="flex rounded-lg overflow-hidden border mb-5" style={{ borderColor: MAROON }}>
              <button onClick={() => setInstructorMode('signin')}
                className="flex-1 py-2 text-sm font-medium transition"
                style={instructorMode === 'signin' ? { background: MAROON, color: '#fff' } : { color: MAROON }}>
                Sign In
              </button>
              <button onClick={() => setInstructorMode('signup')}
                className="flex-1 py-2 text-sm font-medium transition"
                style={instructorMode === 'signup' ? { background: MAROON, color: '#fff' } : { color: MAROON }}>
                Sign Up (First Timer)
              </button>
            </div>

            {/* Instructor Sign In */}
            {instructorMode === 'signin' && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className={labelCls}>Username</label>
                  <input type="text" required autoComplete="username" value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <PasswordInput required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="flex justify-end -mt-2">
                  <button type="button" onClick={() => setShowForgot(true)}
                    className="text-xs hover:underline" style={{ color: MAROON }}>
                    Forgot password?
                  </button>
                </div>
                <button type="submit" disabled={loading}
                  className="text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-60"
                  style={{ background: MAROON }}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : 'Sign In'}
                </button>
                <p className="text-xs text-center text-gray-400">
                  First time? <button type="button" onClick={() => setInstructorMode('signup')} className="underline" style={{ color: MAROON }}>Sign Up</button> to request activation.
                </p>
              </form>
            )}

            {/* Instructor Sign Up */}
            {instructorMode === 'signup' && (
              <form onSubmit={handleSignup} className="flex flex-col gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                  <strong>First Timer?</strong> Enter your name as registered by the admin. Your account will be activated after admin approval.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>First Name</label>
                    <input required value={signupForm.first_name} onChange={e => setSignupForm({ ...signupForm, first_name: e.target.value })}
                      className={inputCls} placeholder="Juan" />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name</label>
                    <input required value={signupForm.last_name} onChange={e => setSignupForm({ ...signupForm, last_name: e.target.value })}
                      className={inputCls} placeholder="dela Cruz" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Desired Username</label>
                  <input required value={signupForm.desired_username} onChange={e => setSignupForm({ ...signupForm, desired_username: e.target.value })}
                    className={inputCls} placeholder="e.g. jdelacruz" />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <PasswordInput required value={signupForm.password} onChange={e => setSignupForm({ ...signupForm, password: e.target.value })} placeholder="Min. 6 characters" />
                </div>
                <div>
                  <label className={labelCls}>Confirm Password</label>
                  <PasswordInput required value={signupForm.confirm_password} onChange={e => setSignupForm({ ...signupForm, confirm_password: e.target.value })} />
                </div>
                <button type="submit" disabled={signupLoading}
                  className="text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-60 mt-1"
                  style={{ background: MAROON }}>
                  {signupLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Sending request...
                    </span>
                  ) : 'Send Activation Request'}
                </button>
                <p className="text-xs text-center text-gray-400">
                  Already activated? <button type="button" onClick={() => setInstructorMode('signin')} className="underline" style={{ color: MAROON }}>Sign In</button>
                </p>
              </form>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4 pt-1">
          © {new Date().getFullYear()} Goa Community College
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
