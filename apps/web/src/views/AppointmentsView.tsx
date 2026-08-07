'use client';

import React, { useState, useEffect } from 'react';
import { CalendarDays, Clock, ShieldAlert, CheckCircle, AlertCircle, User, Calendar, Plus, Stethoscope } from 'lucide-react';
import { apiRequest } from '../services/api';

export const AppointmentsView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest('/auth/me').catch(() => null),
      apiRequest('/users/doctors').catch(() => []),
      apiRequest('/users/patients').catch(() => []),
    ])
      .then(([me, docs, pts]) => {
        setCurrentUser(me);
        let availableDocs = docs || [];

        if (me && me.role === 'DOCTOR' && me.doctorProfile) {
          const myDocId = me.doctorProfile.id;
          const myDoc = availableDocs.find((d: any) => d.id === myDocId);
          if (myDoc) {
            availableDocs = [myDoc];
            setSelectedDoctor(myDocId);
          } else if (availableDocs.length > 0) {
            setSelectedDoctor(availableDocs[0].id);
          }
        } else if (availableDocs.length > 0) {
          setSelectedDoctor(availableDocs[0].id);
        }

        setDoctors(availableDocs);
        setPatients(pts || []);
        if (pts && pts.length > 0) setSelectedPatient(pts[0].id);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDoctor || !date) return;
    apiRequest(`/appointments/slots?doctorId=${selectedDoctor}&date=${date}`)
      .then((res) => {
        setSlots(res.slots || []);
      })
      .catch(console.error);
  }, [selectedDoctor, date]);

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot && !isEmergency) {
      setMessage({ type: 'error', text: 'Please select an available time slot.' });
      return;
    }

    try {
      await apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDoctor,
          patientId: selectedPatient || undefined,
          appointmentDate: date,
          slotTime: selectedSlot || '10:00',
          type: isEmergency ? 'EMERGENCY' : 'REGULAR',
          reason: reason || 'Routine Checkup',
        }),
      });

      setMessage({ type: 'success', text: isEmergency ? '🚨 Emergency triage slot booked & physician alerted!' : 'Appointment confirmed with concurrency lock!' });
      const res = await apiRequest(`/appointments/slots?doctorId=${selectedDoctor}&date=${date}`);
      setSlots(res.slots || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const isDoctorRole = currentUser?.role === 'DOCTOR';

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-teal-600" />
            {isDoctorRole ? 'Doctor Schedule & Availability Allocation' : 'Hospital OPD Appointment Engine'}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {isDoctorRole
              ? 'Manage 30-minute consultation slots and review patient bookings'
              : 'Optimistic slot lock engine preventing double booking and emergency triage override'}
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Booking Controls Form */}
        <form onSubmit={handleBookAppointment} className="glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
            {isEmergency ? '🚨 Emergency Triage Booking' : 'Schedule Outpatient Consultation'}
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Specialist Physician *</label>
            <select
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              disabled={isDoctorRole}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.user?.firstName} {d.user?.lastName} ({d.specialisation}) — ${d.consultationFee} Fee
                </option>
              ))}
            </select>
          </div>

          {!isDoctorRole && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Patient Record *</label>
              <select
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.user?.firstName} {p.user?.lastName} ({p.mrn})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Consultation Date *</label>
            <input
              type="date"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Visit</label>
            <input
              type="text"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              placeholder="e.g. Chest pain, Routine Health Checkup"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <input
              type="checkbox"
              id="emergencyCheck"
              className="w-4 h-4 text-rose-600 rounded"
              checked={isEmergency}
              onChange={(e) => setIsEmergency(e.target.checked)}
            />
            <label htmlFor="emergencyCheck" className="text-xs font-bold text-amber-900 cursor-pointer">
              Emergency Code Red Triage (Bypass Slot Capacity)
            </label>
          </div>

          <button
            type="submit"
            className={`w-full font-bold py-3 rounded-xl text-xs transition shadow-md ${
              isEmergency ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20' : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20'
            }`}
          >
            {isEmergency ? 'Confirm Emergency Triage Booking' : 'Lock 30-Min Consultation Slot'}
          </button>
        </form>

        {/* Available 30-Min Time Slots Allocation Matrix */}
        <div className="lg:col-span-2 glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">30-Minute OPD Slot Allocation</h3>
              <p className="text-[11px] text-slate-500 font-medium">Available consultation windows for {date}</p>
            </div>
            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
              Concurrency Safe
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {slots.map((slot) => {
              const isSelected = selectedSlot === slot.time;
              const isAvailable = slot.isAvailable;

              return (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => setSelectedSlot(slot.time)}
                  className={`p-3 rounded-xl border text-center text-xs font-bold transition flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20'
                      : isAvailable
                      ? 'bg-white border-slate-300 text-slate-900 hover:border-teal-500 hover:bg-teal-50/50'
                      : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{slot.time}</span>
                  <span className="text-[9px] font-semibold uppercase">
                    {isAvailable ? 'Available' : 'Booked'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
