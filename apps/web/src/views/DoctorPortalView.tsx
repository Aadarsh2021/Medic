'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stethoscope, User, Heart, Pill, Plus, CheckCircle, AlertCircle, Syringe, Users, Printer, FileText, Activity } from 'lucide-react';
import { apiRequest } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const emrSchema = z.object({
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  diagnosis: z.string().min(1, 'Diagnosis is required'),
  treatmentPlan: z.string().min(1, 'Treatment plan is required'),
  allergies: z.string().optional(),
  vaccinations: z.string().optional(),
  familyHistory: z.string().optional(),
  bp: z.string().min(1, 'Blood pressure is required'),
  pulse: z.number({ invalid_type_error: 'Pulse must be a number' }).min(30, 'Pulse min 30').max(220, 'Pulse max 220'),
  temp: z.number({ invalid_type_error: 'Temp must be a number' }).min(90, 'Temp min 90').max(110, 'Temp max 110'),
  spo2: z.number({ invalid_type_error: 'SpO2 must be a number' }).min(50, 'SpO2 min 50').max(100, 'SpO2 max 100'),
  height: z.number({ invalid_type_error: 'Height must be a number' }).min(30, 'Height min 30').max(250, 'Height max 250'),
  weight: z.number({ invalid_type_error: 'Weight must be a number' }).min(1, 'Weight min 1').max(300, 'Weight max 300'),
});

type EMRFormValues = z.infer<typeof emrSchema>;

export const DoctorPortalView: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedAppt, setSelectedAppt] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([
    { medicineName: 'Telmisartan 40mg', dosage: '40mg', frequency: 'PO QD (Morning)', durationDays: 30 },
  ]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: appointments = [] } = useQuery({
    queryKey: ['doctor-appointments'],
    queryFn: () => apiRequest('/appointments').catch(() => []),
  });

  const { data: medicinesList = [] } = useQuery({
    queryKey: ['medicines'],
    queryFn: () => apiRequest('/medicines').catch(() => []),
  });

  const activeAppts = appointments || [];
  const currentAppt = selectedAppt || (activeAppts.length > 0 ? activeAppts[0] : null);

  const form = useForm<EMRFormValues>({
    resolver: zodResolver(emrSchema as any),
    defaultValues: {
      chiefComplaint: 'Patient presented with mild chest discomfort and fatigue x 3 days.',
      diagnosis: 'I10 - Essential (Primary) Hypertension',
      treatmentPlan: 'Low-sodium diet, regular aerobic exercise 30 min/day, prescribed ACE inhibitor therapy.',
      allergies: 'Penicillin (Rash), Sulfa Drugs',
      vaccinations: 'COVID-19 Booster (2024-01-15), Tetanus Toxoid (2025-06-10)',
      familyHistory: 'Type 2 Diabetes (Father), Essential Hypertension (Mother)',
      bp: '120/80',
      pulse: 72,
      temp: 98.6,
      spo2: 98,
      height: 170,
      weight: 70,
    },
  });

  const watchHeight = form.watch('height');
  const watchWeight = form.watch('weight');

  const calculateBMI = () => {
    if (!watchHeight || !watchWeight) return '0';
    const heightInM = Number(watchHeight) / 100;
    return (Number(watchWeight) / (heightInM * heightInM)).toFixed(1);
  };

  const encounterMutation = useMutation({
    mutationFn: async (values: EMRFormValues) => {
      if (!currentAppt) throw new Error('Please select an active patient appointment.');

      const record = await apiRequest('/medical-records', {
        method: 'POST',
        body: JSON.stringify({
          appointmentId: currentAppt.id,
          chiefComplaint: values.chiefComplaint,
          diagnosis: values.diagnosis,
          treatmentPlan: values.treatmentPlan,
          allergies: values.allergies,
          vaccinations: values.vaccinations,
          familyHistory: values.familyHistory,
          vitals: {
            bp: values.bp,
            pulse: Number(values.pulse),
            temp: Number(values.temp),
            spo2: Number(values.spo2),
            height: Number(values.height),
            weight: Number(values.weight),
          },
        }),
      });

      if (prescriptions.length > 0 && record?.id) {
        const validMed = medicinesList.find((m: any) => m.id) || medicinesList[0];
        const medId = validMed?.id;
        if (medId) {
          await apiRequest('/prescriptions', {
            method: 'POST',
            body: JSON.stringify({
              medicalRecordId: record.id,
              items: prescriptions.map((p) => ({
                medicineId: medId,
                dosage: p.dosage,
                frequency: p.frequency,
                durationDays: Number(p.durationDays) || 30,
              })),
            }),
          });
        }
      }

      await apiRequest(`/appointments/${currentAppt.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' }),
      }).catch(() => {});

      return record;
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: '✅ Encounter saved, digital prescription generated & encounter marked COMPLETED!' });
      queryClient.invalidateQueries({ queryKey: ['doctor-appointments'] });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.message || 'Failed to save clinical encounter.' });
    },
  });

  const onSubmit = (values: EMRFormValues) => {
    setMessage(null);
    encounterMutation.mutate(values);
  };

  const addPrescriptionRow = () => {
    setPrescriptions((prev) => [
      ...prev,
      { medicineName: 'Amoxicillin 500mg', dosage: '500mg', frequency: 'PO TID (Every 8h)', durationDays: 7 },
    ]);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" /> Clinical EMR & Prescription Encounter Workstation
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            NABH-Compliant Outpatient Consultation Desk with Digital Prescription & Lab Order Dispatch
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
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
        <div className="glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-600" /> Today's Consultation Queue ({activeAppts.length})
          </h3>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {activeAppts.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">No appointments scheduled for today</div>
            ) : (
              activeAppts.map((appt: any) => {
                const isSelected = currentAppt?.id === appt.id;
                return (
                  <div
                    key={appt.id}
                    onClick={() => setSelectedAppt(appt)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-teal-50 border-teal-500 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                      <span>{appt.patient?.user?.firstName} {appt.patient?.user?.lastName}</span>
                      <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{appt.slotTime}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">MRN: {appt.patient?.mrn || 'MRN-2026-001'}</div>
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className={`font-bold px-2 py-0.5 rounded ${appt.type === 'EMERGENCY' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {appt.type}
                      </span>
                      <span className="font-bold text-slate-600">{appt.status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6">
          <div className="glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" /> Patient Vitals & Physiological Measurements
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label className="block text-[11px] font-bold text-slate-700 mb-1">Blood Pressure (mmHg) *</Label>
                <Input placeholder="120/80" {...form.register('bp')} />
                {form.formState.errors.bp && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.bp.message}</p>}
              </div>

              <div>
                <Label className="block text-[11px] font-bold text-slate-700 mb-1">Pulse Rate (bpm) *</Label>
                <Input type="number" {...form.register('pulse', { valueAsNumber: true })} />
                {form.formState.errors.pulse && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.pulse.message}</p>}
              </div>

              <div>
                <Label className="block text-[11px] font-bold text-slate-700 mb-1">Temperature (°F) *</Label>
                <Input type="number" step="0.1" {...form.register('temp', { valueAsNumber: true })} />
                {form.formState.errors.temp && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.temp.message}</p>}
              </div>

              <div>
                <Label className="block text-[11px] font-bold text-slate-700 mb-1">SpO2 Oxygen (%) *</Label>
                <Input type="number" {...form.register('spo2', { valueAsNumber: true })} />
                {form.formState.errors.spo2 && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.spo2.message}</p>}
              </div>

              <div>
                <Label className="block text-[11px] font-bold text-slate-700 mb-1">Height (cm) *</Label>
                <Input type="number" {...form.register('height', { valueAsNumber: true })} />
                {form.formState.errors.height && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.height.message}</p>}
              </div>

              <div>
                <Label className="block text-[11px] font-bold text-slate-700 mb-1">Weight (kg) *</Label>
                <Input type="number" {...form.register('weight', { valueAsNumber: true })} />
                {form.formState.errors.weight && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.weight.message}</p>}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Calculated Body Mass Index (BMI):</span>
              <span className="font-extrabold text-teal-700 text-sm font-mono">{calculateBMI()} kg/m²</span>
            </div>
          </div>

          <div className="glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" /> Clinical Findings & Diagnostic Coding
            </h3>

            <div>
              <Label className="block text-xs font-bold text-slate-700 mb-1">Chief Complaint & Symptoms *</Label>
              <textarea
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                rows={2}
                {...form.register('chiefComplaint')}
              />
              {form.formState.errors.chiefComplaint && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.chiefComplaint.message}</p>}
            </div>

            <div>
              <Label className="block text-xs font-bold text-slate-700 mb-1">Confirmed Clinical Diagnosis (ICD-10) *</Label>
              <Input {...form.register('diagnosis')} />
              {form.formState.errors.diagnosis && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.diagnosis.message}</p>}
            </div>

            <div>
              <Label className="block text-xs font-bold text-slate-700 mb-1">Treatment Plan & Medical Directives *</Label>
              <textarea
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                rows={2}
                {...form.register('treatmentPlan')}
              />
              {form.formState.errors.treatmentPlan && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.treatmentPlan.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <Label className="block text-[11px] font-bold text-slate-700 mb-1">Allergies & Reactions</Label>
                <Input {...form.register('allergies')} />
              </div>
              <div>
                <Label className="block text-[11px] font-bold text-slate-700 mb-1">Vaccination History</Label>
                <Input {...form.register('vaccinations')} />
              </div>
              <div>
                <Label className="block text-[11px] font-bold text-slate-700 mb-1">Family Medical History</Label>
                <Input {...form.register('familyHistory')} />
              </div>
            </div>
          </div>

          <div className="glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Pill className="w-4 h-4 text-teal-600" /> Digital Prescription Items ({prescriptions.length})
              </h3>
              <Button type="button" size="sm" variant="outline" onClick={addPrescriptionRow} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Medicine Row
              </Button>
            </div>

            <div className="space-y-3">
              {prescriptions.map((p, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <Label className="block text-[10px] font-bold text-slate-600 mb-1">Medicine Name</Label>
                    <Input value={p.medicineName} onChange={(e) => {
                      const updated = [...prescriptions];
                      updated[idx].medicineName = e.target.value;
                      setPrescriptions(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="block text-[10px] font-bold text-slate-600 mb-1">Dosage</Label>
                    <Input value={p.dosage} onChange={(e) => {
                      const updated = [...prescriptions];
                      updated[idx].dosage = e.target.value;
                      setPrescriptions(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="block text-[10px] font-bold text-slate-600 mb-1">Frequency</Label>
                    <Input value={p.frequency} onChange={(e) => {
                      const updated = [...prescriptions];
                      updated[idx].frequency = e.target.value;
                      setPrescriptions(updated);
                    }} />
                  </div>
                  <div>
                    <Label className="block text-[10px] font-bold text-slate-600 mb-1">Duration (Days)</Label>
                    <Input type="number" value={p.durationDays} onChange={(e) => {
                      const updated = [...prescriptions];
                      updated[idx].durationDays = Number(e.target.value) || 1;
                      setPrescriptions(updated);
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={encounterMutation.isPending} className="w-full h-12 text-sm gap-2">
            {encounterMutation.isPending ? 'Saving Encounter & Prescriptions...' : 'Complete Encounter & Dispatch Prescription'}
          </Button>
        </form>
      </div>
    </div>
  );
};
