import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CalendarRange, LogOut, Menu, X, ChevronRight, Home, Code2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Layout({ children, navItems }) {
  const { user, logout, sessions, sessionDetails, selectedSession, setSelectedSession } = useAuth();
  const selectedDetails = sessionDetails.find(item => item.session === selectedSession);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const selectedTerm = selectedDetails?.term || localStorage.getItem('erp_academic_term') || (new Date().getMonth() >= 6 ? 'july-december' : 'january-june');

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const displayName = user?.profile
    ? `${user.profile.firstName} ${user.profile.lastName}`
    : user?.email;
  const pageLabel = navItems.find(item => location.pathname === item.path)?.label
    || navItems.find(item => location.pathname.startsWith(`${item.path}/`))?.label
    || 'Page';
  const regularNavItems = navItems.filter(item => item.section !== 'developer');
  const developerNavItems = navItems.filter(item => item.section === 'developer');

  const renderNavItem = ({ path, label, icon: Icon }) => {
    const active = location.pathname === path || location.pathname.startsWith(`${path}/`);
    return (
      <Link
        key={path}
        to={path}
        onClick={() => setSidebarOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 mb-1 text-sm font-semibold transition-colors ${
          active
            ? 'bg-white/10 text-white shadow-sm border border-white/5'
            : 'text-slate-400 hover:bg-white/5 hover:text-white'
        }`}
      >
        <Icon className={`h-4.5 w-4.5 transition-colors ${active ? 'text-sgsits-gold-500' : 'text-slate-400'}`} />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100/70 font-sans">
      {/* Sidebar - Redesigned Dark Sidebar Matching Login Theme */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0b0f19] border-r border-slate-950 flex flex-col h-full transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex lg:h-full flex-shrink-0`}>
        {/* Sidebar Header with Large SGSITS Logo & Centered Branding */}
        <div className="flex flex-col items-center px-6 py-6 border-b border-slate-900 bg-[#070a12] relative flex-shrink-0">
          <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg border border-sgsits-gold-500/20 p-1 mb-3 bg-white">
            <img src="/sgsits_logo.png" alt="SGSITS Logo" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="flex flex-col items-center">
            <span className="font-black text-white text-lg tracking-tight leading-none text-center">SGSITS INDORE</span>
            <span className="text-[9px] font-extrabold text-sgsits-gold-500 tracking-widest uppercase mt-2 text-center">ERP PORTAL</span>
          </div>
          <button aria-label="Close navigation menu" className="absolute top-4 right-4 lg:hidden text-slate-400 hover:text-white transition-colors" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Navigation - Scrollable middle area */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto min-h-0 no-scrollbar">
          {regularNavItems.map(renderNavItem)}
          {developerNavItems.length > 0 && (
            <div className="mt-5 border-t border-slate-800 pt-4">
              <p className="mb-2 flex items-center gap-2 px-3.5 text-[10px] font-bold uppercase tracking-widest text-amber-400"><Code2 className="h-3.5 w-3.5" /> Developer tools</p>
              {developerNavItems.map(renderNavItem)}
              <p className="px-3.5 pt-1 text-[10px] leading-4 text-slate-500">For testing only. Do not use with live data.</p>
            </div>
          )}
        </nav>

        {/* Sidebar Footer User Profile - Locked at bottom */}
        <div className="px-3 py-4 border-t border-slate-900 bg-[#070a12] flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white font-bold text-sm border border-white/5">
              {displayName?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{displayName}</p>
              <p className="text-[10px] font-bold text-sgsits-gold-500 capitalize mt-0.5">{user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex min-h-[44px] items-center gap-3 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 rounded-lg w-full transition-colors">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main Container - Independent scrollbar */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 lg:hidden flex-shrink-0">
          <button aria-label="Open navigation menu" onClick={() => setSidebarOpen(true)} className="min-h-[44px] min-w-[44px] text-slate-600 hover:text-slate-800"><Menu className="mx-auto w-5 h-5" /></button>
          <img src="/sgsits_logo.png" alt="SGSITS Logo" className="w-7 h-7 object-contain rounded-full" />
          <span className="font-bold text-slate-800">SGSITS</span>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs text-slate-500">
            <Home className="h-3.5 w-3.5 flex-shrink-0" />
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
            <span className="truncate font-medium text-slate-700">{pageLabel}</span>
          </nav>
          {user?.role !== 'admin' && sessions.length > 0 && <div className="flex flex-wrap items-center justify-end gap-2">
          <CalendarRange className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-500">Academic session</span>
          <select aria-label="Choose academic session" className="min-h-[36px] rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
            {sessions.map(session => <option key={session} value={session}>{session}</option>)}
          </select>
          {selectedDetails?.status === 'current' && (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
              {selectedTerm === 'july-december' ? 'Jul-Dec' : 'Jan-Jun'}
            </span>
          )}
          {selectedDetails?.semester && <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${selectedSession === sessions[0] ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {selectedSession === sessions[0] ? 'Current session' : 'Read-only historical session'}
          </span>}
          </div>}
        </div>
        <main id="main-content" className="flex-1 overflow-y-auto bg-slate-100/70 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
