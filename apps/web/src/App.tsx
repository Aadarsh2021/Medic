import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { User, NotificationItem } from './types';
import { apiRequest } from './services/api';

import { LandingView } from './views/LandingView';
import { AuthView } from './views/AuthView';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { CommandPalette } from './components/CommandPalette';

import { DashboardView } from './views/DashboardView';
import { DoctorPortalView } from './views/DoctorPortalView';
import { AppointmentsView } from './views/AppointmentsView';
import { LaboratoryView } from './views/LaboratoryView';
import { PharmacyView } from './views/PharmacyView';
import { BillingView } from './views/BillingView';
import { PatientPortalView } from './views/PatientPortalView';
import { AuditLogsView } from './views/AuditLogsView';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [unauthScreen, setUnauthScreen] = useState<'landing' | 'auth'>('auth');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Check existing session token on load
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      apiRequest('/auth/me')
        .then((user) => {
          handleAuthSuccess(user, token);
        })
        .catch(() => {
          localStorage.removeItem('accessToken');
          setCheckingAuth(false);
        });
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const handleAuthSuccess = (user: User, token: string) => {
    localStorage.setItem('accessToken', token);
    setCurrentUser(user);
    setCheckingAuth(false);

    // Set default view tailored to logged-in user's role
    const role = user.role;
    if (role === 'DOCTOR') setActiveView('doctor-portal');
    else if (role === 'LAB_TECHNICIAN') setActiveView('lab');
    else if (role === 'PHARMACIST') setActiveView('pharmacy');
    else if (role === 'ACCOUNTANT') setActiveView('billing');
    else if (role === 'PATIENT') setActiveView('patient-portal');
    else setActiveView('dashboard');

    // Load Notifications
    loadNotifications();

    // Connect Socket.IO
    if (user.id) {
      const s = io('http://localhost:3001', {
        query: { userId: user.id, hospitalId: user.hospitalId || '' },
      });

      s.on('notification', (newNotif: any) => {
        setNotifications((prev) => [
          {
            id: Date.now().toString(),
            title: newNotif.title,
            message: newNotif.message,
            channel: 'IN_APP',
            isRead: false,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      });

      setSocket(s);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await apiRequest('/notifications/me');
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    setCurrentUser(null);
    setUnauthScreen('auth');
    if (socket) socket.disconnect();
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (err) {
      console.error(err);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-600 flex items-center justify-center text-xs font-semibold">
        Verifying MedCore HMS session security...
      </div>
    );
  }

  // Render Public Home Landing Page or Dedicated Auth Screen if not logged in
  if (!currentUser) {
    if (unauthScreen === 'landing') {
      return <LandingView onGoToAuth={() => setUnauthScreen('auth')} />;
    }
    return <AuthView onAuthSuccess={handleAuthSuccess} onGoToHome={() => setUnauthScreen('landing')} />;
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Navigation Header */}
      <Navbar
        currentUser={currentUser}
        notifications={notifications}
        unreadCount={unreadCount}
        onOpenSearch={() => setIsSearchOpen(true)}
        onLogout={handleLogout}
        onMarkNotificationRead={handleMarkNotificationRead}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Role-Aware Navigation Sidebar */}
        <Sidebar
          activeView={activeView}
          onSelectView={setActiveView}
          userRole={currentUser.role}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Dynamic View Panel */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'doctor-portal' && <DoctorPortalView />}
          {activeView === 'appointments' && <AppointmentsView />}
          {activeView === 'lab' && <LaboratoryView />}
          {activeView === 'pharmacy' && <PharmacyView />}
          {activeView === 'billing' && <BillingView />}
          {activeView === 'patient-portal' && <PatientPortalView />}
          {activeView === 'audit-logs' && <AuditLogsView />}
        </main>
      </div>

      {/* Global Cmd+K Search Modal */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectResult={(view) => setActiveView(view)}
      />
    </div>
  );
};
