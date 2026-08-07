'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { apiRequest } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const appointmentSchema = z.object({
  doctorId: z.string().min(1, 'Please select a specialist physician'),
  patientId: z.string().optional(),
  appointmentDate: z.string().min(1, 'Please select a valid consultation date'),
  slotTime: z.string().optional(),
  type: z.enum(['REGULAR', 'EMERGENCY']),
  reason: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

export const AppointmentsView: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiRequest('/auth/me').catch(() => null),
  });

  const {
    data: doctors = [],
    isLoading: isDoctorsLoading,
    isError: isDoctorsError,
  } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => apiRequest('/users/doctors').catch(() => []),
  });

  const {
    data: patients = [],
    isLoading: isPatientsLoading,
    isError: isPatientsError,
  } = useQuery({
    queryKey: ['patients'],
    queryFn: () => apiRequest('/users/patients').catch(() => []),
  });

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema as any),
    defaultValues: {
      doctorId: '',
      patientId: '',
      appointmentDate: new Date().toISOString().split('T')[0],
      slotTime: '',
      type: 'REGULAR',
      reason: '',
    },
  });

  useEffect(() => {
    if (doctors.length > 0 && !form.getValues('doctorId')) {
      form.setValue('doctorId', doctors[0].id);
    }
  }, [doctors, form]);

  useEffect(() => {
    if (patients.length > 0 && !form.getValues('patientId')) {
      form.setValue('patientId', patients[0].id);
    }
  }, [patients, form]);

  const selectedDoctor = form.watch('doctorId') || (doctors.length > 0 ? doctors[0].id : '');
  const date = form.watch('appointmentDate');
  const isEmergency = form.watch('type') === 'EMERGENCY';

  const {
    data: slotsData,
    isLoading: isSlotsLoading,
    isError: isSlotsError,
  } = useQuery({
    queryKey: ['slots', selectedDoctor, date],
    queryFn: () => apiRequest(`/appointments/slots?doctorId=${selectedDoctor}&date=${date}`).catch(() => ({ slots: [] })),
    enabled: Boolean(selectedDoctor && date),
  });

  const slots = slotsData?.slots || [];

  const bookMutation = useMutation({
    mutationFn: (values: AppointmentFormValues) =>
      apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: values.doctorId || selectedDoctor,
          patientId: values.patientId || (patients.length > 0 ? patients[0].id : undefined),
          appointmentDate: values.appointmentDate,
          slotTime: selectedSlot || values.slotTime || '10:00',
          type: values.type,
          reason: values.reason || 'Routine Checkup',
        }),
      }),
    onSuccess: () => {
      setMessage({
        type: 'success',
        text: isEmergency
          ? '🚨 Emergency triage slot booked & physician alerted!'
          : 'Appointment confirmed with concurrency lock!',
      });
      queryClient.invalidateQueries({ queryKey: ['slots', selectedDoctor, date] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.message || 'Appointment booking failed.' });
    },
  });

  const isDoctorRole = currentUser?.role === 'DOCTOR';

  const onSubmit = (values: AppointmentFormValues) => {
    if (!selectedSlot && !isEmergency) {
      setMessage({ type: 'error', text: 'Please select an available 30-minute time slot.' });
      return;
    }
    setMessage(null);
    bookMutation.mutate(values);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-teal-600" />
            {isDoctorRole ? 'Doctor Schedule & Availability Allocation' : 'Hospital OPD Appointment Engine'}
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-1">
            {isDoctorRole
              ? 'Manage 30-minute consultation slots and review patient bookings'
              : 'Optimistic slot lock engine preventing double booking and emergency triage override'}
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
          <h3 className="font-extrabold text-sm text-slate-900 border-b border-slate-200 pb-2">
            {isEmergency ? '🚨 Emergency Triage Booking' : 'Schedule Outpatient Consultation'}
          </h3>

          <div>
            <Label className="block text-xs font-bold text-slate-700 mb-1">Select Specialist Physician *</Label>
            <select
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:text-slate-500"
              disabled={isDoctorRole || isDoctorsLoading}
              {...form.register('doctorId')}
            >
              {isDoctorsLoading ? (
                <option value="" disabled>Loading specialist physicians...</option>
              ) : isDoctorsError ? (
                <option value="" disabled>Unable to load doctors</option>
              ) : doctors.length === 0 ? (
                <option value="" disabled>No doctors available</option>
              ) : (
                doctors.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.user?.firstName} {d.user?.lastName} ({d.specialisation}) — ₹{d.consultationFee} Fee
                  </option>
                ))
              )}
            </select>
            {form.formState.errors.doctorId && (
              <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.doctorId.message}</p>
            )}
          </div>

          {!isDoctorRole && (
            <div>
              <Label className="block text-xs font-bold text-slate-700 mb-1">Select Patient Record *</Label>
              <select
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:text-slate-500"
                disabled={isPatientsLoading}
                {...form.register('patientId')}
              >
                {isPatientsLoading ? (
                  <option value="" disabled>Loading patient records...</option>
                ) : isPatientsError ? (
                  <option value="" disabled>Unable to load patients</option>
                ) : patients.length === 0 ? (
                  <option value="" disabled>No patients found</option>
                ) : (
                  patients.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.user?.firstName} {p.user?.lastName} ({p.mrn})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div>
            <Label className="block text-xs font-bold text-slate-700 mb-1">Consultation Date *</Label>
            <Input
              type="date"
              className="font-bold text-slate-900"
              {...form.register('appointmentDate')}
            />
            {form.formState.errors.appointmentDate && (
              <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.appointmentDate.message}</p>
            )}
          </div>

          <div>
            <Label className="block text-xs font-bold text-slate-700 mb-1">Reason for Visit</Label>
            <Input
              placeholder="e.g. Chest pain, Routine Health Checkup"
              className="text-slate-900 placeholder:text-slate-400"
              {...form.register('reason')}
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
            <input
              type="checkbox"
              id="emergencyCheck"
              className="w-4 h-4 text-rose-600 rounded"
              checked={isEmergency}
              onChange={(e) => form.setValue('type', e.target.checked ? 'EMERGENCY' : 'REGULAR')}
            />
            <label htmlFor="emergencyCheck" className="text-xs font-bold text-amber-900 cursor-pointer">
              Emergency Code Red Triage (Bypass Slot Capacity)
            </label>
          </div>

          <Button
            type="submit"
            disabled={bookMutation.isPending}
            variant={isEmergency ? 'destructive' : 'default'}
            className="w-full h-10"
          >
            {bookMutation.isPending
              ? 'Processing Booking...'
              : isEmergency
              ? 'Confirm Emergency Triage Booking'
              : 'Lock 30-Min Consultation Slot'}
          </Button>
        </form>

        <div className="lg:col-span-2 glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">30-Minute OPD Slot Allocation</h3>
              <p className="text-xs font-medium text-slate-600">Available consultation windows for {date}</p>
            </div>
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
              Concurrency Safe
            </span>
          </div>

          {isSlotsLoading ? (
            <div className="p-8 text-center text-xs font-semibold text-slate-500">Loading available 30-minute consultation slots...</div>
          ) : isSlotsError ? (
            <div className="p-8 text-center text-xs font-semibold text-rose-600">Unable to load appointment availability for selected physician.</div>
          ) : slots.length === 0 ? (
            <div className="p-8 text-center text-xs font-semibold text-slate-500">No consultation slots available for {date}.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {slots.map((slot: any) => {
                const isSelected = selectedSlot === slot.time;
                const isAvailable = slot.available ?? slot.isAvailable ?? true;

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
          )}
        </div>
      </div>
    </div>
  );
};
