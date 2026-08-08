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
  currentUser?: UserType | null;
  notifications?: NotificationItem[];
  unreadCount?: number;
  onOpenSearch?: () => void;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onToggleMobileSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser: propUser,
  notifications = [],
  unreadCount: propUnreadCount,
  onOpenSearch,
  onMarkNotificationRead,
  onMarkAllRead,
  onToggleMobileSidebar,
}) => {
  const router = useRouter();
  const { currentUser: storeUser, logout } = useAuthStore();
  const currentUser = propUser || storeUser;
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const calculatedUnread = notifications.filter((n) => !n.isRead).length;
  const unreadCount = propUnreadCount !== undefined ? propUnreadCount : calculatedUnread;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        {/* Left: Brand & Mobile Menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 tracking-tight text-base">MedCore</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200">
                  Enterprise HMS
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-semibold block -mt-0.5">
                NABH & HL7 Compliant Operations Desk
              </span>
            </div>
          </div>
        </div>

        {/* Center: Search & Quick Actions */}
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-8">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-xl text-slate-500 text-xs font-semibold transition"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span>Search patients, doctors, lab orders, medicines...</span>
            <kbd className="ml-auto font-mono text-[10px] bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Notifications & User Profile */}
        <div className="flex items-center gap-3">
          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl relative transition"
              aria-label="View Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-teal-600" /> Clinical Notifications ({notifications.length})
                  </h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => {
                        if (onMarkAllRead) onMarkAllRead();
                      }}
                      className="text-[11px] text-teal-700 font-bold hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 font-medium">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (onMarkNotificationRead) onMarkNotificationRead(n.id);
                        }}
                        className={`p-3 text-xs cursor-pointer transition ${
                          !n.isRead ? 'bg-teal-50/60 font-semibold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-slate-900 font-bold mb-0.5">
                          <span>{n.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          {currentUser && (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 p-1.5 pl-2 hover:bg-slate-100 rounded-xl transition"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-900 font-bold text-xs flex items-center justify-center border border-teal-200">
                  {currentUser.firstName?.[0] || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <span className="block text-xs font-bold text-slate-900 leading-tight">
                    {currentUser.firstName} {currentUser.lastName}
                  </span>
                  <span className="block text-[10px] font-bold text-teal-700 uppercase tracking-wide">
                    {currentUser.role}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2 text-xs">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <span className="block font-bold text-slate-900">{currentUser.firstName} {currentUser.lastName}</span>
                    <span className="block text-[11px] text-slate-500 font-mono">{currentUser.email}</span>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-rose-600 font-bold hover:bg-rose-50 flex items-center gap-2 transition"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
