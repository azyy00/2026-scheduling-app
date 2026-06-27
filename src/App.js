import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/common/Layout';
import ChunkErrorBoundary from './components/common/ChunkErrorBoundary';

// Eager-load login (critical path)
import LoginPage from './pages/auth/LoginPage';

// Lazy-load everything else (faster initial bundle)
const AdminDashboard    = lazy(() => import('./pages/admin/Dashboard'));
const Schedules         = lazy(() => import('./pages/admin/Schedules'));
const Classrooms        = lazy(() => import('./pages/admin/Classrooms'));
const Instructors       = lazy(() => import('./pages/admin/Instructors'));
const InstructorSchedule= lazy(() => import('./pages/admin/InstructorSchedule'));
const Sections          = lazy(() => import('./pages/admin/Sections'));
const Subjects          = lazy(() => import('./pages/admin/Subjects'));
const Students          = lazy(() => import('./pages/admin/Students'));
const InstructorDashboard = lazy(() => import('./pages/instructor/Dashboard'));
const StudentSchedule   = lazy(() => import('./pages/student/Schedule'));

// Page-level loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-gray-200 animate-spin" style={{ borderTopColor: '#7B1C1C' }} />
      <p className="text-sm text-gray-400 animate-pulse">Loading...</p>
    </div>
  </div>
);

const AdminLayout = ({ children }) => (
  <ProtectedRoute allowedRoles={['admin']}>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

const InstructorLayout = ({ children }) => (
  <ProtectedRoute allowedRoles={['instructor']}>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

const StudentLayout = ({ children }) => (
  <ProtectedRoute allowedRoles={['student']}>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: { fontSize: '13px', maxWidth: '360px' },
            success: { iconTheme: { primary: '#7B1C1C', secondary: '#fff' } },
          }}
        />
        <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/unauthorized" element={
              <div className="flex flex-col items-center justify-center min-h-screen gap-3">
                <p className="text-4xl">🚫</p>
                <p className="text-gray-600 font-medium">Access Denied</p>
                <a href="/login" className="text-sm underline" style={{ color: '#7B1C1C' }}>Go to Login</a>
              </div>
            } />

            {/* Admin */}
            <Route path="/admin/dashboard"              element={<AdminLayout><AdminDashboard /></AdminLayout>} />
            <Route path="/admin/schedules"              element={<AdminLayout><Schedules /></AdminLayout>} />
            <Route path="/admin/classrooms"             element={<AdminLayout><Classrooms /></AdminLayout>} />
            <Route path="/admin/instructors"            element={<AdminLayout><Instructors /></AdminLayout>} />
            <Route path="/admin/instructors/:id/schedule" element={<AdminLayout><InstructorSchedule /></AdminLayout>} />
            <Route path="/admin/sections"               element={<AdminLayout><Sections /></AdminLayout>} />
            <Route path="/admin/subjects"               element={<AdminLayout><Subjects /></AdminLayout>} />
            <Route path="/admin/students"               element={<AdminLayout><Students /></AdminLayout>} />

            {/* Instructor */}
            <Route path="/instructor/dashboard" element={<InstructorLayout><InstructorDashboard /></InstructorLayout>} />

            {/* Student */}
            <Route path="/student/schedule" element={<StudentLayout><StudentSchedule /></StudentLayout>} />
          </Routes>
        </Suspense>
        </ChunkErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
