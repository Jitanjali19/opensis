import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CalendarRange, LogOut, Menu, X, ChevronRight, Home, Code2, Bell, Pin, ExternalLink } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Layout({ children, navItems }) {
  // 1. selectedTerm yahan AuthContext se already aa raha hai
  const { user, logout, sessions, sessionDetails, selectedSession, setSelectedSession, selectedTerm, setSelectedTerm } = useAuth();
  
  const selectedDetails = sessionDetails.find(item => item.session === selectedSession);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notices, setNotices] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const noticesRef = useRef(null);

  const noticesRoute = user?.role === 'student' ? '/student/notices' : user?.role === 'admin' ? '/admin/notices' : '/faculty/notices';

  useEffect(() => {
    if (!user) return;
    const endpoint = user.role === 'faculty' ? '/faculty/notices' : user.role === 'student' ? '/student/notices' : '/admin/notices';
    api.get(endpoint)
      .then(res => {
        const list = res.data?.data?.notices || [];
        setNotices(list);
        const count = res.data?.data?.unreadCount != null
          ? res.data.data.unreadCount
          : list.filter(n => !n.isRead).length;
        setUnreadCount(count);
      })
      .catch(() => {
        setNotices([]);
        setUnreadCount(0);
      });
  }, [user, selectedSession]);

  const handleToggleNotices = () => {
    const willOpen = !noticesOpen;
    setNoticesOpen(willOpen);

    // If opening dropdown and there were unread notices, mark as read in backend & clear badge
    if (willOpen && unreadCount > 0) {
      const markEndpoint = user?.role === 'faculty'
        ? '/faculty/notices/mark-read'
        : user?.role === 'student'
        ? '/student/notices/mark-read'
        : null;

      if (markEndpoint) {
        api.post(markEndpoint, {}).catch(() => {});
      }
      setUnreadCount(0);
      setNotices(prev => prev.map(n => ({ ...n, isRead: true })));
    }
  };

  useEffect(() => {
    const handleOutside = (e) => {
      if (noticesRef.current && !noticesRef.current.contains(e.target)) {
        setNoticesOpen(false);
      }
    };
    if (noticesOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [noticesOpen]);

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
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between lg:hidden flex-shrink-0">
          <div className="flex items-center gap-3">
            <button aria-label="Open navigation menu" onClick={() => setSidebarOpen(true)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-slate-800"><Menu className="w-5 h-5" /></button>
            <img src="/sgsits_logo.png" alt="SGSITS Logo" className="w-7 h-7 object-contain rounded-full" />
            <span className="font-bold text-slate-800 text-sm">SGSITS</span>
          </div>
          <button
            type="button"
            onClick={handleToggleNotices}
            aria-label="View notices"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs text-slate-500">
            <Home className="h-3.5 w-3.5 flex-shrink-0" />
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
            <span className="truncate font-medium text-slate-700">{pageLabel}</span>
          </nav>
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {user?.role !== 'admin' && sessions.length > 0 && (
              <>
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
              </>
            )}

            {/* Notification Bell Dropdown */}
            <div className="relative" ref={noticesRef}>
              <button
                type="button"
                onClick={handleToggleNotices}
                aria-label="View notices"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-sm"
                title={unreadCount > 0 ? `${unreadCount} unread notices` : 'Notices'}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {noticesOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Dropdown Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-4 py-3 text-white">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-amber-400" />
                      <span className="text-xs font-bold text-white tracking-wide uppercase">Campus Notices</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {notices.length} {notices.length === 1 ? 'Notice' : 'Notices'}
                    </span>
                  </div>

                  {/* Dropdown List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notices.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        <Bell className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                        No notices available right now
                      </div>
                    ) : (
                      notices.slice(0, 4).map(notice => (
                        <Link
                          key={notice._id}
                          to={noticesRoute}
                          onClick={() => setNoticesOpen(false)}
                          className="block p-3.5 hover:bg-slate-50 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                {notice.isPinned && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                                    <Pin className="h-2.5 w-2.5" /> Pinned
                                  </span>
                                )}
                                <span className="text-[10px] font-medium text-slate-400">
                                  {new Date(notice.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-slate-800 group-hover:text-primary-600 transition-colors truncate">
                                {notice.title}
                              </p>
                              <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                                {notice.body}
                              </p>
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary-500 shrink-0 mt-1 transition-colors" />
                          </div>
                        </Link>
                      ))
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="border-t border-slate-100 bg-slate-50 p-2.5 text-center">
                    <Link
                      to={noticesRoute}
                      onClick={() => setNoticesOpen(false)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-800 transition-colors py-1 px-3"
                    >
                      View all notices ({notices.length}) →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <main id="main-content" className="flex-1 overflow-y-auto bg-slate-100/70 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
