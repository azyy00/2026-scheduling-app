import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const adminLinks = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/schedules', label: 'Schedules' },
  { to: '/admin/classrooms', label: 'Classrooms' },
  { to: '/admin/instructors', label: 'Instructors' },
  { to: '/admin/sections', label: 'Sections' },
  { to: '/admin/subjects', label: 'Subjects' },
  { to: '/admin/students', label: 'Students' },
];

const instructorLinks = [
  { to: '/instructor/dashboard', label: 'My Schedule' },
];

const studentLinks = [
  { to: '/student/schedule', label: 'My Schedule' },
];

const linksByRole = { admin: adminLinks, instructor: instructorLinks, student: studentLinks };

const Sidebar = () => {
  const { user } = useAuth();
  const links = linksByRole[user?.role] || [];

  return (
    <aside className="w-56 bg-gray-900 text-gray-200 min-h-screen flex flex-col py-5">
      <p className="text-xs uppercase tracking-widest text-gray-500 px-5 mb-3 font-semibold">Menu</p>
      <nav className="flex flex-col gap-0.5 px-3">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'text-white'
                  : 'hover:bg-gray-800 text-gray-400'
              }`
            }
            style={({ isActive }) => isActive ? { background: '#7B1C1C' } : {}}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
