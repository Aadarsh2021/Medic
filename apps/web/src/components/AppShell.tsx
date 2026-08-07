'use client';

import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { useAuthStore } from '../store/useAuthStore';
import { NotificationItem } from '../types';
import { apiRequest, API_BASE } from '../services/api';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, accessToken } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (accessToken && currentUser) {
      apiRequest('/notifications/me')
        .then((notifs) => setNotifications(notifs || []))
        .catch(() => {});

      let socket: Socket | null = null;
      try {
        socket = io(API_BASE, {
          auth: { token: accessToken },
          transports: ['websocket'],
        });

        socket.on('notification', (newNotif: NotificationItem) => {
          setNotifications((prev) => [newNotif, ...prev]);
        });
      } catch (err) {
        console.error('Socket connection error:', err);
      }

      return () => {
        if (socket) socket.disconnect();
      };
    }
  }, [accessToken, currentUser]);

  const handleMarkRead = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      <Navbar
        currentUser={currentUser}
        notifications={notifications}
        unreadCount={unreadCount}
        onOpenSearch={() => setIsSearchOpen(true)}
        onMarkNotificationRead={handleMarkRead}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          userRole={currentUser?.role || 'SUPER_ADMIN'}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}
