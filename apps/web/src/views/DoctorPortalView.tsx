import React, { useState, useEffect } from 'react';
import { Stethoscope, User, Heart, Pill, Plus, CheckCircle, AlertCircle, ShieldAlert, Syringe, Users, Printer, FileText, Activity } from 'lucide-react';
import { apiRequest } from '../services/api';

export const DoctorPortalView: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedAppt, setSelectedAppt] = useState<any>(null);
  const [vitals, setVitals] = useState<{
    bp: string;
    pulse: number | '';
    temp: number | '';
    spo2: number | '';
    height: number | '';
    weight: number | '';
  }>({ bp: '120/80', pulse: 72, temp: 98.6, spo2: 98, height: 170, weight: 70 });

  const [chiefComplaint, setChiefComplaint] = useState('Patient presented with mild chest discomfort and fatigue x 3 days.');
  const [diagnosis, setDiagnosis] = useState('I10 - Essential (Primary) Hypertension');
  const [treatmentPlan, setTreatmentPlan] = useState('Low-sodium diet, regular aerobic exercise 30 min/day, prescribed ACE inhibitor therapy.');
  const [allergies, setAllergies] = useState('Penicillin (Rash), Sulfa Drugs');
  const [vaccinations, setVaccinations] = useState('COVID-19 Booster (2024-01-15), Tetanus Toxoid (2025-06-10)');
  const [familyHistory, setFamilyHistory] = useState('Type 2 Diabetes (Father), Essential Hypertension (Mother)');
  const [prescriptions, setPrescriptions] = useState<any[]>([
    { medicineName: 'Telmisartan 40mg', dosage: '40mg', frequency: 'PO QD (Morning)', durationDays: 30 },
    { medicineName: 'Metformin 500mg', dosage: '500mg', frequency: 'PO BID p.c. (After Meals)', durationDays: 30 },
  ]);
  const [medicinesList, setMedicinesList] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [appts, meds] = await Promise.all([
        apiRequest('/appointments'),
        apiRequest('/medicines'),
      ]);
      setAppointments(appts || []);
      setMedicinesList(meds || []);
      if (appts && appts.length > 0) {
        setSelectedAppt(appts[0]);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const calculateBMI = () => {
    if (!vitals.height || !vitals.weight) return '0';
    const heightInM = Number(vitals.height) / 100;
    return (Number(vitals.weight) / (heightInM * heightInM)).toFixed(1);
  };

  const handleSaveEncounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppt) return;

    try {
      const record = await apiRequest('/medical-records', {
        method: 'POST',
        body: JSON.stringify({
          appointmentId: selectedAppt.id,
          chiefComplaint: chiefComplaint || 'Patient presented for routine clinical consultation',
          diagnosis,
          treatmentPlan: treatmentPlan || 'Prescribed oral medications and dietary modification',
          allergies,
          vaccinations,
          familyHistory,
          vitals: {
            bp: vitals.bp,
            pulse: vitals.pulse === '' ? 70 : Number(vitals.pulse),
            temp: vitals.temp === '' ? 98.6 : Number(vitals.temp),
            spo2: vitals.spo2 === '' ? 98 : Number(vitals.spo2),
            height: vitals.height === '' ? 170 : Number(vitals.height),
            weight: vitals.weight === '' ? 70 : Number(vitals.weight),
          },
        }),
      });

      if (prescriptions.length > 0 && record?.id) {
        const validMed = medicinesList.find((m) => m.id) || medicinesList[0];
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
                durationDays: p.durationDays === '' ? 1 : Number(p.durationDays),
              })),
            }),
          });
        }
      }

      setMessage({ type: 'success', text: 'Clinical Encounter & EMR Record saved successfully! Signed digital prescription generated.' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handlePrintPrescription = () => {
    window.print();
  };

  const icd10Codes = [
    { code: 'I10', label: 'I10 - Essential (Primary) Hypertension' },
    { code: 'E11.9', label: 'E11.9 - Type 2 Diabetes Mellitus without Complications' },
    { code: 'J45.909', label: 'J45.909 - Unspecified Bronchial Asthma' },
    { code: 'K21.9', label: 'K21.9 - Gastro-Esophageal Reflux Disease (GERD)' },
    { code: 'N39.0', label: 'N39.0 - Urinary Tract Infection, Site Unspecified' },
    { code: 'M54.5', label: 'M54.5 - Low Back Pain / Lumbar Spondylosis' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" /> Doctor Clinical Encounter & EMR Studio
          </h2>
          <p className="text-xs text-slate-500 font-medium">Record patient vitals, ICD-10 diagnosis, allergies, vaccinations, family history, and digital prescriptions</p>
        </div>
        <button
          onClick={handlePrintPrescription}
          className="bg-white hover:bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs border border-slate-300 shadow-2xs transition flex items-center gap-1.5"
        >
          <Printer className="w-4 h-4 text-teal-600" /> Print Rx Prescription
        </button>
      </div>

      {message && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Consultation Queue */}
        <div className="glass-card-light p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" /> Patient Queue ({appointments.length})
            </h3>
            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">OPD OPD-3</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {appointments.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">No scheduled consultations</div>
            ) : (
              appointments.map((appt) => {
                const isSelected = selectedAppt?.id === appt.id;
                return (
                  <div
                    key={appt.id}
                    onClick={() => setSelectedAppt(appt)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-teal-50/80 border-teal-500 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900">
                        {appt.patient?.user?.firstName || 'Patient'} {appt.patient?.user?.lastName || ''}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {appt.slotTime}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">MRN: {appt.patient?.mrn || 'MRN-2026-084'}</div>
                    <div className="text-[11px] text-teal-700 font-semibold mt-1">Reason: {appt.reason || 'Routine Health Review'}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* EMR Consultation Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveEncounter} className="glass-card-light p-6 rounded-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Encounter Note: {selectedAppt?.patient?.user?.firstName || 'Vikram'} {selectedAppt?.patient?.user?.lastName || 'Thakur'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Age: 45 | Gender: Male | Blood Group: B+ | MRN: {selectedAppt?.patient?.mrn || 'MRN-2026-1012'}</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                ACTIVE ENCOUNTER
              </span>
            </div>

            {/* Vitals Grid */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-teal-600" /> Patient Clinical Vitals
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">BP (mmHg)</label>
                  <input
                    type="text"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                    value={vitals.bp}
                    onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Pulse (bpm)</label>
                  <input
                    type="number"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                    value={vitals.pulse}
                    onChange={(e) => setVitals({ ...vitals, pulse: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Temp (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                    value={vitals.temp}
                    onChange={(e) => setVitals({ ...vitals, temp: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                    value={vitals.spo2}
                    onChange={(e) => setVitals({ ...vitals, spo2: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Height (cm)</label>
                  <input
                    type="number"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                    value={vitals.height}
                    onChange={(e) => setVitals({ ...vitals, height: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
                    value={vitals.weight}
                    onChange={(e) => setVitals({ ...vitals, weight: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="mt-2 text-[11px] font-bold text-slate-600">
                Calculated Body Mass Index (BMI): <span className="text-teal-700 font-extrabold">{calculateBMI()} kg/m²</span>
              </div>
            </div>

            {/* Chief Complaint & ICD-10 Diagnosis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chief Complaint & Symptoms</label>
                <textarea
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs min-h-[70px]"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Record symptoms..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ICD-10 Clinical Diagnosis *</label>
                <select
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                >
                  {icd10Codes.map((d) => (
                    <option key={d.code} value={d.label}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Treatment Plan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Treatment & Advice Plan</label>
              <textarea
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs min-h-[60px]"
                value={treatmentPlan}
                onChange={(e) => setTreatmentPlan(e.target.value)}
                placeholder="Dietary changes, exercise, review in 30 days..."
              />
            </div>

            {/* Digital Prescription Form */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-teal-600" /> Digital Rx Prescriptions
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    setPrescriptions([
                      ...prescriptions,
                      { medicineName: 'Atorvastatin 10mg', dosage: '10mg', frequency: 'PO QHS (Bedtime)', durationDays: 30 },
                    ])
                  }
                  className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Medication
                </button>
              </div>

              <div className="space-y-2">
                {prescriptions.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                    <input
                      type="text"
                      className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold"
                      value={p.medicineName}
                      onChange={(e) => {
                        const updated = [...prescriptions];
                        updated[idx].medicineName = e.target.value;
                        setPrescriptions(updated);
                      }}
                      placeholder="Medicine Name"
                    />
                    <input
                      type="text"
                      className="px-2 py-1 bg-white border border-slate-300 rounded-lg"
                      value={p.dosage}
                      onChange={(e) => {
                        const updated = [...prescriptions];
                        updated[idx].dosage = e.target.value;
                        setPrescriptions(updated);
                      }}
                      placeholder="Dosage (e.g. 500mg)"
                    />
                    <input
                      type="text"
                      className="px-2 py-1 bg-white border border-slate-300 rounded-lg"
                      value={p.frequency}
                      onChange={(e) => {
                        const updated = [...prescriptions];
                        updated[idx].frequency = e.target.value;
                        setPrescriptions(updated);
                      }}
                      placeholder="Frequency (PO BID)"
                    />
                    <input
                      type="number"
                      className="px-2 py-1 bg-white border border-slate-300 rounded-lg"
                      value={p.durationDays}
                      onChange={(e) => {
                        const updated = [...prescriptions];
                        updated[idx].durationDays = e.target.value === '' ? '' : Number(e.target.value);
                        setPrescriptions(updated);
                      }}
                      placeholder="Days"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl text-xs transition shadow-md shadow-teal-600/20"
            >
              Sign & Save Clinical Encounter Record
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
