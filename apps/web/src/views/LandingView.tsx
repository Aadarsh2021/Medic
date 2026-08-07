'use client';

import React from 'react';
import {
  Building2,
  ShieldCheck,
  Activity,
  Users,
  Stethoscope,
  ArrowRight,
  CheckCircle2,
  FileText,
  HeartPulse,
  Microscope,
  Pill,
  Lock,
  PhoneCall,
  Clock,
  Sparkles,
} from 'lucide-react';

interface LandingViewProps {
  onGoToAuth: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onGoToAuth }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-teal-600 selection:text-white">
      {/* Top Clinical Emergency Alert Bar */}
      <div className="bg-slate-900 text-white text-[11px] font-medium py-1.5 px-4 sm:px-6 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            MedCore Clinical Network Active
          </span>
          <span className="hidden md:inline text-slate-400">|</span>
          <span className="hidden md:inline text-slate-300">
            Emergency OPD Hotline: <strong className="text-white">+1 (800) 555-MED1</strong>
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-300">
          <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-teal-400" /> HL7 FHIR v4 & HIPAA Compliant</span>
          <span className="hidden sm:inline-block text-slate-400">|</span>
          <span className="hidden sm:inline-block text-slate-300">NABH Accredited System</span>
        </div>
      </div>

      {/* Header Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">MedCore <span className="text-teal-600">HMS</span></span>
              <span className="block text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Enterprise Healthcare Operations</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onGoToAuth}
              className="text-xs font-bold text-slate-700 hover:text-teal-600 px-4 py-2 rounded-lg hover:bg-slate-100 transition"
            >
              Staff Sign In
            </button>
            <button
              onClick={onGoToAuth}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition shadow-md shadow-teal-600/20 flex items-center gap-1.5"
            >
              Launch Clinical Portal <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-16 lg:pb-24 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold shadow-2xs">
            <HeartPulse className="w-4 h-4 text-teal-600" />
            <span>Integrated Outpatient, Inpatient & Diagnostic Health SaaS</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
            Unified Clinical Workflows & <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">Hospital Multi-Tenancy</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
            MedCore HMS connects emergency triage, electronic medical records (EMR), ICD-10 diagnostic coding, digital prescriptions, laboratory result verification, and pharmacy FIFO stock fulfillment into a single enterprise system.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={onGoToAuth}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition shadow-lg shadow-teal-600/25 flex items-center gap-2"
            >
              Enter Hospital System Portal <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="http://localhost:3001/api/docs"
              target="_blank"
              rel="noreferrer"
              className="bg-white hover:bg-slate-100 text-slate-800 font-bold px-6 py-3.5 rounded-xl text-sm border border-slate-300 shadow-2xs transition flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-teal-600" /> OpenAPI Swagger Documentation
            </a>
          </div>

          {/* Hospital Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto pt-10 text-left">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Multi-Tenant Isolation</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">Row-Level DB Security</div>
              <div className="text-xs text-teal-600 font-semibold mt-0.5">Isolated Hospital Tenants</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role Access Control</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">9 Granular Roles</div>
              <div className="text-xs text-teal-600 font-semibold mt-0.5">Doctor, Nurse, Patient, Admin</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Appointment Engine</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">30-Min Slot Lock</div>
              <div className="text-xs text-teal-600 font-semibold mt-0.5">Concurrency Safeguards</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pharmacy Inventory</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">FIFO Allocation</div>
              <div className="text-xs text-teal-600 font-semibold mt-0.5">Automated Expiry Control</div>
            </div>
          </div>
        </div>
      </section>

      {/* Clinical Feature Modules */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Enterprise Hospital Operations Suite</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Designed for clinical compliance, operational telemetry, and patient safety</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 hover:border-teal-300 transition">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                <Stethoscope className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">EMR & Clinical Encounters</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Vitals recording with BMI computation, ICD-10 medical coding, digital doctor signature stamp, and printable digital prescriptions.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 hover:border-teal-300 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Microscope className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">Diagnostic Laboratory</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Quantitative specimen analysis, automatic min/max reference range outlier flagging, and lab technician approval workflows.
              </p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 hover:border-teal-300 transition">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Pill className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">Pharmacy & Stock Dispensing</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                First-In First-Out (FIFO) batch allocation, batch expiration tracking, and stock quarantine safeguards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-400" />
            <span className="font-bold text-white">MedCore HMS Enterprise</span>
            <span>— Clinical Information & Hospital Operations System</span>
          </div>
          <div>© 2026 MedCore Health Network. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};
