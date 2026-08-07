// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { Users, Stethoscope, DollarSign, Bed, AlertTriangle, TrendingUp, Activity, ShieldCheck, HeartPulse, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { apiRequest } from '../services/api';

export const DashboardView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/analytics/dashboard')
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-500 text-xs font-medium">Loading Executive Clinical Dashboard Telemetry...</div>;
  }

  const kpis = data?.kpis || {
    totalPatients: 42,
    totalDoctors: 12,
    totalAppointments: 28,
    totalRevenue: 8450,
    occupiedBeds: 34,
    totalBeds: 60,
  };

  const chartData = data?.appointmentChartData || [
    { day: 'Mon', appointments: 24, revenue: 1450 },
    { day: 'Tue', appointments: 32, revenue: 2100 },
    { day: 'Wed', appointments: 28, revenue: 1850 },
    { day: 'Thu', appointments: 40, revenue: 2900 },
    { day: 'Fri', appointments: 38, revenue: 2750 },
    { day: 'Sat', appointments: 20, revenue: 1200 },
    { day: 'Sun', appointments: 15, revenue: 950 },
  ];

  const depts = data?.departmentOccupancy || [
    { name: 'Cardiology & Vascular', activeDoctors: 4, occupancyRate: 85 },
    { name: 'Neurology & Neurosurgery', activeDoctors: 3, occupancyRate: 70 },
    { name: 'Orthopedics & Joint Care', activeDoctors: 5, occupancyRate: 92 },
    { name: 'Pediatrics & Neonatal', activeDoctors: 4, occupancyRate: 60 },
    { name: 'General Surgery & Trauma', activeDoctors: 6, occupancyRate: 88 },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-600" /> Executive Clinical & Operations Telemetry
          </h2>
          <p className="text-xs text-slate-500 font-medium">Real-time OPD encounters, bed occupancy telemetry, and hospital revenue metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200 font-bold flex items-center gap-1.5 shadow-2xs">
            <Activity className="w-3.5 h-3.5 text-emerald-600" /> Clinical Network Live
          </span>
          <span className="text-xs bg-teal-50 text-teal-800 px-3 py-1 rounded-full border border-teal-200 font-bold flex items-center gap-1.5 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> NABH Compliant
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card-light p-5 rounded-2xl border border-slate-300 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs font-bold text-slate-700">Registered Active Patients</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{kpis.totalPatients}</div>
            <div className="text-[11px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> +14% active encounters
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-2xs">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card-light p-5 rounded-2xl border border-slate-300 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs font-bold text-slate-700">Clinical Medical Specialists</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{kpis.totalDoctors}</div>
            <div className="text-[11px] font-semibold text-slate-600 mt-1">Across 5 Departments</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs">
            <Stethoscope className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card-light p-5 rounded-2xl border border-slate-300 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs font-bold text-slate-700">Hospital Revenue Collected</div>
            <div className="text-2xl font-black text-slate-900 mt-1">${kpis.totalRevenue.toLocaleString()}</div>
            <div className="text-[11px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Stripe & Cash Ledger
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-2xs">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card-light p-5 rounded-2xl border border-slate-300 flex items-center justify-between shadow-2xs">
          <div>
            <div className="text-xs font-bold text-slate-700">Ward & ICU Bed Occupancy</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{kpis.occupiedBeds} / {kpis.totalBeds}</div>
            <div className="text-[11px] font-bold text-amber-700 mt-1 flex items-center gap-1">
              <Bed className="w-3.5 h-3.5" /> {Math.round((kpis.occupiedBeds / kpis.totalBeds) * 100)}% Bed Capacity
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shadow-2xs">
            <Bed className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Appointments & Revenue Chart */}
        <div className="lg:col-span-2 glass-card-light p-5 rounded-2xl border border-slate-300 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Weekly Patient Encounters Velocity</h3>
              <p className="text-xs font-medium text-slate-600">Outpatient consultations and OPD volume telemetry</p>
            </div>
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
              Weekly Trends
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#ffffff', fontSize: '11px' }}
                />
                <Bar dataKey="appointments" fill="#0d9488" radius={[6, 6, 0, 0]} name="Encounters" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Occupancy Breakdown */}
        <div className="glass-card-light p-5 rounded-2xl border border-slate-300 space-y-4 shadow-2xs">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="font-extrabold text-sm text-slate-900">Department Occupancy Rates</h3>
            <p className="text-xs font-medium text-slate-600">Clinical ward & specialty bed allocation</p>
          </div>

          <div className="space-y-4">
            {depts.map((d: any) => (
              <div key={d.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-900">{d.name}</span>
                  <span className="font-bold text-slate-800">{d.occupancyRate}% Beds</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      d.occupancyRate > 85 ? 'bg-rose-500' : d.occupancyRate > 70 ? 'bg-amber-500' : 'bg-teal-600'
                    }`}
                    style={{ width: `${d.occupancyRate}%` }}
                  ></div>
                </div>
                <div className="text-xs font-semibold text-slate-600">{d.activeDoctors} On-Duty Specialists</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
