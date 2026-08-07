import { useState, useEffect, FormEvent } from 'react';
import { Receipt, CreditCard, CheckCircle2, Plus, Download } from 'lucide-react';
import { apiRequest } from '../services/api';

export const BillingView: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [items, setItems] = useState<any[]>([{ department: 'Consultation', description: 'Specialist Consultation Fee', quantity: 1, unitPrice: 120 }]);
  const [discount, setDiscount] = useState<number | ''>(0);
  const [paymentMethod, setPaymentMethod] = useState('STRIPE');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [invs, pts] = await Promise.all([
        apiRequest('/invoices'),
        apiRequest('/users/patients'),
      ]);
      setInvoices(invs || []);
      setPatients(pts || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateInvoice = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    try {
      await apiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient,
          items: items.map((i) => ({
            ...i,
            quantity: i.quantity === '' ? 1 : Number(i.quantity),
            unitPrice: i.unitPrice === '' ? 0 : Number(i.unitPrice),
          })),
          discount: discount === '' ? 0 : Number(discount),
        }),
      });

      setMessage({ type: 'success', text: 'Invoice generated with subtotal, 5% GST tax, and line items!' });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    try {
      await apiRequest(`/invoices/${invoiceId}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod,
          paymentId: `pay_${Date.now()}`,
        }),
      });

      setMessage({ type: 'success', text: `Payment processed & verified via ${paymentMethod} webhook!` });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDownloadInvoicePDF = (invoiceId: string) => {
    window.open(`http://localhost:3001/invoices/${invoiceId}/pdf`, '_blank');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal-600" /> Revenue, Billing & Payment Gateway Integration
          </h2>
          <p className="text-xs text-slate-500 font-medium">Departmental charge aggregation, invoice generation, and Stripe/Razorpay webhooks</p>
        </div>
      </div>

      {message && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Invoice Form */}
        <div className="glass-card-light p-6 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Generate Final Invoice</h3>

          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Patient</label>
              <select
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium"
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
              >
                <option value="">Select Patient...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.user?.firstName} {p.user?.lastName} ({p.mrn})
                  </option>
                ))}
              </select>
            </div>

            {/* Line Items Builder */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">Department Line Items</label>
                <button
                  type="button"
                  onClick={() => setItems([...items, { department: 'Pharmacy', description: 'Medications Dispensed', quantity: 1, unitPrice: 45 }])}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold border border-slate-300"
                >
                  <Plus className="w-3 h-3" /> Add Item
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 font-medium"
                      value={item.department}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].department = e.target.value;
                        setItems(updated);
                      }}
                    >
                      <option value="Consultation">Consultation</option>
                      <option value="Laboratory">Laboratory</option>
                      <option value="Pharmacy">Pharmacy</option>
                      <option value="Room">Room Charges</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Description"
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 font-medium"
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].description = e.target.value;
                        setItems(updated);
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Unit Price ($)"
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 font-medium"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].unitPrice = e.target.value === '' ? '' : Number(e.target.value);
                        setItems(updated);
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 font-medium"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].quantity = e.target.value === '' ? '' : Number(e.target.value);
                        setItems(updated);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Discount ($)</label>
              <input
                type="number"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-medium"
                value={discount}
                onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-teal-600/20"
            >
              Generate Invoice & Calculate Tax
            </button>
          </form>
        </div>

        {/* Invoice Viewer & Payment Gateways */}
        <div className="lg:col-span-2 glass-card-light p-6 rounded-2xl border border-slate-200 space-y-5">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">System Invoices Ledger</h3>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {invoices.map((inv) => (
              <div key={inv.id} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-900">{inv.invoiceNumber}</div>
                    <div className="text-xs text-slate-500 font-medium">
                      Patient: {inv.patient?.user?.firstName} {inv.patient?.user?.lastName} (MRN: {inv.patient?.mrn})
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <div className="text-lg font-black text-teal-700">${inv.total}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {inv.status}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDownloadInvoicePDF(inv.id)}
                      title="Download PDF Invoice Receipt"
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition flex items-center gap-1 text-xs font-semibold"
                    >
                      <Download className="w-4 h-4 text-teal-600" />
                      <span className="hidden sm:inline">PDF</span>
                    </button>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="text-xs border-t border-slate-100 pt-2 space-y-1">
                  {inv.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-slate-600">
                      <span>[{item.department}] {item.description} (x{item.quantity})</span>
                      <span className="font-semibold text-slate-800">${item.totalAmount}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Subtotal: ${inv.subtotal} | 5% Tax: ${inv.tax} | Discount: -${inv.discount}</span>
                    <span className="text-teal-700">Total: ${inv.total}</span>
                  </div>
                </div>

                {/* Payment Checkout Modal Simulation */}
                {inv.status !== 'PAID' && (
                  <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
                    <select
                      className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-medium flex-1"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="STRIPE">Stripe Test Gateway (Card: 4242 4242 4242 4242)</option>
                      <option value="RAZORPAY">Razorpay Netbanking / UPI</option>
                      <option value="CASH">Counter Cash Receipt</option>
                    </select>

                    <button
                      onClick={() => handlePayInvoice(inv.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-md shadow-emerald-600/20"
                    >
                      <CreditCard className="w-4 h-4" /> Pay ${inv.total}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
