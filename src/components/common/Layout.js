import React from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout = ({ children }) => (
  <div className="flex flex-col min-h-screen bg-slate-50">
    <Navbar />
    <div className="flex flex-1 min-h-0">
      <Sidebar />
      <main className="flex-1 p-7 overflow-auto">{children}</main>
    </div>
  </div>
);

export default Layout;
