'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, AlertTriangle, CheckCircle2, ShieldCheck, FileSpreadsheet, TestTube, Microscope } from 'lucide-react';
import { apiRequest } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const labResultSchema = z
  .object({
    resultValue: z.number({ invalid_type_error: 'Result value must be a number' }),
    refRangeMin: z.number({ invalid_type_error: 'Min range must be a number' }),
    refRangeMax: z.number({ invalid_type_error: 'Max range must be a number' }),
    unit: z.string().min(1, 'Unit is required (e.g. mg/dL, g/dL)'),
    technicianNotes: z.string().optional(),
  })
  .refine((data) => data.refRangeMax > data.refRangeMin, {
    message: 'Reference maximum must be greater than minimum range',
    path: ['refRangeMax'],
  });

type LabResultFormValues = z.infer<typeof labResultSchema>;

export const LaboratoryView: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: labOrders = [] } = useQuery({
    queryKey: ['lab-orders'],
    queryFn: () => apiRequest('/lab-orders').catch(() => []),
  });

  const orders = labOrders || [];
  const currentOrder = selectedOrder || (orders.length > 0 ? orders[0] : null);

  const form = useForm<LabResultFormValues>({
    resolver: zodResolver(labResultSchema as any),
    defaultValues: {
      resultValue: 235,
      refRangeMin: 120,
      refRangeMax: 200,
      unit: 'mg/dL',
      technicianNotes: 'Quantitative assay verified by Clinical Lab Technician.',
    },
  });

  const watchResultVal = form.watch('resultValue');
  const watchRefMin = form.watch('refRangeMin');
  const watchRefMax = form.watch('refRangeMax');

  const numVal = Number(watchResultVal) || 0;
  const minVal = Number(watchRefMin) || 0;
  const maxVal = Number(watchRefMax) || 0;
  const isOutlier = numVal < minVal || numVal > maxVal;

  const collectMutation = useMutation({
    mutationFn: (orderId: string) => apiRequest(`/lab-orders/${orderId}/collect`, { method: 'PATCH' }),
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Specimen sample marked as collected!' });
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
    },
    onError: (err: any) => setMessage({ type: 'error', text: err.message || 'Sample collection failed.' }),
  });

  const resultMutation = useMutation({
    mutationFn: (values: LabResultFormValues) => {
      if (!currentOrder) throw new Error('Please select an active lab order.');
      return apiRequest(`/lab-orders/${currentOrder.id}/result`, {
        method: 'PATCH',
        body: JSON.stringify({
          resultValue: values.resultValue,
          refRangeMin: values.refRangeMin,
          refRangeMax: values.refRangeMax,
          unit: values.unit,
          technicianNotes: values.technicianNotes || 'Verified by Senior Lab Specialist',
        }),
      });
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Lab result submitted & reference outlier evaluated!' });
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
    },
    onError: (err: any) => setMessage({ type: 'error', text: err.message || 'Failed to submit lab result.' }),
  });

  const approveMutation = useMutation({
    mutationFn: (orderId: string) => apiRequest(`/lab-orders/${orderId}/approve`, { method: 'PATCH' }),
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Lab report approved & patient notified via Socket.IO real-time event!' });
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
    },
    onError: (err: any) => setMessage({ type: 'error', text: err.message || 'Report approval failed.' }),
  });

  const onSubmit = (values: LabResultFormValues) => {
    setMessage(null);
    resultMutation.mutate(values);
  };

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
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-teal-600" /> Diagnostic Orders ({orders.length})
          </h3>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {orders.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">No active lab orders</div>
            ) : (
              orders.map((order: any) => {
                const isSelected = currentOrder?.id === order.id;
                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                      isSelected ? 'bg-teal-50 border-teal-500 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                      <span>{order.testName || 'Serum Lipid Profile'}</span>
                      <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{order.status}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">Patient: {order.patient?.user?.firstName} {order.patient?.user?.lastName}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Category: {order.category || 'Biochemistry'}</div>

                    <div className="mt-3 flex gap-2">
                      {order.status === 'ORDERED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            collectMutation.mutate(order.id);
                          }}
                          disabled={collectMutation.isPending}
                          className="w-full text-[11px] h-8"
                        >
                          Collect Specimen
                        </Button>
                      )}
                      {(order.status === 'SAMPLE_COLLECTED' || order.status === 'RESULT_UPLOADED') && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            approveMutation.mutate(order.id);
                          }}
                          disabled={approveMutation.isPending}
                          className="w-full text-[11px] h-8"
                        >
                          Approve Report
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="lg:col-span-2 glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <TestTube className="w-4 h-4 text-teal-600" /> Lab Test Result Entry & Outlier Evaluator
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="block text-xs font-bold text-slate-700 mb-1">Observed Result Value *</Label>
              <Input type="number" step="0.1" {...form.register('resultValue', { valueAsNumber: true })} />
              {form.formState.errors.resultValue && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.resultValue.message}</p>}
            </div>

            <div>
              <Label className="block text-xs font-bold text-slate-700 mb-1">Unit of Measurement *</Label>
              <Input placeholder="e.g. mg/dL, g/dL, IU/L" {...form.register('unit')} />
              {form.formState.errors.unit && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.unit.message}</p>}
            </div>

            <div>
              <Label className="block text-xs font-bold text-slate-700 mb-1">Reference Range Min *</Label>
              <Input type="number" step="0.1" {...form.register('refRangeMin', { valueAsNumber: true })} />
              {form.formState.errors.refRangeMin && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.refRangeMin.message}</p>}
            </div>

            <div>
              <Label className="block text-xs font-bold text-slate-700 mb-1">Reference Range Max *</Label>
              <Input type="number" step="0.1" {...form.register('refRangeMax', { valueAsNumber: true })} />
              {form.formState.errors.refRangeMax && <p className="text-[10px] text-rose-600 font-semibold mt-1">{form.formState.errors.refRangeMax.message}</p>}
            </div>
          </div>

          <div>
            <Label className="block text-xs font-bold text-slate-700 mb-1">Technician Clinical Notes</Label>
            <textarea
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              rows={3}
              {...form.register('technicianNotes')}
            />
          </div>

          <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold ${isOutlier ? 'bg-rose-50 text-rose-900 border-rose-200' : 'bg-emerald-50 text-emerald-900 border-emerald-200'}`}>
            <span className="flex items-center gap-2">
              {isOutlier ? <AlertTriangle className="w-4 h-4 text-rose-600" /> : <ShieldCheck className="w-4 h-4 text-emerald-600" />}
              Status: {isOutlier ? 'OUT OF RANGE / ABNORMAL FINDING DETECTED' : 'NORMAL REFERENCE RANGE'}
            </span>
            <span className="font-mono text-xs font-extrabold">{numVal} {form.watch('unit')} (Ref: {minVal}-{maxVal})</span>
          </div>

          <Button type="submit" disabled={resultMutation.isPending} className="w-full h-11 text-xs">
            {resultMutation.isPending ? 'Submitting Result...' : 'Submit Lab Result & Run Reference Range Evaluator'}
          </Button>
        </form>
      </div>
    </div>
  );
};
