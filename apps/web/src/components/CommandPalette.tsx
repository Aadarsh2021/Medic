'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, Stethoscope, Pill, X } from 'lucide-react';
import { apiRequest } from '../services/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ patients: any[]; doctors: any[]; medicines: any[] }>({
    patients: [],
    doctors: [],
    medicines: [],
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ patients: [], doctors: [], medicines: [] });
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const [patients, doctors, medicines] = await Promise.all([
          apiRequest(`/users/patients?search=${encodeURIComponent(query)}`).catch(() => []),
          apiRequest(`/users/doctors?specialisation=${encodeURIComponent(query)}`).catch(() => []),
          apiRequest(`/medicines?search=${encodeURIComponent(query)}`).catch(() => []),
        ]);
        setResults({ patients, doctors, medicines });
      } catch (err) {
        console.error(err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (route: string) => {
    router.push(route);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-start justify-center pt-20 p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center px-4 border-b border-slate-200 bg-slate-50">
          <Search className="w-5 h-5 text-teal-600 mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Global Search: Type patient name, doctor, specialisation, or medicine..."
            className="w-full bg-transparent py-4 text-slate-900 placeholder-slate-400 focus:outline-none text-sm font-medium"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {!query && (
            <div className="text-center py-8 text-slate-400 text-xs font-medium">
              Type to search across Patients, Doctors, Medicines & Clinical Records...
            </div>
          )}

          {results.patients.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-600" /> Patients
              </div>
              <div className="space-y-1">
                {results.patients.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelect('/doctor-portal')}
                    className="p-3 hover:bg-teal-50/60 rounded-xl cursor-pointer flex items-center justify-between text-xs transition border border-transparent hover:border-teal-100"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{p.user?.firstName} {p.user?.lastName}</div>
                      <div className="text-slate-500 text-[11px] font-medium">MRN: {p.mrn} • Blood Group: {p.bloodGroup || 'A+'}</div>
                    </div>
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded border border-teal-200">View Records</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.doctors.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-emerald-600" /> Doctors
              </div>
              <div className="space-y-1">
                {results.doctors.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => handleSelect('/appointments')}
                    className="p-3 hover:bg-emerald-50/60 rounded-xl cursor-pointer flex items-center justify-between text-xs transition border border-transparent hover:border-emerald-100"
                  >
                    <div>
                      <div className="font-bold text-slate-900">Dr. {d.user?.firstName} {d.user?.lastName}</div>
                      <div className="text-slate-500 text-[11px] font-medium">{d.specialisation} • Fee: ₹{d.consultationFee}</div>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">Book Slot</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.medicines.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-teal-600" /> Pharmacy Stock
              </div>
              <div className="space-y-1">
                {results.medicines.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleSelect('/pharmacy')}
                    className="p-3 hover:bg-teal-50/60 rounded-xl cursor-pointer flex items-center justify-between text-xs transition border border-transparent hover:border-teal-100"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{m.name}</div>
                      <div className="text-slate-500 text-[11px] font-medium">{m.category} • {m.form} • MRP: ₹{m.mrp}</div>
                    </div>
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded border border-teal-200">Dispense</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
