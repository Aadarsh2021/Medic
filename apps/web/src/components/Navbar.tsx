'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Search,
  Building2,
  LogOut,
  CheckCircle2,
  Menu,
  Stethoscope,
  User,
  Pill,
  FlaskConical,
  Receipt,
  Activity,
  ChevronDown,
} from 'lucide-react';
import { User as UserType, NotificationItem } from '../types';
import { useAuthStore } from '../store/useAuthStore';

interface NavbarProps {
  currentUser: UserType | null;
  notifications: NotificationItem[];
  unreadCount: number;
  onOpenSearch: () => void;
  onMarkNotificationRead: (id: string) => void;
  onToggleMobileSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  notifications,
  unreadCount,
  onOpenSearch,
  onMarkNotificationRead,
  onToggleMobileSidebar,
}) => {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getPortalTitle = () => {
    switch (currentUser?.role) {
      case 'DOCTOR':
        return 'Clinical Doctor Desk';
      case 'PATIENT':
        return 'Patient Health Portal';
      case 'PHARMACIST':
        return 'Pharmacy Inventory';
      case 'LAB_TECHNICIAN':
        return 'Diagnostics Laboratory';
      case 'ACCOUNTANT':
        return 'Billing & Ledger';
      default:
        return 'Executive Operations';
    }
  };

  const renderPortalIcon = () => {
    switch (currentUser?.role) {
      case 'DOCTOR':
        return <Stethoscope className="w-5 h-5" />;
      case 'PATIENT':
        return <User className="w-5 h-5" />;
      case 'PHARMACIST':
        return <Pill className="w-5 h-5" />;
      case 'LAB_TECHNICIAN':
        return <FlaskConical className="w-5 h-5" />;
      case 'ACCOUNTANT':
        return <Receipt className="w-5 h-5" />;
      default:
        return <Building2 className="w-5 h-5" />;
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-2xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 flex items-center justify-center text-white shadow-xs">
            {renderPortalIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight leading-none">
                MedCore <span className="text-teal-600">{getPortalTitle()}</span>
              </h1>
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Network Active
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mt-0.5">
              {currentUser?.hospitalName || 'MedCore City General Hospital'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700">
          <Activity className="w-3.5 h-3.5 text-teal-600" />
          <span>OPD Queue: <strong>Normal</strong></span>
          <span className="text-slate-300">|</span>
          <span>Trauma Bay 1: <strong className="text-emerald-700">Ready</strong></span>
        </div>

        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
        >
          <Search className="w-3.5 h-3.5 text-teal-600" />
          <span className="hidden sm:inline">Search records...</span>
          <kbd className="hidden sm:inline bg-white text-slate-500 px-1.5 py-0.5 rounded text-[10px] border border-slate-300 font-mono">⌘K</kbd>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 relative transition"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">Clinical Notifications</span>
                <span className="text-xs text-teal-700 bg-teal-50 font-bold px-2 py-0.5 rounded border border-teal-200">{unreadCount} New</span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">No active notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => onMarkNotificationRead(n.id)}
                      className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition ${!n.isRead ? 'bg-teal-50/50 font-medium' : 'opacity-70'}`}
                    >
                      <div className="flex items-center justify-between text-slate-900 font-bold mb-1">
                        <span>{n.title}</span>
                        {!n.isRead && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />}
                      </div>
                      <p className="text-slate-600">{n.message}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">{new Date(n.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
          >
            <div className="w-7 h-7 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {currentUser?.firstName?.[0] || 'U'}
            </div>
            <div className="text-left hidden lg:block text-xs">
              <div className="font-bold text-slate-900 leading-none">{currentUser?.firstName} {currentUser?.lastName}</div>
              <div className="text-slate-500 text-[10px] font-medium mt-0.5">{currentUser?.role.replace('_', ' ')}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 p-1">
              <div className="px-3 py-2 border-b border-slate-100 text-xs">
                <div className="font-bold text-slate-900">{currentUser?.firstName} {currentUser?.lastName}</div>
                <div className="text-slate-500 text-[10px]">{currentUser?.email}</div>
                <div className="text-teal-700 text-[10px] font-bold mt-1 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 inline-block">
                  {currentUser?.role.replace('_', ' ')}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 font-semibold hover:bg-rose-50 rounded-lg transition mt-1"
              >
                <LogOut className="w-3.5 h-3.5" /> End Session & Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
