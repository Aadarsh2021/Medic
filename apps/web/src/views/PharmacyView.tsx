'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Pill, AlertOctagon, CheckCircle2, Layers, Clock, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../services/api';

export const PharmacyView: React.FC = () => {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<any[]>([]);
  const [selectedMed, setSelectedMed] = useState<any>(null);
  const [dispenseQty, setDispenseQty] = useState<number | ''>(5);
  const [activeTab, setActiveTab] = useState<'inventory' | 'expiring'>('inventory');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadPharmacy();
  }, []);

  const loadPharmacy = async () => {
    try {
      const [medData, expData] = await Promise.all([
        apiRequest('/medicines'),
        apiRequest('/medicines/expiring-soon').catch(() => ({ data: [] })),
      ]);
      setMedicines(medData || []);
      setExpiringSoon(expData.data || []);
      if (medData && medData.length > 0 && !selectedMed) setSelectedMed(medData[0]);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDispense = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMed) return;

    try {
      await apiRequest('/medicines/dispense', {
        method: 'POST',
        body: JSON.stringify({
          medicineId: selectedMed.id,
          quantityToDispense: dispenseQty === '' ? 1 : Number(dispenseQty),
        }),
      });

      setMessage({ type: 'success', text: `Successfully allocated and dispensed ${dispenseQty} units via FIFO batch queue!` });
      loadPharmacy();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Pill className="w-5 h-5 text-teal-600" /> Pharmacy Inventory & FIFO Batch Control
          </h2>
          <p className="text-xs text-slate-500 font-medium">First-In First-Out stock fulfillment with expired batch quarantine enforcement</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl border border-slate-300">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'inventory' ? 'bg-white text-teal-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inventory Catalog
          </button>
          <button
            onClick={() => setActiveTab('expiring')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'expiring' ? 'bg-white text-rose-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-rose-600" />
            30-Day Expiring Scanner
            {expiringSoon.length > 0 && (
              <span className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {expiringSoon.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {activeTab === 'inventory' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Medicine Inventory Catalog */}
          <div className="glass-card-light p-5 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Medicine Stock Catalog</h3>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {medicines.map((med) => {
                const isSelected = selectedMed?.id === med.id;
                const totalStock = med.batches?.reduce((acc: number, b: any) => acc + (b.quantity || 0), 0) || 0;

                return (
                  <div
                    key={med.id}
                    onClick={() => setSelectedMed(med)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                      isSelected ? 'bg-teal-50/80 border-teal-500 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900">{med.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {med.category}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>Total In-Stock: <strong className="text-slate-900">{totalStock} units</strong></span>
                      <span className="text-teal-700 font-bold">${med.mrp} MRP</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FIFO Batch Dispensing Panel */}
          <div className="lg:col-span-2 space-y-6">
            {selectedMed ? (
              <div className="glass-card-light p-6 rounded-2xl border border-slate-200 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{selectedMed.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">Category: {selectedMed.category} • Form: {selectedMed.form} • Unit MRP: ${selectedMed.mrp}</p>
                  </div>
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-lg border border-teal-200">
                    FIFO Queue Enforced
                  </span>
                </div>

                {/* Available Batches Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-600" /> Active Batches (Sorted First-In First-Out)
                  </h4>

                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Batch Number</th>
                          <th className="p-2.5">Mfg Date</th>
                          <th className="p-2.5">Expiry Date</th>
                          <th className="p-2.5">Qty Left</th>
                          <th className="p-2.5">Batch Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedMed.batches?.map((b: any, idx: number) => {
                          const isExpired = new Date(b.expiryDate) < new Date();
                          return (
                            <tr key={b.id || idx} className={isExpired ? 'bg-rose-50/60 text-rose-900' : ''}>
                              <td className="p-2.5 font-bold">{b.batchNumber}</td>
                              <td className="p-2.5">{b.mfgDate}</td>
                              <td className="p-2.5">{b.expiryDate}</td>
                              <td className="p-2.5 font-bold">{b.quantity}</td>
                              <td className="p-2.5">
                                {isExpired ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-900 border border-rose-300">
                                    QUARANTINED (EXPIRED)
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                    ACTIVE FIFO
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dispense Form */}
                <form onSubmit={handleDispense} className="flex items-center gap-3 pt-2">
                  <div className="w-40">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Quantity to Dispense</label>
                    <input
                      type="number"
                      min="1"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                      value={dispenseQty}
                      onChange={(e) => setDispenseQty(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>

                  <button
                    type="submit"
                    className="mt-5 bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-md shadow-teal-600/20"
                  >
                    Dispense Stock via FIFO
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">Select a medicine to view batch queue</div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-card-light p-6 rounded-2xl border border-slate-200">
          <h3 className="font-bold text-sm text-slate-900 mb-3">Expiring Stock Quarantine Telemetry</h3>
          <p className="text-xs text-slate-500 mb-4">Batches expiring within 30 days are automatically flagged and blocked from FIFO fulfillment.</p>
        </div>
      )}
    </div>
  );
};
