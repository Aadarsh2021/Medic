'use client';

import React, { useState, useEffect } from 'react';
import { FlaskConical, AlertTriangle, CheckCircle2, ShieldCheck, FileSpreadsheet, TestTube, Microscope } from 'lucide-react';
import { apiRequest } from '../services/api';

export const LaboratoryView: React.FC = () => {
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [resultVal, setResultVal] = useState<number | ''>(235);
  const [refMin, setRefMin] = useState<number | ''>(120);
  const [refMax, setRefMax] = useState<number | ''>(200);
  const [unit, setUnit] = useState('mg/dL');
  const [notes, setNotes] = useState('Quantitative assay verified by Clinical Lab Technician.');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadLabOrders();
  }, []);

  const loadLabOrders = async () => {
    try {
      const orders = await apiRequest('/lab-orders');
      setLabOrders(orders || []);
      if (orders && orders.length > 0 && !selectedOrder) {
        setSelectedOrder(orders[0]);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCollectSample = async (orderId: string) => {
    try {
      await apiRequest(`/lab-orders/${orderId}/collect`, { method: 'PATCH' });
      setMessage({ type: 'success', text: 'Specimen sample marked as collected!' });
      loadLabOrders();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleUploadResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    try {
      await apiRequest(`/lab-orders/${selectedOrder.id}/result`, {
        method: 'PATCH',
        body: JSON.stringify({
          resultValue: resultVal === '' ? 0 : Number(resultVal),
          refRangeMin: refMin === '' ? 0 : Number(refMin),
          refRangeMax: refMax === '' ? 0 : Number(refMax),
          unit,
          technicianNotes: notes || 'Verified by Senior Lab Specialist',
        }),
      });

      setMessage({ type: 'success', text: 'Lab result submitted & reference outlier evaluated!' });
      loadLabOrders();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleApproveReport = async (orderId: string) => {
    try {
      await apiRequest(`/lab-orders/${orderId}/approve`, {
        method: 'PATCH',
      });
      setMessage({ type: 'success', text: 'Lab report approved & patient notified via Socket.IO real-time event!' });
      loadLabOrders();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const numVal = resultVal === '' ? 0 : Number(resultVal);
  const minVal = refMin === '' ? 0 : Number(refMin);
  const maxVal = refMax === '' ? 0 : Number(refMax);
  const isOutlier = numVal < minVal || numVal > maxVal;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Microscope className="w-5 h-5 text-teal-600" /> Pathology Laboratory & Diagnostics Studio
          </h2>
          <p className="text-xs text-slate-500 font-medium">Specimen collection, reference range min/max auto-validation, and report verification</p>
        </div>
      </div>

      {message && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Lab Orders List */}
        <div className="glass-card-light p-5 rounded-2xl border border-slate-200 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Active Diagnostic Orders</h3>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {labOrders.map((order) => {
              const isSelected = selectedOrder?.id === order.id;
              const patientName = `${order.patient?.user?.firstName || 'Patient'} ${order.patient?.user?.lastName || ''}`;

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                    isSelected ? 'bg-teal-50/80 border-teal-500 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{order.testName}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {order.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium">Patient: {patientName}</div>
                  {order.results?.length > 0 && order.results[0]?.isOutlier && (
                    <div className="mt-1 text-[10px] font-bold text-rose-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Flagged Outlier
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Test Result Quantitative Verification Panel */}
        <div className="lg:col-span-2 space-y-6">
          {selectedOrder ? (
            <div className="glass-card-light p-6 rounded-2xl border border-slate-200 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-base text-slate-900">{selectedOrder.testName}</h3>
                  <p className="text-xs text-slate-500 font-medium">Category: {selectedOrder.category || 'Biochemistry'} • Patient: {selectedOrder.patient?.user?.firstName} {selectedOrder.patient?.user?.lastName} ({selectedOrder.patient?.mrn})</p>
                </div>
                <div className="flex gap-2">
                  {selectedOrder.status === 'ORDERED' && (
                    <button
                      onClick={() => handleCollectSample(selectedOrder.id)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition"
                    >
                      Collect Specimen
                    </button>
                  )}
                  {selectedOrder.status === 'SAMPLE_COLLECTED' && (
                    <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-xl text-xs border border-blue-200">
                      Specimen Collected
                    </span>
                  )}
                  {selectedOrder.results?.length > 0 && selectedOrder.status !== 'APPROVED' && (
                    <button
                      onClick={() => handleApproveReport(selectedOrder.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition"
                    >
                      Approve Report
                    </button>
                  )}
                </div>
              </div>

              {/* Form to enter Quantitative Result */}
              <form onSubmit={handleUploadResult} className="space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <TestTube className="w-3.5 h-3.5 text-teal-600" /> Quantitative Test Result & Reference Range
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Measured Value</label>
                    <input
                      type="number"
                      step="any"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                      value={resultVal}
                      onChange={(e) => setResultVal(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Ref Min</label>
                    <input
                      type="number"
                      step="any"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                      value={refMin}
                      onChange={(e) => setRefMin(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Ref Max</label>
                    <input
                      type="number"
                      step="any"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                      value={refMax}
                      onChange={(e) => setRefMax(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Unit</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    />
                  </div>
                </div>

                {/* Auto Outlier Check Alert */}
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
                    isOutlier ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  <span>Out-of-Range Status Check:</span>
                  <span>{isOutlier ? '⚠️ High / Abnormal Flag' : '🟢 Within Normal Limits'}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Technician Notes & Observations</label>
                  <textarea
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs min-h-[60px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Technical observations..."
                  />
                </div>

                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-md shadow-teal-600/20"
                >
                  Submit Lab Results
                </button>
              </form>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">Select a diagnostic order from the queue</div>
          )}
        </div>
      </div>
    </div>
  );
};
