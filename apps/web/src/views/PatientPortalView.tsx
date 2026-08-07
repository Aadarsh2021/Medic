'use client';

import React, { useState, useEffect } from 'react';
import { User, FileText, Download, Activity, Pill } from 'lucide-react';
import { apiRequest } from '../services/api';

export const PatientPortalView: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    loadPortalData();
  }, []);

  const loadPortalData = async () => {
    try {
      const [recs, rxs, invs] = await Promise.all([
        apiRequest('/medical-records').catch(() => []),
        apiRequest('/prescriptions').catch(() => []),
        apiRequest('/invoices').catch(() => []),
      ]);
      setRecords(recs || []);
      setPrescriptions(rxs || []);
      setInvoices(invs || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDownloadPrescriptionPDF = (rxId: string) => {
    window.open(`http://localhost:3001/prescriptions/${rxId}/pdf`, '_blank');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" /> Patient Self-Service Portal
          </h2>
          <p className="text-xs text-slate-500 font-medium">View personal medical history, download digital prescriptions, and view billing statements</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EMR Timeline */}
        <div className="glass-panel-light p-6 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" /> Electronic Medical Record Timeline
          </h3>

          <div className="space-y-4">
            {records.length === 0 ? (
              <div className="text-slate-400 text-xs text-center py-8 font-medium">No medical encounter history recorded</div>
            ) : (
              records.map((r) => (
                <div key={r.id} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2 text-xs shadow-2xs">
                  <div className="flex items-center justify-between text-slate-900 font-bold border-b border-slate-100 pb-2">
                    <span>Encounter Date: {new Date(r.createdAt).toLocaleDateString()}</span>
                    <span className="text-blue-600">Dr. {r.doctor?.user?.lastName}</span>
                  </div>
                  <div><strong className="text-slate-700">Chief Complaint:</strong> {r.chiefComplaint}</div>
                  <div><strong className="text-slate-700">Diagnosis:</strong> <span className="text-indigo-700 font-bold">{r.diagnosis}</span></div>
                  <div><strong className="text-slate-700">Treatment Plan:</strong> {r.treatmentPlan}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Prescriptions & Invoices */}
        <div className="space-y-6">
          {/* Prescriptions List */}
          <div className="glass-panel-light p-6 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Pill className="w-4 h-4 text-teal-600" /> Digital Prescriptions
            </h3>

            <div className="space-y-3">
              {prescriptions.length === 0 ? (
                <div className="text-slate-400 text-xs text-center py-6 font-medium">No digital prescriptions available</div>
              ) : (
                prescriptions.map((rx) => (
                  <div key={rx.id} className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
                    <div>
                      <div className="font-bold text-slate-900">Prescription #{rx.id.slice(0, 8)}</div>
                      <div className="text-slate-500 text-[11px] font-medium">Items: {rx.items?.length || 1} Medications</div>
                    </div>
                    <button
                      onClick={() => handleDownloadPrescriptionPDF(rx.id)}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm shadow-teal-600/20"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Invoices List */}
          <div className="glass-panel-light p-6 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600" /> Billing Statements
            </h3>

            <div className="space-y-3">
              {invoices.map((inv) => (
                <div key={inv.id} className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
                  <div>
                    <div className="font-bold text-slate-900">{inv.invoiceNumber}</div>
                    <div className="text-slate-500 text-[11px] font-medium">Total: ${inv.total} • Status: {inv.status}</div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded font-bold text-[10px] ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
