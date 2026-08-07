import React, { useState } from 'react';
import {
  Building2,
  Lock,
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Home,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  Stethoscope,
} from 'lucide-react';
import { Role } from '../types';
import { apiRequest } from '../services/api';

interface AuthViewProps {
  onAuthSuccess: (user: any, token: string) => void;
  onGoToHome?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess, onGoToHome }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('superadmin@medcore.org');
  const [loginPassword, setLoginPassword] = useState('Password123!');

  // Register form state
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('Password123!');
  const [regRole, setRegRole] = useState<Role>('PATIENT');
  const [regHospitalId, setRegHospitalId] = useState('');
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    apiRequest('/hospitals')
      .then((data) => {
        setHospitals(data || []);
        if (data && data.length > 0) setRegHospitalId(data[0].id);
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      setLoading(false);
      onAuthSuccess(data.user, data.accessToken);
    } catch (err: any) {
      setLoading(false);
      setMessage({ type: 'error', text: err.message || 'Authentication failed. Please verify credentials.' });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          firstName: regFirstName,
          lastName: regLastName,
          phone: regPhone,
          role: regRole,
          hospitalId: regHospitalId,
        }),
      });

      setMessage({ type: 'success', text: 'Hospital user registered successfully! Authenticating session...' });

      const loginData = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      });
      setLoading(false);
      onAuthSuccess(loginData.user, loginData.accessToken);
    } catch (err: any) {
      setLoading(false);
      setMessage({ type: 'error', text: err.message || 'Registration failed.' });
    }
  };

  const demoAccounts = [
    { label: 'Super Admin', email: 'superadmin@medcore.org', role: 'Global Executive' },
    { label: 'Hospital Admin', email: 'admin@medcore-city.org', role: 'Ops & Analytics' },
    { label: 'Doctor', email: 'dr.sharma@medcore.org', role: 'EMR & Prescriptions' },
    { label: 'Nurse', email: 'nurse@medcore-city.org', role: 'Vitals & Ward Notes' },
    { label: 'Receptionist', email: 'reception@medcore-city.org', role: 'Patient Scheduling' },
    { label: 'Lab Tech', email: 'labtech@medcore-city.org', role: 'Diagnostic Orders' },
    { label: 'Pharmacist', email: 'pharmacist@medcore-city.org', role: 'FIFO Stock Dispensing' },
    { label: 'Accountant', email: 'accountant@medcore-city.org', role: 'Billing & Payments' },
    { label: 'Patient', email: 'patient1@example.com', role: 'Patient Health Portal' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-base text-slate-900">MedCore <span className="text-teal-600">HMS</span></span>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Enterprise Staff Portal</span>
          </div>
        </div>

        {onGoToHome && (
          <button
            onClick={onGoToHome}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <Home className="w-4 h-4" /> Hospital Home Page
          </button>
        )}
      </header>

      {/* Main Login Panel */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Card Header */}
          <div className="p-6 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 mx-auto mb-3 shadow-2xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Clinical Staff Authentication</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Single Sign-On (SSO) Portal for Hospital System Access</p>

            {/* Tab Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mt-4 border border-slate-200">
              <button
                onClick={() => { setTab('login'); setMessage(null); }}
                className={`py-1.5 text-xs font-bold rounded-lg transition ${tab === 'login' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setTab('register'); setMessage(null); }}
                className={`py-1.5 text-xs font-bold rounded-lg transition ${tab === 'register' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Register Staff User
              </button>
            </div>
          </div>

          <div className="p-6">
            {message && (
              <div
                className={`p-3 rounded-xl text-xs font-medium mb-4 flex items-center gap-2 border ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hospital Staff Email / User ID</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white transition"
                      placeholder="dr.sharma@medcore.org"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white transition"
                      placeholder="••••••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-teal-600/20 flex items-center justify-center gap-2"
                >
                  {loading ? 'Authenticating...' : 'Sign In to Clinical Workspace'} <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      placeholder="Rahul"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      placeholder="Verma"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Work Email *</label>
                  <input
                    type="email"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    placeholder="r.verma@medcore.org"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Assign System Role *</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as Role)}
                  >
                    <option value="PATIENT">Patient Portal User</option>
                    <option value="DOCTOR">Doctor / Clinical Specialist</option>
                    <option value="NURSE">Nurse / Ward Staff</option>
                    <option value="RECEPTIONIST">Front Desk / Receptionist</option>
                    <option value="LAB_TECHNICIAN">Lab Diagnostic Technician</option>
                    <option value="PHARMACIST">Pharmacist / Inventory Manager</option>
                    <option value="ACCOUNTANT">Accountant / Billing Admin</option>
                    <option value="HOSPITAL_ADMIN">Hospital Administrator</option>
                  </select>
                </div>

                {hospitals.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Assign Hospital Branch</label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                      value={regHospitalId}
                      onChange={(e) => setRegHospitalId(e.target.value)}
                    >
                      {hospitals.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    placeholder="••••••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-teal-600/20"
                >
                  {loading ? 'Creating User...' : 'Complete Registration'}
                </button>
              </form>
            )}

            {/* Authorized Demo Credentials Collapsible Drawer */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-600 hover:text-teal-700 py-1"
              >
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-teal-600" /> Authorized Staff Quick Logins ({demoAccounts.length} Roles)
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDemoAccounts ? 'rotate-180' : ''}`} />
              </button>

              {showDemoAccounts && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left animate-fade-in">
                  {demoAccounts.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => {
                        setLoginEmail(acc.email);
                        setLoginPassword('Password123!');
                        setTab('login');
                      }}
                      className="p-2 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded-lg text-left transition"
                    >
                      <div className="font-bold text-[11px] text-slate-900">{acc.label}</div>
                      <div className="text-[10px] text-slate-500 truncate">{acc.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500">
        MedCore HMS Enterprise Security Gateway • NABH & HL7 Compliant
      </footer>
    </div>
  );
};
