import React from 'react';
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
  FileText,
  Activity,
} from 'lucide-react';
import { Role } from '../types';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  userRole?: Role;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  userRole = 'SUPER_ADMIN',
  isOpenMobile,
  onCloseMobile,
}) => {
  // Role-Specific Navigation Menus
  const roleMenus: Record<Role, { id: string; label: string; icon: any }[]> = {
    SUPER_ADMIN: [
      { id: 'dashboard', label: 'Executive Operations', icon: LayoutDashboard },
      { id: 'appointments', label: 'Hospital Scheduling', icon: CalendarDays },
      { id: 'doctor-portal', label: 'Clinical Encounters', icon: Stethoscope },
      { id: 'lab', label: 'Laboratory Diagnostics', icon: FlaskConical },
      { id: 'pharmacy', label: 'Pharmacy Inventory', icon: Pill },
      { id: 'billing', label: 'Revenue & Billing', icon: Receipt },
      { id: 'audit-logs', label: 'Security Audit Logs', icon: ShieldCheck },
    ],
    HOSPITAL_ADMIN: [
      { id: 'dashboard', label: 'Executive Operations', icon: LayoutDashboard },
      { id: 'appointments', label: 'Hospital Scheduling', icon: CalendarDays },
      { id: 'doctor-portal', label: 'Doctor EMR Encounters', icon: Stethoscope },
      { id: 'lab', label: 'Laboratory Workflows', icon: FlaskConical },
      { id: 'pharmacy', label: 'Pharmacy Stock', icon: Pill },
      { id: 'billing', label: 'Billing Ledger', icon: Receipt },
      { id: 'audit-logs', label: 'Security Audit Logs', icon: ShieldCheck },
    ],
    DOCTOR: [
      { id: 'doctor-portal', label: 'Clinical EMR Encounters', icon: Stethoscope },
      { id: 'appointments', label: 'My Consultation Schedule', icon: CalendarDays },
      { id: 'lab', label: 'Patient Lab Orders', icon: FlaskConical },
      { id: 'pharmacy', label: 'Medicine Formulary', icon: Pill },
    ],
    PATIENT: [
      { id: 'patient-portal', label: 'My Health Timeline', icon: User },
      { id: 'appointments', label: 'Book Consultation', icon: CalendarDays },
      { id: 'patient-portal', label: 'My Prescriptions & Reports', icon: FileText },
      { id: 'patient-portal', label: 'My Invoices & Receipts', icon: Receipt },
    ],
    PHARMACIST: [
      { id: 'pharmacy', label: 'Pharmacy Formulary Stock', icon: Pill },
      { id: 'pharmacy', label: 'FIFO Batch Allocation', icon: Pill },
      { id: 'billing', label: 'Pharmacy Billing', icon: Receipt },
    ],
    LAB_TECHNICIAN: [
      { id: 'lab', label: 'Diagnostic Orders Queue', icon: FlaskConical },
      { id: 'lab', label: 'Result Entry & Verification', icon: FlaskConical },
      { id: 'lab', label: 'Approved Reports Archive', icon: FlaskConical },
    ],
    ACCOUNTANT: [
      { id: 'billing', label: 'Invoices & Payments Ledger', icon: Receipt },
      { id: 'dashboard', label: 'Revenue Telemetry', icon: LayoutDashboard },
    ],
    RECEPTIONIST: [
      { id: 'appointments', label: 'Front-Desk Booking Engine', icon: CalendarDays },
      { id: 'billing', label: 'Patient Invoicing', icon: Receipt },
    ],
    NURSE: [
      { id: 'doctor-portal', label: 'Ward Patient Queue', icon: Stethoscope },
      { id: 'appointments', label: 'Appointments Timeline', icon: CalendarDays },
    ],
  };

  const currentMenu = roleMenus[userRole] || roleMenus.SUPER_ADMIN;

  const sidebarContent = (
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
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={`${item.id}-${idx}`}
              onClick={() => {
                onSelectView(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? 'bg-teal-600 text-white font-bold shadow-md shadow-teal-900/40'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
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
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 border-r border-slate-800 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={onCloseMobile}></div>
          <div className="relative w-64 bg-[#0a101d] border-r border-slate-800 z-10 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
