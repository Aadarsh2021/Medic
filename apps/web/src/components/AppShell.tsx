'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { useAuthStore } from '../store/useAuthStore';
import { NotificationItem } from '../types';
import { apiRequest, API_BASE } from '../services/api';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, accessToken } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!accessToken && pathname !== '/login') {
      router.push('/login');
    }
  }, [accessToken, pathname, router]);

  useEffect(() => {
    if (!accessToken || !currentUser) return;

    let socket: Socket | null = null;
    let isSubscribed = true;

    apiRequest('/notifications/me')
      .then((notifs) => {
        if (isSubscribed) setNotifications(notifs || []);
      })
      .catch(() => {});

    try {
      socket = io(API_BASE, {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
      });

      socket.on('notification:new', (newNotif: NotificationItem) => {
        if (isSubscribed) setNotifications((prev) => [newNotif, ...prev]);
      });
      socket.on('notification', (newNotif: NotificationItem) => {
        if (isSubscribed) setNotifications((prev) => [newNotif, ...prev]);
      });
    } catch (err) {
      // Non-blocking socket error catch
    }

    return () => {
      isSubscribed = false;
      if (socket) {
        socket.off('notification:new');
        socket.off('notification');
        if (socket.connected) {
          socket.disconnect();
        } else {
          socket.on('connect', () => {
            socket?.disconnect();
          });
        }
      }
    };
  }, [accessToken, currentUser]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      <Navbar
        notifications={notifications}
        onMarkAllRead={markAllRead}
        onOpenSearch={() => setIsSearchOpen(true)}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      <div className="flex flex-1 relative">
        <Sidebar
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <main className="flex-1 bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8 min-w-0">
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
