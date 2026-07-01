import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import logo from '../../assets/logo.png';
import building from '../../assets/gcc-building.jpg';
import campusBackground from '../../assets/gcc-campus-background.jpg';
import { Eye, EyeOff, Lock, ArrowLeft, Mail, ShieldCheck } from 'lucide-react';

const PROGRAMS = ['BPED', 'BECED', 'BCAED'];
const TAGLINES = [
  'Every class, in its place.',
  'Conflict-free timetables, every term.',
  'One schedule, always up to date.',
];

const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/40 focus:border-[#7B1C1C] transition';

const PasswordInput = ({ value, onChange, placeholder, required, autoComplete, ariaLabel }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value} onChange={onChange} placeholder={placeholder} aria-label={ariaLabel || placeholder}
        required={required} autoComplete={autoComplete}
        className={inputCls + ' pr-11'}
      />
      <button type="button" onClick={() => setShow(s => !s)} tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

const SubmitButton = ({ loading, loadingText, children }) => (
  <button type="submit" disabled={loading}
    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#7B1C1C] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6a1717] focus:outline-none focus:ring-2 focus:ring-[#7B1C1C]/50 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-60">
    {loading ? (<><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{loadingText}</>) : children}
  </button>
);

const LoginPage = () => {
  const [activeTab, setActiveTab] = useState('Admin');
  const [instructorMode, setInstructorMode] = useState('signin');
  const [studentMode, setStudentMode] = useState('signin');
  const [form, setForm] = useState({ username: '', password: '', student_id: '' });
  const [signupForm, setSignupForm] = useState({ last_name: '', first_name: '', department: '', desired_username: '', password: '', confirm_password: '' });
  const [studentSignup, setStudentSignup] = useState({ student_id: '', last_name: '', first_name: '', middle_name: '', year_level: '', section_id: '' });
  const [sections, setSections] = useState([]);
  const [signupLoading, setSignupLoading] = useState(false);
  const [studentSignupLoading, setStudentSignupLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotRole, setForgotRole] = useState('Admin');
  const [forgotStep, setForgotStep] = useState('request');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotForm, setForgotForm] = useState({ identifier: '', code: '', password: '', confirm_password: '' });
  const [slide, setSlide] = useState(0);
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % TAGLINES.length), 5000);
    return () => clearInterval(t);
  }, []);

  // Load sections for the student registration dropdown (public, no auth)
  useEffect(() => {
    if (activeTab === 'Student' && studentMode === 'register' && sections.length === 0) {
      api.get('/auth?action=public-sections').then(({ data }) => setSections(data)).catch(() => {});
    }
  }, [activeTab, studentMode, sections.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const role = activeTab.toLowerCase();
    const credentials = role === 'student'
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
    if (signupForm.password !== signupForm.confirm_password) return toast.error('Passwords do not match.');
    if (signupForm.password.length < 8) return toast.error('Password must be at least 8 characters.');
    setSignupLoading(true);
    try {
      const { data } = await api.post('/auth?action=instructor-signup', {
        last_name: signupForm.last_name, first_name: signupForm.first_name,
        department: signupForm.department, desired_username: signupForm.desired_username, password: signupForm.password,
      });
      toast.success(data.message, { duration: 5000 });
      setInstructorMode('signin');
      setSignupForm({ last_name: '', first_name: '', department: '', desired_username: '', password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed.');
    } finally { setSignupLoading(false); }
  };

  const handleStudentSignup = async (e) => {
    e.preventDefault();
    const { student_id, last_name, first_name, middle_name, year_level, section_id } = studentSignup;
    if (!student_id.trim() || !last_name.trim() || !first_name.trim()) return toast.error('Student ID, first name and last name are required.');
    if (!year_level || !section_id) return toast.error('Please select your year level and section.');
    const name = `${first_name.trim()} ${middle_name.trim()} ${last_name.trim()}`.replace(/\s+/g, ' ').trim();
    setStudentSignupLoading(true);
    try {
      const { data } = await api.post('/auth?action=student-signup', { student_id: student_id.trim(), name, year_level, section_id });
      toast.success(data.message, { duration: 5000 });
      setStudentMode('signin');
      setStudentSignup({ student_id: '', last_name: '', first_name: '', middle_name: '', year_level: '', section_id: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed.');
    } finally { setStudentSignupLoading(false); }
  };

  const resetForgot = () => {
    setShowForgot(false);
    setForgotStep('request');
    setForgotLoading(false);
    setForgotForm({ identifier: '', code: '', password: '', confirm_password: '' });
  };

  const openForgot = () => {
    setForgotRole(activeTab);
    setForgotStep(activeTab === 'Admin' ? 'request' : 'contact');
    setForgotForm({ identifier: activeTab === 'Admin' ? form.username : '', code: '', password: '', confirm_password: '' });
    setShowForgot(true);
  };

  const handleForgotRequest = async (e) => {
    e.preventDefault();
    if (!forgotForm.identifier.trim()) return toast.error('Enter your admin username or recovery email.');
    setForgotLoading(true);
    try {
      const { data } = await api.post('/auth?action=request-password-reset', { identifier: forgotForm.identifier.trim() });
      toast.success(data.message, { duration: 5000 });
      setForgotStep('verify');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send reset code.');
    } finally { setForgotLoading(false); }
  };

  const handleForgotReset = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(forgotForm.code.trim())) return toast.error('Enter the 6-digit reset code.');
    if (forgotForm.password.length < 8) return toast.error('Password must be at least 8 characters.');
    if (forgotForm.password !== forgotForm.confirm_password) return toast.error('Passwords do not match.');
    setForgotLoading(true);
    try {
      const { data } = await api.post('/auth?action=reset-password', {
        identifier: forgotForm.identifier.trim(),
        code: forgotForm.code.trim(),
        new_password: forgotForm.password,
      });
      toast.success(data.message, { duration: 5000 });
      setForm(prev => ({ ...prev, username: forgotForm.identifier.includes('@') ? '' : forgotForm.identifier.trim(), password: '' }));
      resetForgot();
      setActiveTab('Admin');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reset password.');
    } finally { setForgotLoading(false); }
  };

  const selectRole = (tab) => { setActiveTab(tab); setInstructorMode('signin'); setStudentMode('signin'); resetForgot(); };

  const heading = (() => {
    if (showForgot) return forgotRole === 'Admin'
      ? ['Reset admin password', 'Send a 6-digit code to your recovery email.']
      : ['Reset your password', 'Ask an admin to set a new password for you.'];
    if (activeTab === 'Admin') return ['Welcome back', 'Sign in to manage schedules and accounts.'];
    if (activeTab === 'Instructor') return instructorMode === 'signin'
      ? ['Welcome back', 'Sign in to view and manage your classes.']
      : ['Create your account', 'Activated once an admin approves it.'];
    return studentMode === 'signin'
      ? ['Welcome back', 'Enter your ID number to view your schedule.']
      : ['Create an account', 'Submit your details for admin approval.'];
  })();

  // contextual sign-in / register switch line under the heading
  const switchLine = (() => {
    if (showForgot || activeTab === 'Admin') return null;
    if (activeTab === 'Instructor') return instructorMode === 'signin'
      ? { text: 'First time here?', action: 'Create account', go: () => setInstructorMode('signup') }
      : { text: 'Already have an account?', action: 'Sign in', go: () => setInstructorMode('signin') };
    return studentMode === 'signin'
      ? { text: 'New student?', action: 'Register', go: () => setStudentMode('register') }
      : { text: 'Already approved?', action: 'Sign in', go: () => setStudentMode('signin') };
  })();

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center p-4 sm:p-6 bg-white lg:bg-gray-950">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center blur-md hidden lg:block"
        style={{ backgroundImage: `url(${campusBackground})` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-black/50 hidden lg:block" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 lg:rounded-3xl lg:overflow-hidden lg:shadow-[0_28px_90px_rgba(0,0,0,0.45)] bg-white lg:ring-1 lg:ring-white/25">
        {/* Image panel */}
        <div className="relative hidden lg:block min-h-[620px]"
          style={{ backgroundImage: `url(${building})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          {/* maroon tint + bottom scrim for legibility */}
          <div className="absolute inset-0" style={{ background: 'rgba(40,12,12,0.45)' }} />
          <div className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))' }} />

          <div className="relative h-full flex flex-col justify-between p-8">
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="GCC" className="w-10 h-10 rounded-full object-cover border border-white/30" onError={e => e.target.style.display = 'none'} />
              <span className="text-white font-semibold tracking-wide text-sm">Goa Community College</span>
            </div>

            <div>
              <h2 className="text-white text-2xl font-bold leading-snug min-h-[64px] transition-opacity duration-500">
                {TAGLINES[slide]}
              </h2>
              <div className="flex gap-1.5 mt-4">
                {TAGLINES.map((_, i) => (
                  <button key={i} onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-7 bg-white' : 'w-3.5 bg-white/40 hover:bg-white/60'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="bg-white px-5 py-10 sm:px-10 flex flex-col justify-center w-full max-w-md mx-auto lg:max-w-none lg:mx-0">
          {/* Mobile brand */}
          <div className="lg:hidden flex flex-col items-center justify-center gap-2 mb-8 text-center">
            <img src={logo} alt="GCC" className="w-16 h-16 rounded-full object-cover border border-gray-200" onError={e => e.target.style.display = 'none'} />
            <span className="text-gray-900 font-semibold text-sm">Goa Community College</span>
          </div>

          {/* Role selector */}
          {!showForgot && (
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 mb-7">
              {['Admin', 'Instructor', 'Student'].map(tab => (
                <button key={tab} onClick={() => selectRole(tab)}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${activeTab === tab ? 'bg-[#7B1C1C] text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{heading[0]}</h1>
            <p className="text-sm text-gray-500 mt-1.5">
              {switchLine ? (
                <>{switchLine.text}{' '}
                  <button type="button" onClick={switchLine.go} className="font-semibold text-[#7B1C1C] underline underline-offset-2 hover:text-[#6a1717]">{switchLine.action}</button>
                </>
              ) : heading[1]}
            </p>
          </div>

          {/* ── Forgot password ── */}
          {showForgot && (
            <div>
              {forgotRole === 'Admin' ? (
                forgotStep === 'request' ? (
                  <form onSubmit={handleForgotRequest} className="flex flex-col gap-3.5">
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-center gap-2 text-blue-700 mb-1.5">
                        <Mail className="w-4 h-4" />
                        <p className="font-semibold text-sm">Email verification code</p>
                      </div>
                      <p className="text-xs text-blue-700/80 leading-relaxed">
                        Enter the admin username or recovery email. A 6-digit code will be sent to the email saved on that admin account.
                      </p>
                    </div>
                    <input type="text" required autoComplete="username" aria-label="Admin username or recovery email" placeholder="Admin username or recovery email"
                      value={forgotForm.identifier} onChange={e => setForgotForm({ ...forgotForm, identifier: e.target.value })} className={inputCls} />
                    <SubmitButton loading={forgotLoading} loadingText="Sending code…">Send reset code</SubmitButton>
                  </form>
                ) : (
                  <form onSubmit={handleForgotReset} className="flex flex-col gap-3.5">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-center gap-2 text-emerald-700 mb-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        <p className="font-semibold text-sm">Check your email</p>
                      </div>
                      <p className="text-xs text-emerald-700/80 leading-relaxed">
                        The code expires in 10 minutes. Use it once to create a new admin password.
                      </p>
                    </div>
                    <input type="text" inputMode="numeric" maxLength={6} required aria-label="Reset code" placeholder="6-digit code"
                      value={forgotForm.code} onChange={e => setForgotForm({ ...forgotForm, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} className={inputCls + ' text-center tracking-[0.35em] font-bold'} />
                    <PasswordInput required autoComplete="new-password" placeholder="New password"
                      value={forgotForm.password} onChange={e => setForgotForm({ ...forgotForm, password: e.target.value })} />
                    <PasswordInput required autoComplete="new-password" placeholder="Confirm new password"
                      value={forgotForm.confirm_password} onChange={e => setForgotForm({ ...forgotForm, confirm_password: e.target.value })} />
                    <SubmitButton loading={forgotLoading} loadingText="Updating…">Reset password</SubmitButton>
                    <button type="button" onClick={() => setForgotStep('request')}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-800">
                      Use a different username or resend code
                    </button>
                  </form>
                )
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-center gap-2 text-amber-700 mb-2">
                    <Lock className="w-4 h-4" />
                    <p className="font-semibold text-sm">Passwords are reset by an admin</p>
                  </div>
                  <p className="text-xs text-amber-700/80 leading-relaxed">
                    For your security, contact your System Administrator to set a new password.
                  </p>
                  <div className="mt-3 rounded-lg bg-amber-100/50 border border-amber-100 px-4 py-3 text-xs text-gray-600">
                    Admin → <span className="font-semibold text-gray-800">Instructors</span> → Edit → set a new password.
                  </div>
                </div>
              )}
              <button onClick={resetForgot}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
            </div>
          )}

          {/* ── Admin ── */}
          {!showForgot && activeTab === 'Admin' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <input type="text" required autoComplete="username" aria-label="Username" placeholder="Username"
                value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className={inputCls} />
              <PasswordInput required autoComplete="current-password" placeholder="Enter your password"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              <div className="flex justify-end -mt-1 mb-1">
                <button type="button" onClick={openForgot} className="text-xs font-medium text-gray-500 hover:text-gray-800">Forgot password?</button>
              </div>
              <SubmitButton loading={loading} loadingText="Signing in…">Sign in</SubmitButton>
            </form>
          )}

          {/* ── Instructor ── */}
          {!showForgot && activeTab === 'Instructor' && instructorMode === 'signin' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <input type="text" required autoComplete="username" aria-label="Username" placeholder="Username"
                value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className={inputCls} />
              <PasswordInput required autoComplete="current-password" placeholder="Enter your password"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              <div className="flex justify-end -mt-1 mb-1">
                <button type="button" onClick={openForgot} className="text-xs font-medium text-gray-500 hover:text-gray-800">Forgot password?</button>
              </div>
              <SubmitButton loading={loading} loadingText="Signing in…">Sign in</SubmitButton>
            </form>
          )}

          {!showForgot && activeTab === 'Instructor' && instructorMode === 'signup' && (
            <form onSubmit={handleSignup} className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3">
                <input required aria-label="First name" placeholder="First name" value={signupForm.first_name} onChange={e => setSignupForm({ ...signupForm, first_name: e.target.value })} className={inputCls} />
                <input required aria-label="Last name" placeholder="Last name" value={signupForm.last_name} onChange={e => setSignupForm({ ...signupForm, last_name: e.target.value })} className={inputCls} />
              </div>
              <select required aria-label="Program" value={signupForm.department} onChange={e => setSignupForm({ ...signupForm, department: e.target.value })} className={inputCls + ' ' + (signupForm.department ? '' : 'text-gray-500')}>
                <option value="" className="text-gray-900">Select your program</option>
                {PROGRAMS.map(p => <option key={p} value={p} className="text-gray-900">{p}</option>)}
              </select>
              <input required aria-label="Username" placeholder="Choose a username" value={signupForm.desired_username} onChange={e => setSignupForm({ ...signupForm, desired_username: e.target.value })} className={inputCls} />
              <div className="grid grid-cols-2 gap-3">
                <PasswordInput required placeholder="Password" value={signupForm.password} onChange={e => setSignupForm({ ...signupForm, password: e.target.value })} />
                <PasswordInput required placeholder="Confirm" value={signupForm.confirm_password} onChange={e => setSignupForm({ ...signupForm, confirm_password: e.target.value })} />
              </div>
              <SubmitButton loading={signupLoading} loadingText="Sending…">Create account</SubmitButton>
            </form>
          )}

          {/* ── Student ── */}
          {!showForgot && activeTab === 'Student' && studentMode === 'signin' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <input type="text" required aria-label="Student ID number" placeholder="Student ID number (e.g. 2024-00001)"
                value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} className={inputCls} />
              <SubmitButton loading={loading} loadingText="Signing in…">Sign in</SubmitButton>
            </form>
          )}

          {!showForgot && activeTab === 'Student' && studentMode === 'register' && (
            <form onSubmit={handleStudentSignup} className="flex flex-col gap-3.5">
              <input required aria-label="Student ID number" placeholder="Student ID number" value={studentSignup.student_id} onChange={e => setStudentSignup({ ...studentSignup, student_id: e.target.value })} className={inputCls} />
              <input required aria-label="Last name" placeholder="Last name" value={studentSignup.last_name} onChange={e => setStudentSignup({ ...studentSignup, last_name: e.target.value })} className={inputCls} />
              <div className="grid grid-cols-2 gap-3">
                <input required aria-label="First name" placeholder="First name" value={studentSignup.first_name} onChange={e => setStudentSignup({ ...studentSignup, first_name: e.target.value })} className={inputCls} />
                <input aria-label="Middle name" placeholder="Middle name" value={studentSignup.middle_name} onChange={e => setStudentSignup({ ...studentSignup, middle_name: e.target.value })} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select required aria-label="Year level" value={studentSignup.year_level}
                  onChange={e => setStudentSignup({ ...studentSignup, year_level: e.target.value, section_id: '' })}
                  className={inputCls + ' ' + (studentSignup.year_level ? '' : 'text-gray-500')}>
                  <option value="" className="text-gray-900">Year level</option>
                  {[1, 2, 3, 4].map(y => <option key={y} value={y} className="text-gray-900">{['1st', '2nd', '3rd', '4th'][y - 1]} Year</option>)}
                </select>
                <select required aria-label="Section" value={studentSignup.section_id} disabled={!studentSignup.year_level}
                  onChange={e => setStudentSignup({ ...studentSignup, section_id: e.target.value })}
                  className={inputCls + ' disabled:opacity-50 ' + (studentSignup.section_id ? '' : 'text-gray-500')}>
                  <option value="" className="text-gray-900">{studentSignup.year_level ? 'Section' : 'Pick year first'}</option>
                  {sections.filter(s => !studentSignup.year_level || String(s.year_level) === String(studentSignup.year_level))
                    .map(s => <option key={s.id} value={s.id} className="text-gray-900">{s.name}</option>)}
                </select>
              </div>
              <SubmitButton loading={studentSignupLoading} loadingText="Sending…">Send registration</SubmitButton>
            </form>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">
            Developed by Anthony Azuela · © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
