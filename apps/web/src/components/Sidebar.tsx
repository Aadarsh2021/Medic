'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Stethoscope,
  CalendarDays,
  FlaskConical,
  Pill,
  Receipt,
  User,
  ShieldCheck,
  X,
  Activity,
} from 'lucide-react';
import { Role } from '../types';

interface SidebarProps {
  userRole?: Role;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  userRole = 'SUPER_ADMIN',
  isOpenMobile,
  onCloseMobile,
}) => {
  const pathname = usePathname();
  const router = useRouter();

  const roleMenus: Record<Role, { id: string; route: string; label: string; iconId: string }[]> = {
    SUPER_ADMIN: [
      { id: 'dashboard', route: '/dashboard', label: 'Executive Operations', iconId: 'dashboard' },
      { id: 'appointments', route: '/appointments', label: 'Hospital Scheduling', iconId: 'appointments' },
      { id: 'doctor-portal', route: '/doctor-portal', label: 'Clinical Encounters', iconId: 'doctor-portal' },
      { id: 'lab', route: '/laboratory', label: 'Laboratory Diagnostics', iconId: 'lab' },
      { id: 'pharmacy', route: '/pharmacy', label: 'Pharmacy Inventory', iconId: 'pharmacy' },
      { id: 'billing', route: '/billing', label: 'Revenue & Billing', iconId: 'billing' },
      { id: 'audit-logs', route: '/audit-logs', label: 'Security Audit Logs', iconId: 'audit-logs' },
    ],
    HOSPITAL_ADMIN: [
      { id: 'dashboard', route: '/dashboard', label: 'Executive Operations', iconId: 'dashboard' },
      { id: 'appointments', route: '/appointments', label: 'Hospital Scheduling', iconId: 'appointments' },
      { id: 'doctor-portal', route: '/doctor-portal', label: 'Doctor EMR Encounters', iconId: 'doctor-portal' },
      { id: 'lab', route: '/laboratory', label: 'Laboratory Workflows', iconId: 'lab' },
      { id: 'pharmacy', route: '/pharmacy', label: 'Pharmacy Stock', iconId: 'pharmacy' },
      { id: 'billing', route: '/billing', label: 'Billing Ledger', iconId: 'billing' },
      { id: 'audit-logs', route: '/audit-logs', label: 'Security Audit Logs', iconId: 'audit-logs' },
    ],
    DOCTOR: [
      { id: 'doctor-portal', route: '/doctor-portal', label: 'Clinical EMR Encounters', iconId: 'doctor-portal' },
      { id: 'appointments', route: '/appointments', label: 'My Consultation Schedule', iconId: 'appointments' },
      { id: 'lab', route: '/laboratory', label: 'Patient Lab Orders', iconId: 'lab' },
      { id: 'pharmacy', route: '/pharmacy', label: 'Medicine Formulary', iconId: 'pharmacy' },
    ],
    PATIENT: [
      { id: 'patient-portal', route: '/patient-portal', label: 'My Health Timeline', iconId: 'patient-portal' },
      { id: 'appointments', route: '/appointments', label: 'Book Consultation', iconId: 'appointments' },
    ],
    PHARMACIST: [
      { id: 'pharmacy', route: '/pharmacy', label: 'Pharmacy Formulary Stock', iconId: 'pharmacy' },
      { id: 'billing', route: '/billing', label: 'Pharmacy Billing', iconId: 'billing' },
    ],
    LAB_TECHNICIAN: [
      { id: 'lab', route: '/laboratory', label: 'Diagnostic Orders Queue', iconId: 'lab' },
    ],
    ACCOUNTANT: [
      { id: 'billing', route: '/billing', label: 'Invoices & Payments Ledger', iconId: 'billing' },
      { id: 'dashboard', route: '/dashboard', label: 'Revenue Telemetry', iconId: 'dashboard' },
    ],
    RECEPTIONIST: [
      { id: 'appointments', route: '/appointments', label: 'Front-Desk Booking Engine', iconId: 'appointments' },
      { id: 'billing', route: '/billing', label: 'Patient Invoicing', iconId: 'billing' },
    ],
    NURSE: [
      { id: 'doctor-portal', route: '/doctor-portal', label: 'Ward Patient Queue', iconId: 'doctor-portal' },
      { id: 'appointments', route: '/appointments', label: 'Appointments Timeline', iconId: 'appointments' },
    ],
  };

  const currentMenu = roleMenus[userRole] || roleMenus.SUPER_ADMIN;

  const handleNavigate = (route: string) => {
    router.push(route);
    if (onCloseMobile) onCloseMobile();
  };

  const renderMenuIcon = (iconId: string, className: string) => {
    switch (iconId) {
      case 'dashboard':
        return <LayoutDashboard className={className} />;
      case 'appointments':
        return <CalendarDays className={className} />;
      case 'doctor-portal':
        return <Stethoscope className={className} />;
      case 'lab':
        return <FlaskConical className={className} />;
      case 'pharmacy':
        return <Pill className={className} />;
      case 'billing':
        return <Receipt className={className} />;
      case 'audit-logs':
        return <ShieldCheck className={className} />;
      case 'patient-portal':
        return <User className={className} />;
      default:
        return <LayoutDashboard className={className} />;
    }
  };

  const renderContent = () => (
    <div className="h-full flex flex-col justify-between p-4 bg-[#0a101d] text-slate-300">
      <div className="space-y-1">
        <div className="flex items-center justify-between px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
          <span>{userRole.replace('_', ' ')} WORKSPACE</span>
          {onCloseMobile && (
            <button onClick={onCloseMobile} className="lg:hidden p-1 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {currentMenu.map((item, idx) => {
          const isActive = pathname === item.route;

          return (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => handleNavigate(item.route)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? 'bg-teal-600 text-white font-bold shadow-md shadow-teal-900/40'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                {renderMenuIcon(item.iconId, `w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`)}
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-800 text-xs">
        <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">ACTIVE SYSTEM SCOPE</div>
            <div className="text-xs font-extrabold text-teal-400">{userRole.replace('_', ' ')}</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 border-r border-slate-800 shrink-0">
        {renderContent()}
      </aside>

      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={onCloseMobile}></div>
          <div className="relative w-64 bg-[#0a101d] border-r border-slate-800 z-10 shadow-2xl">
            {renderContent()}
          </div>
        </div>
      )}
    </>
  );
};
