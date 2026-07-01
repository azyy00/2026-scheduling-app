import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, CalendarDays, DoorOpen, Users, Layers,
  BookOpen, GraduationCap, ClipboardList, Star, X,
} from 'lucide-react';

const icons = {
  Dashboard:    <LayoutDashboard className="w-4 h-4 shrink-0" />,
  Schedules:    <CalendarDays    className="w-4 h-4 shrink-0" />,
  Classrooms:   <DoorOpen        className="w-4 h-4 shrink-0" />,
  Instructors:  <Users           className="w-4 h-4 shrink-0" />,
  Sections:     <Layers          className="w-4 h-4 shrink-0" />,
  Subjects:     <BookOpen        className="w-4 h-4 shrink-0" />,
  Students:     <GraduationCap   className="w-4 h-4 shrink-0" />,
  'My Schedule':<ClipboardList   className="w-4 h-4 shrink-0" />,
  Events:       <Star            className="w-4 h-4 shrink-0" />,
};

const adminLinks = [
  { to: '/admin/dashboard',   label: 'Dashboard' },
  { to: '/admin/schedules',   label: 'Schedules' },
  { to: '/admin/classrooms',  label: 'Classrooms' },
  { to: '/admin/instructors', label: 'Instructors' },
  { to: '/admin/sections',    label: 'Sections' },
  { to: '/admin/subjects',    label: 'Subjects' },
  { to: '/admin/students',    label: 'Students' },
  { to: '/events',            label: 'Events' },
];
const instructorLinks = [
  { to: '/instructor/dashboard', label: 'My Schedule' },
  { to: '/events',               label: 'Events' },
];
const studentLinks = [
  { to: '/student/schedule', label: 'My Schedule' },
  { to: '/events',           label: 'Events' },
];
const linksByRole = { admin: adminLinks, instructor: instructorLinks, student: studentLinks };

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const links = linksByRole[user?.role] || [];

  return (
    <aside className={`
      fixed lg:sticky top-0 lg:top-[57px] inset-y-0 lg:inset-y-auto left-0 z-40
      w-56 lg:h-[calc(100vh-57px)] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
      flex flex-col py-6 shrink-0
      transform transition-transform duration-200 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      <button onClick={onClose} className="lg:hidden absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
        <X className="w-5 h-5" />
      </button>

      <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-600 px-5 mb-3 font-bold">Navigation</p>
      <nav className="flex flex-col gap-0.5 px-3">
        {links.map(({ to, label }) => (
          <NavLink key={to} to={to} onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#7B1C1C] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            {icons[label]}
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Developer credit */}
      <div className="mt-auto px-5 pt-4">
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-300 dark:text-gray-600 font-bold">Developed by</p>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">Anthony Azuela</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
