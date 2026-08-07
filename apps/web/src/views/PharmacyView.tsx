'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pill, AlertOctagon, CheckCircle2, Layers, Clock, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const dispenseSchema = z.object({
  quantityToDispense: z
    .number({ invalid_type_error: 'Dispense quantity must be a positive integer' })
    .int('Quantity must be an integer')
    .min(1, 'Dispense quantity must be at least 1 unit'),
});

type DispenseFormValues = z.infer<typeof dispenseSchema>;

export const PharmacyView: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedMed, setSelectedMed] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'expiring'>('inventory');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: medicines = [] } = useQuery({
    queryKey: ['medicines'],
    queryFn: () => apiRequest('/medicines').catch(() => []),
  });

  const { data: expiringSoonData } = useQuery({
    queryKey: ['expiring-medicines'],
    queryFn: () => apiRequest('/medicines/expiring-soon').catch(() => ({ data: [] })),
  });

  const medsList = medicines || [];
  const currentMed = selectedMed || (medsList.length > 0 ? medsList[0] : null);
  const expiringSoon = expiringSoonData?.data || [];

  const form = useForm<DispenseFormValues>({
    resolver: zodResolver(dispenseSchema as any),
    defaultValues: {
      quantityToDispense: 5,
    },
  });

  const dispenseMutation = useMutation({
    mutationFn: (values: DispenseFormValues) => {
      if (!currentMed) throw new Error('Please select a medicine formulation from stock.');
      return apiRequest('/medicines/dispense', {
        method: 'POST',
        body: JSON.stringify({
          medicineId: currentMed.id,
          quantityToDispense: values.quantityToDispense,
        }),
      });
    },
    onSuccess: (_, variables) => {
      setMessage({
        type: 'success',
        text: `Successfully allocated and dispensed ${variables.quantityToDispense} units via FIFO batch queue!`,
      });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['expiring-medicines'] });
    },
    onError: (err: any) => setMessage({ type: 'error', text: err.message || 'Dispensing failed.' }),
  });

  const onSubmit = (values: DispenseFormValues) => {
    setMessage(null);
    dispenseMutation.mutate(values);
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
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {activeTab === 'inventory' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card-light p-5 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" /> Stock Formulary Catalog ({medsList.length})
            </h3>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {medsList.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-medium">No medicines registered</div>
              ) : (
                medsList.map((med: any) => {
                  const isSelected = currentMed?.id === med.id;
                  const isLow = med.totalStock < med.reorderLevel;

                  return (
                    <div
                      key={med.id}
                      onClick={() => setSelectedMed(med)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                        isSelected ? 'bg-teal-50 border-teal-500 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-slate-900 mb-0.5">
                        <span>{med.name}</span>
                        <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{med.category}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">Form: {med.form} • MRP: ₹{med.mrp}</div>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-700">Stock: {med.totalStock} units</span>
                        {isLow && <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Low Stock Alert</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="lg:col-span-2 glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" /> Prescribed Medicine Dispensing Desk
            </h3>

            {currentMed ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between font-bold text-slate-900 text-sm">
                    <span>{currentMed.name}</span>
                    <span className="text-teal-700 font-mono">Form: {currentMed.form}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
                    <div>Category: <span className="font-bold text-slate-800">{currentMed.category}</span></div>
                    <div>Reorder Threshold: <span className="font-bold text-slate-800">{currentMed.reorderLevel} units</span></div>
                    <div>Total Formulary Stock: <span className="font-bold text-teal-800">{currentMed.totalStock} units</span></div>
                  </div>
                </div>

                <div>
                  <Label className="block text-xs font-bold text-slate-700 mb-1">Quantity to Dispense (FIFO Allocation) *</Label>
                  <Input type="number" {...form.register('quantityToDispense', { valueAsNumber: true })} />
                  {form.formState.errors.quantityToDispense && (
                    <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.quantityToDispense.message}</p>
                  )}
                </div>

                <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 font-medium">
                  💡 <strong>FIFO Execution Notice:</strong> Dispensing automatically deducts inventory from the earliest non-expired batch first. Batches within expiry cutoff or quarantined are rejected.
                </div>

                <Button type="submit" disabled={dispenseMutation.isPending} className="w-full h-11 text-xs">
                  {dispenseMutation.isPending ? 'Dispensing Stock via FIFO Queue...' : 'Execute FIFO Prescription Dispense'}
                </Button>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">Select a medicine to initiate prescription dispensing</div>
            )}
          </form>
        </div>
      ) : (
        <div className="glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-600" /> Expiring Stock Quarantine Watchlist ({expiringSoon.length})
          </h3>

          <div className="space-y-3">
            {expiringSoon.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">No batches expiring within the 30-day window</div>
            ) : (
              expiringSoon.map((batch: any) => (
                <div key={batch.id} className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{batch.medicine?.name || 'Formulary Batch'}</div>
                    <div className="text-[11px] text-slate-500 font-mono">Batch #: {batch.batchNumber} • Qty: {batch.quantity}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded text-[10px]">
                      Expires: {batch.expiryDate}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
