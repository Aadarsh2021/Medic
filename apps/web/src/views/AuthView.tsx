'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { Role } from '../types';
import { apiRequest } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid work email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.string(),
  hospitalId: z.string().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export const AuthView: React.FC = () => {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema as any),
    defaultValues: {
      email: 'superadmin@medcore.org',
      password: 'Password123!',
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema as any),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: 'Password123!',
      role: 'PATIENT',
      hospitalId: '',
    },
  });

  React.useEffect(() => {
    apiRequest('/hospitals')
      .then((data) => {
        setHospitals(data || []);
        if (data && data.length > 0) {
          registerForm.setValue('hospitalId', data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleLoginSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    setMessage(null);

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setLoading(false);
      setAuth(data.user, data.accessToken);
      router.push('/dashboard');
    } catch (err: any) {
      setLoading(false);
      setMessage({ type: 'error', text: err.message || 'Authentication failed. Please verify credentials.' });
    }
  };

  const handleRegisterSubmit = async (values: RegisterFormValues) => {
    setLoading(true);
    setMessage(null);

    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      setMessage({ type: 'success', text: 'Hospital user registered successfully! Authenticating session...' });

      const loginData = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: values.email, password: values.password }),
      });
      setLoading(false);
      setAuth(loginData.user, loginData.accessToken);
      router.push('/dashboard');
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

        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          <Home className="w-4 h-4" /> Hospital Home Page
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 mx-auto mb-3 shadow-2xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Clinical Staff Authentication</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Single Sign-On (SSO) Portal for Hospital System Access</p>

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
              <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-4">
                <div>
                  <Label className="block text-xs font-bold text-slate-700 mb-1">Hospital Staff Email / User ID</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 z-10" />
                    <Input
                      type="email"
                      className="pl-9"
                      placeholder="dr.sharma@medcore.org"
                      {...loginForm.register('email')}
                    />
                  </div>
                  {loginForm.formState.errors.email && (
                    <p className="text-[10px] text-rose-600 font-semibold mt-1">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <Label className="block text-xs font-bold text-slate-700 mb-1">Password</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 z-10" />
                    <Input
                      type="password"
                      className="pl-9"
                      placeholder="••••••••••••"
                      {...loginForm.register('password')}
                    />
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-[10px] text-rose-600 font-semibold mt-1">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 gap-2"
                >
                  {loading ? 'Authenticating...' : 'Sign In to Clinical Workspace'} <ArrowRight className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(handleRegisterSubmit)} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="block text-[11px] font-bold text-slate-700 mb-1">First Name *</Label>
                    <Input
                      placeholder="Rahul"
                      {...registerForm.register('firstName')}
                    />
                    {registerForm.formState.errors.firstName && (
                      <p className="text-[10px] text-rose-600 font-semibold mt-1">{registerForm.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="block text-[11px] font-bold text-slate-700 mb-1">Last Name *</Label>
                    <Input
                      placeholder="Verma"
                      {...registerForm.register('lastName')}
                    />
                    {registerForm.formState.errors.lastName && (
                      <p className="text-[10px] text-rose-600 font-semibold mt-1">{registerForm.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="block text-[11px] font-bold text-slate-700 mb-1">Work Email *</Label>
                  <Input
                    type="email"
                    placeholder="r.verma@medcore.org"
                    {...registerForm.register('email')}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-[10px] text-rose-600 font-semibold mt-1">{registerForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <Label className="block text-[11px] font-bold text-slate-700 mb-1">Assign System Role *</Label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                    {...registerForm.register('role')}
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
                    <Label className="block text-[11px] font-bold text-slate-700 mb-1">Assign Hospital Branch</Label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                      {...registerForm.register('hospitalId')}
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
                  <Label className="block text-[11px] font-bold text-slate-700 mb-1">Password *</Label>
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    {...registerForm.register('password')}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-[10px] text-rose-600 font-semibold mt-1">{registerForm.formState.errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10"
                >
                  {loading ? 'Creating User...' : 'Complete Registration'}
                </Button>
              </form>
            )}

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
                        loginForm.setValue('email', acc.email);
                        loginForm.setValue('password', 'Password123!');
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

      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500">
        MedCore HMS Enterprise Security Gateway • NABH & HL7 Compliant
      </footer>
    </div>
  );
};
